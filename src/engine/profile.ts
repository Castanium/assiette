// Estimation indicative des budgets à partir du profil. Fonctions pures.
import { REPARTITION, type Macros, type Repas } from '../config/reference'

export type Sexe = 'homme' | 'femme'
export type Activite = 'sedentaire' | 'leger' | 'modere' | 'actif'
export type Profil = { poids: number; poidsVise: number; taille: number; age: number; sexe: Sexe; activite: Activite }

export const COEF_ACTIVITE: Record<Activite, number> = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725 }
const PLANCHER: Record<Sexe, number> = { homme: 1500, femme: 1200 }
const KCAL_PAR_KG = 7700

export function mifflin(p: Pick<Profil, 'poids' | 'taille' | 'age' | 'sexe'>): number {
  return 10 * p.poids + 6.25 * p.taille - 5 * p.age + (p.sexe === 'homme' ? 5 : -161)
}

export const imc = (poids: number, tailleCm: number) => poids / (tailleCm / 100) ** 2

export function verifierProfil(p: Profil): string | undefined {
  if (![p.poids, p.poidsVise].every((x) => x >= 35 && x <= 250)) return 'Le poids doit être compris entre 35 et 250 kg.'
  if (!(p.taille >= 130 && p.taille <= 220)) return 'La taille doit être comprise entre 130 et 220 cm.'
  if (!(p.age >= 16 && p.age <= 100)) return 'L’âge doit être compris entre 16 et 100 ans.'
  if (imc(p.poidsVise, p.taille) < 18.5)
    return 'Ce poids visé serait en dessous de ce qui est considéré comme un poids de forme pour ta taille. Ton corps mérite mieux qu’un objectif trop bas : choisis un poids visé un peu plus haut, et parles-en à un professionnel de santé si tu en as envie.'
  return undefined
}

export type Estimation = {
  metabolisme: number
  depense: number
  apport: number
  jour: Macros
  repas: Record<Repas, Macros>
  perteParSemaine: number // kg, 0 si maintien
  dateIndicative?: Date
}

export function estimer(p: Profil, aujourdhui = new Date()): Estimation {
  const metabolisme = mifflin(p)
  const depense = metabolisme * COEF_ACTIVITE[p.activite]
  let apport: number
  if (p.poidsVise < p.poids) {
    const deficit = Math.min(0.15 * depense, 500)
    apport = Math.max(depense - deficit, metabolisme, PLANCHER[p.sexe])
  } else if (p.poidsVise > p.poids) {
    apport = depense * 1.1
  } else {
    apport = depense
  }
  const prot = 1.4 * p.poidsVise
  const lip = (0.3 * apport) / 9
  const glu = Math.max(0, (apport - prot * 4 - lip * 9) / 4)
  const jour = { g: glu, p: prot, l: lip }
  const part = (k: number): Macros => ({ g: glu * k, p: prot * k, l: lip * k })

  const deficitReel = Math.max(0, depense - apport)
  const perteParSemaine = p.poidsVise < p.poids ? Math.min(1, (deficitReel * 7) / KCAL_PAR_KG) : 0
  let dateIndicative: Date | undefined
  if (perteParSemaine > 0) {
    const semaines = (p.poids - p.poidsVise) / perteParSemaine
    dateIndicative = new Date(aujourdhui.getTime() + semaines * 7 * 86400000)
  }
  return {
    metabolisme,
    depense,
    apport,
    jour,
    repas: { dejeuner: part(REPARTITION.dejeuner), diner: part(REPARTITION.diner) },
    perteParSemaine,
    dateIndicative,
  }
}

/** Écart relatif de calories entre deux budgets (0,25 = 25 %). */
export const ecart = (ref: Macros, autre: Macros) => {
  const k = (m: Macros) => m.g * 4 + m.p * 4 + m.l * 9
  return Math.abs(k(autre) - k(ref)) / k(ref)
}
