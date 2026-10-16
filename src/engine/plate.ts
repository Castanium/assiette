// Moteur pur : aucune dépendance au DOM ni au stockage.
import { ECART_ASSIETTE, LEGUMES_G, type Aliment, type Macros } from '../config/reference'
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

export type Ligne = { aliment: Aliment; grammes: number; apport: Macros }

export type Resultat = {
  quantite: number
  limitante?: Macro
  plat: Macros
  complements: Ligne[]
  legumes: Ligne
  budget: Macros // budget du repas, légumes compris
  depassement: Macros // > 0 sur les macros dépassées
  conseils: string[]
  proteinesAuDessus: boolean
  tresDense: boolean
  total: Macros
  totalKcal: number
  verifierSaisie: boolean
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

  const complements: Ligne[] = []
  const ligne = (al: Aliment, cible: number, macro: Macro, force = false) => {
    const parG = al.pour100[macro] / 100
    if (parG <= 0 || cible <= 0) return
    const grammes = round5(cible / parG)
    if (grammes < (estHuile(al) ? 3 : 10) && !(force && grammes > 0)) return
    const l = { aliment: al, grammes, apport: scale(al.pour100, grammes / 100) }
    complements.push(l)
    return l
  }

  // 1. Protéine : toujours proposée si le plat couvre moins de la moitié du budget.
  const prot = ligne(e.complements.proteine, reste.p, 'p', plat.p < e.budget.p / 2)
  if (prot) {
    reste.p -= prot.apport.p
    reste.g = Math.max(0, reste.g - prot.apport.g)
    reste.l = Math.max(0, reste.l - prot.apport.l)
  }
  // 2. Si les protéines dépassent le budget, leurs kcal en trop sont retirées du féculent, puis de la matière grasse.
  let dette = Math.max(0, -reste.p) * 4
  const cibleG = Math.max(0, reste.g - dette / 4)
  dette = Math.max(0, dette - reste.g * 4)
  let cibleL = Math.max(0, reste.l - dette / 9)
  // 3. Féculent, puis 4. matière grasse, en tenant compte de ce qui est déjà apporté.
  const fec = ligne(e.complements.feculent, cibleG, 'g')
  if (fec) cibleL = Math.max(0, cibleL - fec.apport.l)
  ligne(e.complements.gras, cibleL, 'l')

  const total = [...complements, legumes].reduce((s, c) => add(s, c.apport), plat)
  const totalKcal = Math.round(kcal(total))
  const proteinesAuDessus = total.p > e.budget.p + 5

  const conseils: string[] = []
  if (depassement.g > 0.5) conseils.push('Pas de féculents en plus à ce repas, ton assiette est déjà bien remplie.')
  if (depassement.l > 0.5) conseils.push('Pas de matière grasse ajoutée cette fois, le plat en apporte déjà.')
  if (!fec && !depassement.g && plat.g > 0 && dispo.g - plat.g < 5) conseils.push('Pas de féculents en plus, le plat a déjà tout pris.')

  return {
    quantite,
    limitante,
    plat,
    complements,
    legumes,
    budget: e.budget,
    depassement,
    conseils,
    proteinesAuDessus,
    tresDense: e.quantiteImposee == null && quantite < 50,
    total,
    totalKcal,
    verifierSaisie: Math.abs(totalKcal - kcal(e.budget)) / kcal(e.budget) > ECART_ASSIETTE,
  }
}

export const cuilleres = (grammes: number) =>
  grammes >= 10 ? `≈ ${Math.round(grammes / 10)} c. à soupe` : '≈ 1 c. à café'
