import { describe, expect, it } from 'vitest'
import { fusionner, migrerV1 } from './store'

const v1 = {
  version: 1,
  reglages: {
    portions: { proteines: { g: 0, p: 20, l: 5 }, gras: { dejeuner: { g: 0, p: 0, l: 10 }, diner: { g: 0, p: 0, l: 10 } } },
    tolerance: 0.05,
    preferes: { proteine: 'tofu', feculent: 'quinoa', gras: 'colza' },
    complements: [],
    source: 'reference',
  },
  profil: { poids: 70, poidsVise: 65, taille: 170, age: 40, sexe: 'femme', activite: 'modere' },
  dernierAliment: { nom: 'Gyozas', quantiteRef: '100', g: '26', p: '7', l: '6', qualite: { sucres: 3 } },
}

describe('migration v1 → v2', () => {
  const d = migrerV1(v1)
  it('garde profil, préférés, tolérance et dernier aliment', () => {
    expect(d.version).toBe(2)
    expect(d.profil).toEqual(v1.profil)
    expect(d.reglages.preferes).toEqual({ proteine: 'tofu', feculent: 'quinoa', gras: 'colza' })
    expect(d.reglages.tolerance).toBe(0.05)
    expect(d.dernierAliment).toEqual({ nom: 'Gyozas', quantiteRef: '100', g: '26', p: '7', l: '6' })
  })
  it('supprime portions, fromage + pain et source ; nouveaux réglages par défaut', () => {
    expect(Object.keys(d.reglages).sort()).toEqual(['deficit', 'partRepas', 'preferes', 'proteinesGkg', 'tolerance'])
    expect(d.reglages).toMatchObject({ deficit: 0.15, proteinesGkg: 1.8, partRepas: 0.75 })
    expect(JSON.stringify(d)).not.toMatch(/portions|source|fromage|dejeuner|qualite/)
  })
  it('un import v1 passe aussi par la migration', () => {
    expect(fusionner(v1)).toEqual(d)
  })
  it('valeurs v2 invalides ignorées', () => {
    const r = fusionner({ version: 2, reglages: { deficit: 0.9, proteinesGkg: 3, partRepas: 0.5, tolerance: 0.1 } }).reglages
    expect(r).toMatchObject({ deficit: 0.15, proteinesGkg: 1.8, partRepas: 0.75, tolerance: 0.1 })
  })
})
