// Données personnelles : uniquement dans ce navigateur (localStorage).
import { COMPLEMENTS, PORTIONS, PREFERES, TOLERANCE, type Aliment, type Portions } from './config/reference'
import type { Qualite } from './engine/plate'
import type { Profil } from './engine/profile'

export type Reglages = {
  portions: Portions
  tolerance: number
  preferes: typeof PREFERES
  complements: Aliment[]
  source: 'reference' | 'profil'
}

export type DernierAliment = { nom: string; quantiteRef: string; g: string; p: string; l: string; qualite?: Qualite }

export type Donnees = { version: 1; reglages: Reglages; profil?: Profil; dernierAliment?: DernierAliment }

const CLE = 'assiette:v1'
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

export const defauts = (): Donnees => ({
  version: 1,
  reglages: { portions: clone(PORTIONS), tolerance: TOLERANCE, preferes: { ...PREFERES }, complements: clone(COMPLEMENTS), source: 'reference' },
})

/** Fusionne des données (stockées ou importées) avec les défauts ; ignore ce qui est mal formé. */
export function fusionner(brut: unknown): Donnees {
  const d = defauts()
  if (!brut || typeof brut !== 'object') return d
  const b = brut as Partial<Donnees>
  const r = b.reglages
  if (r && typeof r === 'object') {
    if (r.portions) d.reglages.portions = { ...d.reglages.portions, ...r.portions, gras: { ...d.reglages.portions.gras, ...r.portions.gras } }
    if (typeof r.tolerance === 'number' && r.tolerance >= 0 && r.tolerance <= 0.5) d.reglages.tolerance = r.tolerance
    if (r.preferes) d.reglages.preferes = { ...d.reglages.preferes, ...r.preferes }
    if (Array.isArray(r.complements))
      d.reglages.complements = d.reglages.complements.map((c) => r.complements!.find((x) => x?.id === c.id && x.pour100) ?? c)
    if (r.source === 'profil' || r.source === 'reference') d.reglages.source = r.source
  }
  if (b.profil && typeof b.profil === 'object') d.profil = b.profil
  if (b.dernierAliment && typeof b.dernierAliment === 'object') d.dernierAliment = b.dernierAliment
  return d
}

export function charger(): Donnees {
  try {
    return fusionner(JSON.parse(localStorage.getItem(CLE) ?? 'null'))
  } catch {
    return defauts()
  }
}

export function sauver(d: Donnees) {
  try {
    localStorage.setItem(CLE, JSON.stringify(d))
  } catch {
    /* navigation privée : on continue sans sauvegarde */
  }
}
