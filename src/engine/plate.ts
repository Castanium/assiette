// Moteur pur : aucune dépendance au DOM ni au stockage.
import { ASSIETTE_COPIEUSE_G, ECART_ASSIETTE, LEGUMES_G, type Aliment, type Macros } from '../config/reference'
import { kcal } from './profile'

export const MACROS = ['g', 'p', 'l'] as const
export type Macro = (typeof MACROS)[number]
export const NOM_MACRO: Record<Macro, string> = { g: 'glucides', p: 'protéines', l: 'lipides' }

const add = (a: Macros, b: Macros): Macros => ({ g: a.g + b.g, p: a.p + b.p, l: a.l + b.l })
const sub = (a: Macros, b: Macros): Macros => ({ g: a.g - b.g, p: a.p - b.p, l: a.l - b.l })
const scale = (m: Macros, k: number): Macros => ({ g: m.g * k, p: m.p * k, l: m.l * k })
const round5 = (x: number) => Math.round(x / 5) * 5

/** Accepte la virgule ; NaN si vide ou invalide. */
export const nombre = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')))

/** Ramène des valeurs « pour X g » à 100 g et vérifie leur cohérence. */
export function normaliser(quantiteRef: number, m: Macros): { pour100?: Macros; erreur?: string } {
  if (!(quantiteRef > 0)) return { erreur: 'Indique pour combien de grammes sont ces valeurs.' }
  if (MACROS.some((k) => !Number.isFinite(m[k]) || m[k] < 0))
    return { erreur: 'Glucides, protéines et lipides doivent être des nombres positifs (0 accepté).' }
  const pour100 = scale(m, 100 / quantiteRef)
  if (MACROS.every((k) => pour100[k] === 0))
    return { erreur: 'Les trois valeurs sont à 0 : vérifie l’étiquette, il manque quelque chose.' }
  if (pour100.g + pour100.p + pour100.l > 100.5 || kcal(pour100) > 900)
    return { erreur: 'Ces valeurs dépassent 100 g pour 100 g : vérifie qu’elles correspondent bien à la quantité indiquée.' }
  return { pour100 }
}

export type Ligne = { aliment: Aliment; grammes: number; apport: Macros; vise?: { macro: Macro; grammes: number } }

export type Resultat = {
  quantite: number
  limitante?: Macro
  plat: Macros
  complements: Ligne[]
  legumes: Ligne
  budget: Macros // budget du repas, légumes compris
  depassement: Macros // > 0 sur les macros dépassées
  manque: Macros // budget − plat − légumes, ramené à 0
  conseils: string[]
  proteinesAuDessus: boolean
  tresDense: boolean
  total: Macros
  totalKcal: number
  verifierSaisie: boolean
  poidsTotal: number // plat + compléments + légumes, en g
  copieuse: boolean
}

export type Entree = {
  budget: Macros
  pour100: Macros
  tolerance: number
  complements: { proteine: Aliment; feculent: Aliment; gras: Aliment }
  legumes: Aliment
  quantiteImposee?: number
}

const estHuile = (a: Aliment) => a.pour100.l >= 90

