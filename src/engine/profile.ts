// Besoins calculés à partir du profil. Fonctions pures.
import {
  COEF_ACTIVITE, DEFICIT, FRUIT_G, FRUIT_POUR100, GLUCIDES_BAS_JOUR, KCAL_PAR_KG, LIPIDES_MIN_GKG, OBJECTIFS, PLANCHER_PROTEINES_REPAS_GKG, SURPLUS_MASSE,
  type Macros,
} from '../config/reference'

export type Sexe = 'homme' | 'femme'
export type Activite = keyof typeof COEF_ACTIVITE
export type Objectif = keyof typeof OBJECTIFS
export type Profil = { poids: number; poidsVise: number; taille: number; age: number; sexe: Sexe; activite: Activite; objectif?: Objectif }

/** Objectif choisi, ou déduit du poids visé pour les profils enregistrés avant la v1.4.1. */
export const objectifDe = (p: Profil): Objectif =>
  p.objectif ?? (p.poidsVise < p.poids ? 'perte' : p.poidsVise > p.poids ? 'masse' : 'equilibre')
export type ReglagesBesoins = { deficit: number; proteinesGkg: number; partRepas: number }

export const kcal = (m: Macros) => m.g * 4 + m.p * 4 + m.l * 9

export function mifflin(p: Pick<Profil, 'poids' | 'taille' | 'age' | 'sexe'>): number {
  return 10 * p.poids + 6.25 * p.taille - 5 * p.age + (p.sexe === 'homme' ? 5 : -161)
}

export const imc = (poids: number, tailleCm: number) => poids / (tailleCm / 100) ** 2

export function verifierProfil(p: Profil): string | undefined {
  if (![p.poids, p.poidsVise].every((x) => x >= 35 && x <= 250)) return 'Le poids doit être compris entre 35 et 250 kg.'
  if (!(p.taille >= 130 && p.taille <= 220)) return 'La taille doit être comprise entre 130 et 220 cm.'
  if (!(p.age >= 16 && p.age <= 100)) return 'L’âge doit être compris entre 16 et 100 ans.'
  if (!(p.sexe in { homme: 1, femme: 1 }) || !(p.activite in COEF_ACTIVITE)) return 'Indique ton sexe et ton niveau d’activité.'
  if (p.objectif != null && !(p.objectif in OBJECTIFS)) return 'Choisis ton objectif.'
  const o = objectifDe(p)
  if (o === 'perte' && p.poidsVise >= p.poids) return 'Pour une perte de poids, ton poids visé doit être sous ton poids actuel.'
  if (o === 'masse' && p.poidsVise < p.poids) return 'Pour une prise de masse, ton poids visé ne peut pas être sous ton poids actuel.'
  if (imc(p.poidsVise, p.taille) < 18.5)
    return 'Ce poids visé serait en dessous de ce qui est considéré comme un poids de forme pour ta taille. Ton corps mérite mieux qu’un objectif trop bas : choisis un poids visé un peu plus haut, et parles-en à un professionnel de santé si tu en as envie.'
  return undefined
}

/** Un repas principal : la moitié de la part des deux repas, protéines remontées au plancher si besoin. */
export function repasPrincipal(jour: Macros, partRepas: number, poidsVise: number): Macros {
  const k = partRepas / 2
  const m = { g: jour.g * k, p: jour.p * k, l: jour.l * k }
  const plancher = PLANCHER_PROTEINES_REPAS_GKG * poidsVise
  if (m.p < plancher) {
    // Protéines et glucides valent 4 kcal/g : on retire le même nombre de grammes de glucides.
    m.g = Math.max(0, m.g - (plancher - m.p))
    m.p = plancher
  }
  return m
}

export type Besoins = {
  objectif: Objectif
  metabolisme: number
  depense: number
  maintien: boolean // pas de déficit (entre deux ou prise de masse)
  deficitApplique: number // part réellement retenue (0 en maintien)
  apport: number
  jour: Macros
  repas: Macros
  collations: Macros
  fruit: Macros // un fruit de 150 g
  collationsApresFruit: Macros
  glucidesBas: boolean
  perteParSemaine: number // négatif en prise de masse
}

export function besoins(p: Profil, r: ReglagesBesoins): Besoins {
  const metabolisme = mifflin(p)
  const depense = metabolisme * COEF_ACTIVITE[p.activite]
  const objectif = objectifDe(p)
  const maintien = objectif !== 'perte'
  const deficitApplique = maintien ? 0 : Math.min(Math.max(r.deficit, 0), DEFICIT.max)
  const apport = objectif === 'masse'
    ? depense * (1 + SURPLUS_MASSE)
    : Math.max(depense - Math.min(depense * deficitApplique, DEFICIT.plafondKcal), metabolisme)

  const prot = r.proteinesGkg * p.poidsVise
  const lip = Math.max(LIPIDES_MIN_GKG * p.poidsVise, (OBJECTIFS[objectif].lipides * apport) / 9)
  const glu = Math.max(0, (apport - prot * 4 - lip * 9) / 4)
  const jour = { g: glu, p: prot, l: lip }

  const repas = repasPrincipal(jour, r.partRepas, p.poidsVise)
  const collations = { g: Math.max(0, glu - 2 * repas.g), p: Math.max(0, prot - 2 * repas.p), l: Math.max(0, lip - 2 * repas.l) }
  const k = FRUIT_G / 100
  const fruit = { g: FRUIT_POUR100.g * k, p: FRUIT_POUR100.p * k, l: FRUIT_POUR100.l * k }
  const collationsApresFruit = { g: Math.max(0, collations.g - fruit.g), p: Math.max(0, collations.p - fruit.p), l: Math.max(0, collations.l - fruit.l) }

  return {
    objectif,
    metabolisme,
    depense,
    maintien,
    deficitApplique,
    apport,
    jour,
    repas,
    collations,
    fruit,
    collationsApresFruit,
    glucidesBas: glu < GLUCIDES_BAS_JOUR,
    perteParSemaine: ((depense - apport) * 7) / KCAL_PAR_KG,
  }
}
