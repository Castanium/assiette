// Données personnelles : uniquement dans ce navigateur (localStorage).
import { DEFICIT, PARTS_REPAS, PART_REPAS_DEFAUT, PREFERES, PROTEINES_DEFAUT, PROTEINES_GKG, TOLERANCE, type Cat } from './config/reference'
import type { Profil } from './engine/profile'

export type Reglages = { deficit: number; proteinesGkg: number; partRepas: number; tolerance: number; preferes: Record<Cat, string> }
export type DernierAliment = { nom: string; quantiteRef: string; g: string; p: string; l: string }
export type Donnees = { version: 2; reglages: Reglages; profil?: Profil; dernierAliment?: DernierAliment }

const CLE = 'assiette:v2'
const CLE_V1 = 'assiette:v1'

export const defauts = (): Donnees => ({
  version: 2,
  reglages: { deficit: DEFICIT.defaut, proteinesGkg: PROTEINES_DEFAUT, partRepas: PART_REPAS_DEFAUT, tolerance: TOLERANCE, preferes: { ...PREFERES } },
})

const objet = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object'
const dans = (x: unknown, min: number, max: number) => typeof x === 'number' && x >= min && x <= max

/** Fusionne des données v2 (stockées ou importées) avec les défauts ; ignore ce qui est mal formé. */
export function fusionner(brut: unknown): Donnees {
  if (objet(brut) && brut.version !== 2) return migrerV1(brut)
  const d = defauts()
  if (!objet(brut)) return d
  const r = brut.reglages
  if (objet(r)) {
    if (dans(r.deficit, 0, DEFICIT.max)) d.reglages.deficit = r.deficit
    if (Object.values(PROTEINES_GKG).includes(r.proteinesGkg)) d.reglages.proteinesGkg = r.proteinesGkg
    if (PARTS_REPAS.includes(r.partRepas)) d.reglages.partRepas = r.partRepas
    if (dans(r.tolerance, 0, 0.5)) d.reglages.tolerance = r.tolerance
    if (objet(r.preferes)) d.reglages.preferes = { ...d.reglages.preferes, ...r.preferes }
  }
  if (objet(brut.profil)) d.profil = brut.profil as Profil
  if (objet(brut.dernierAliment)) d.dernierAliment = brut.dernierAliment as DernierAliment
  return d
}

/** v1 → v2 : garde profil, compléments préférés, tolérance et dernier aliment ; le reste disparaît. */
export function migrerV1(v1: unknown): Donnees {
  const d = defauts()
  if (!objet(v1)) return d
  const r = v1.reglages
  if (objet(r)) {
    if (dans(r.tolerance, 0, 0.5)) d.reglages.tolerance = r.tolerance
    if (objet(r.preferes)) for (const c of ['proteine', 'feculent', 'gras'] as Cat[]) if (typeof r.preferes[c] === 'string') d.reglages.preferes[c] = r.preferes[c]
  }
  if (objet(v1.profil)) d.profil = v1.profil as Profil
  const a = v1.dernierAliment
  if (objet(a)) d.dernierAliment = { nom: String(a.nom ?? ''), quantiteRef: String(a.quantiteRef ?? '100'), g: String(a.g ?? ''), p: String(a.p ?? ''), l: String(a.l ?? '') }
  return d
}

export function charger(): Donnees {
  try {
    const v2 = localStorage.getItem(CLE)
    if (v2) return fusionner(JSON.parse(v2))
    const v1 = localStorage.getItem(CLE_V1)
    if (v1) {
      const d = migrerV1(JSON.parse(v1))
      sauver(d)
      localStorage.removeItem(CLE_V1)
      return d
    }
  } catch {
    /* stockage indisponible ou illisible */
  }
  return defauts()
}

export function sauver(d: Donnees) {
  try {
    localStorage.setItem(CLE, JSON.stringify(d))
  } catch {
    /* navigation privée : on continue sans sauvegarde */
  }
}