export function equilibrer(e: Entree): Resultat {
  const a = scale(e.pour100, 1 / 100) // par gramme
  if (MACROS.every((k) => a[k] <= 0)) throw new Error('Aliment sans glucides, protéines ni lipides.')

  // Les légumes comptent : on retire leurs macros du budget avant tout le reste.
  const legumes: Ligne = { aliment: e.legumes, grammes: LEGUMES_G, apport: scale(e.legumes.pour100, LEGUMES_G / 100) }
  const dispo = sub(e.budget, legumes.apport)

  // Quantité maximale : seuls glucides et lipides limitent (les protéines ne sont pas une limite haute).
  // Un plat sans glucides ni lipides est limité par les protéines, faute d'autre repère.
  let quantite: number
  let limitante: Macro | undefined
  if (e.quantiteImposee != null) {
    quantite = e.quantiteImposee
  } else {
    const limites: Macro[] = a.g > 0 || a.l > 0 ? ['g', 'l'] : ['p']
    let min = Infinity
    for (const k of limites) {
      if (a[k] <= 0) continue
      const q = (Math.max(0, dispo[k]) * (1 + e.tolerance)) / a[k]
      if (q < min) [min, limitante] = [q, k]
    }
    quantite = Math.max(0, Math.floor(min / 5) * 5)
  }

  const plat = scale(a, quantite)
  const brut = sub(dispo, plat)
  const depassement = { g: Math.max(0, -brut.g), p: 0, l: Math.max(0, -brut.l) }
  const reste = { g: Math.max(0, brut.g), p: brut.p, l: Math.max(0, brut.l) }

  const ligne = (al: Aliment, cible: number, macro: Macro, force = false): Ligne | undefined => {
    const parG = al.pour100[macro] / 100
    if (parG <= 0 || cible <= 0) return
    const grammes = round5(cible / parG)
    if (grammes < (estHuile(al) ? 3 : 10) && !(force && grammes > 0)) return
    return { aliment: al, grammes, apport: scale(al.pour100, grammes / 100), vise: { macro, grammes: cible } }
  }

  // Chaque complément vise ce qui reste une fois déduits le plat, les légumes et les compléments précédents.
  // 1. Protéine : toujours proposée si le plat couvre moins de la moitié du budget.
  const forcer = plat.p < e.budget.p / 2
  let prot = ligne(e.complements.proteine, reste.p, 'p', forcer)
  // 2. Si les protéines dépassent le budget, leurs kcal en trop sont retirées du féculent, puis de la matière grasse.
  let dette = Math.max(0, (prot?.apport.p ?? 0) - reste.p) * 4
  const resteG = Math.max(0, reste.g - (prot?.apport.g ?? 0))
  const cibleG = Math.max(0, resteG - dette / 4)
  dette = Math.max(0, dette - resteG * 4)
  // 3. Féculent ; ses protéines sont retirées de la protéine, recalculée.
  const fec = ligne(e.complements.feculent, cibleG, 'g')
  if (prot && fec) prot = ligne(e.complements.proteine, reste.p - fec.apport.p, 'p', forcer)
  // 4. Matière grasse, pour les lipides restants.
  const cibleL = Math.max(0, reste.l - (prot?.apport.l ?? 0) - (fec?.apport.l ?? 0) - dette / 9)
  const gras = ligne(e.complements.gras, cibleL, 'l')
  const complements = [prot, fec, gras].filter((c): c is Ligne => !!c)

  const total = [...complements, legumes].reduce((s, c) => add(s, c.apport), plat)
  const totalKcal = Math.round(kcal(total))
  const poidsTotal = quantite + LEGUMES_G + complements.reduce((s, c) => s + c.grammes, 0)
  const proteinesAuDessus = total.p > e.budget.p + 5

  const conseils: string[] = []
  if (depassement.g > 0.5) conseils.push('Pas de féculents en plus à ce repas, ton assiette est déjà bien remplie.')
  if (depassement.l > 0.5) conseils.push('Pas de matière grasse ajoutée cette fois, le plat en apporte déjà.')
  if (!fec && !depassement.g && plat.g > 0 && dispo.g - plat.g < 5) conseils.push('Pas de féculents en plus, le plat a déjà tout pris.')
  if (depassement.l <= 0.5 && total.l > e.budget.l + 5)
    conseils.push('Les compléments apportent un peu plus de lipides que prévu : une protéine plus maigre allège l’assiette.')

  return {
    quantite,
    limitante,
    plat,
    complements,
    legumes,
    budget: e.budget,
    depassement,
    manque: { g: Math.max(0, brut.g), p: Math.max(0, brut.p), l: Math.max(0, brut.l) },
    conseils,
    proteinesAuDessus,
    tresDense: e.quantiteImposee == null && quantite < 50,
    total,
    totalKcal,
    verifierSaisie: Math.abs(totalKcal - kcal(e.budget)) / kcal(e.budget) > ECART_ASSIETTE,
    poidsTotal,
    copieuse: poidsTotal > ASSIETTE_COPIEUSE_G,
  }
}

export const cuilleres = (grammes: number) =>
  grammes >= 10 ? `≈ ${Math.round(grammes / 10)} c. à soupe` : '≈ 1 c. à café'
