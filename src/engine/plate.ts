// Moteur pur : aucune dépendance au DOM ni au stockage.
import { LEGUMES_G, type Aliment, type Macros, type Portions, type Repas } from '../config/reference'

export const MACROS = ['g', 'p', 'l'] as const
export type Macro = (typeof MACROS)[number]
export const NOM_MACRO: Record<Macro, string> = { g: 'glucides', p: 'protéines', l: 'lipides' }

export const kcal = (m: Macros) => m.g * 4 + m.p * 4 + m.l * 9
const add = (a: Macros, b: Macros): Macros => ({ g: a.g + b.g, p: a.p + b.p, l: a.l + b.l })
const scale = (m: Macros, k: number): Macros => ({ g: m.g * k, p: m.p * k, l: m.l * k })
const ZERO: Macros = { g: 0, p: 0, l: 0 }
const round5 = (x: number) => Math.round(x / 5) * 5

/** Accepte la virgule ; NaN si vide ou invalide. */
export const nombre = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')))

export function budgetRepas(portions: Portions, repas: Repas, fromagePain: boolean): Macros {
  let b = add(add(portions.proteines, portions.feculents), portions.gras[repas])
  if (fromagePain) b = add(add(b, portions.fromage), portions.pain)
  return b
}

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

export type Qualite = { sucres?: number; sel?: number; satures?: number; fibres?: number; nutriscore?: string; nova?: number }
export type Pastille = { texte: string; ton: 'alerte' | 'bien' | 'info' }

export function pastilles(q: Qualite = {}): { pastilles: Pastille[]; conseil?: string } {
  const out: Pastille[] = []
  if (q.sucres != null && q.sucres > 22.5) out.push({ texte: 'Très sucré', ton: 'alerte' })
  if (q.sel != null && q.sel > 1.5) out.push({ texte: 'Très salé', ton: 'alerte' })
  if (q.satures != null && q.satures > 5) out.push({ texte: 'Riche en graisses saturées', ton: 'alerte' })
  if (q.fibres != null && q.fibres > 6) out.push({ texte: 'Riche en fibres', ton: 'bien' })
  if (q.nutriscore && /^[a-e]$/i.test(q.nutriscore)) out.push({ texte: `Nutri-Score ${q.nutriscore.toUpperCase()}`, ton: 'info' })
  if (q.nova && q.nova >= 1 && q.nova <= 4) out.push({ texte: `NOVA ${q.nova}`, ton: 'info' })
  const conseil =
    q.sucres != null && q.sucres > 22.5
      ? 'Le budget féculents n’est pas fait pour les produits sucrés : celui-ci, on le garde pour les fois occasionnelles.'
      : undefined
  return { pastilles: out, conseil }
}

export type Ligne = { aliment: Aliment; grammes: number; apport: Macros }

export type Resultat = {
  quantite: number
  limitante?: Macro
  plat: Macros
  complements: Ligne[]
  legumes: Ligne
  budget: Macros
  depassement: Macros // > 0 sur les macros dépassées
  conseils: string[]
  tresDense: boolean
  total: Macros
  totalKcal: number
  verifierSaisie: boolean
}

export type Entree = {
  budget: Macros
  pour100: Macros
  tolerance: number
  complements: { proteine: Aliment; feculent: Aliment; gras: Aliment; legumes: Aliment }
  quantiteImposee?: number
}

const SEUIL_HUILE = 3
const SEUIL = 10
const estHuile = (a: Aliment) => a.pour100.l >= 90

export function equilibrer(e: Entree): Resultat {
  const a = scale(e.pour100, 1 / 100) // par gramme
  if (MACROS.every((k) => a[k] <= 0)) throw new Error('Aliment sans glucides, protéines ni lipides.')

  let quantite: number
  let limitante: Macro | undefined
  if (e.quantiteImposee != null) {
    quantite = e.quantiteImposee
  } else {
    let min = Infinity
    for (const k of MACROS) {
      if (a[k] <= 0) continue
      const q = (e.budget[k] * (1 + e.tolerance)) / a[k]
      if (q < min) [min, limitante] = [q, k]
    }
    quantite = Math.max(0, Math.floor(min / 5) * 5)
  }

  const plat = scale(a, quantite)
  const brut = { g: e.budget.g - plat.g, p: e.budget.p - plat.p, l: e.budget.l - plat.l }
  const depassement = { g: Math.max(0, -brut.g), p: Math.max(0, -brut.p), l: Math.max(0, -brut.l) }
  const reste = { g: Math.max(0, brut.g), p: Math.max(0, brut.p), l: Math.max(0, brut.l) }

  const complements: Ligne[] = []
  const ajouter = (al: Aliment, macro: Macro, force = false) => {
    const parG = al.pour100[macro] / 100
    if (parG <= 0 || reste[macro] <= 0) return
    const grammes = round5(reste[macro] / parG)
    const seuil = estHuile(al) ? SEUIL_HUILE : SEUIL
    if (grammes < seuil && !(force && grammes > 0)) return
    const apport = scale(al.pour100, grammes / 100)
    for (const k of MACROS) reste[k] = Math.max(0, reste[k] - apport[k])
    complements.push({ aliment: al, grammes, apport })
  }
  // Une assiette garde toujours une source de protéines.
  const platPauvreEnProteines = plat.p < e.budget.p / 2
  ajouter(e.complements.proteine, 'p', platPauvreEnProteines)
  ajouter(e.complements.feculent, 'g')
  ajouter(e.complements.gras, 'l')

  const legumes: Ligne = {
    aliment: e.complements.legumes,
    grammes: LEGUMES_G,
    apport: scale(e.complements.legumes.pour100, LEGUMES_G / 100),
  }

  const conseils: string[] = []
  if (depassement.g > 0.5) conseils.push('Pas de féculents en plus à ce repas, ton assiette est déjà bien remplie.')
  if (depassement.p > 0.5) conseils.push('Pas besoin de protéines en plus à ce repas.')
  if (depassement.l > 0.5) conseils.push('Pas de matière grasse ajoutée cette fois, le plat en apporte déjà.')
  if (!complements.some((c) => c.aliment.categorie === 'feculent') && !depassement.g && plat.g > 0)
    conseils.push('Pas de féculents en plus, le plat a déjà tout pris.')

  const total = [...complements, legumes].reduce((s, c) => add(s, c.apport), plat)
  const totalKcal = Math.round(kcal(total))

  return {
    quantite,
    limitante,
    plat,
    complements,
    legumes,
    budget: e.budget,
    depassement,
    conseils,
    tresDense: e.quantiteImposee == null && quantite < 50,
    total,
    totalKcal,
    verifierSaisie: totalKcal < 350 || totalKcal > 750,
  }
}

export const cuilleres = (grammes: number) =>
  grammes >= 10 ? `≈ ${Math.round(grammes / 10)} c. à soupe` : '≈ 1 c. à café'
