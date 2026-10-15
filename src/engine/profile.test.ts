import { describe, expect, it } from 'vitest'
import { PORTIONS } from '../config/reference'
import { budgetRepas } from './plate'
import { ecart, estimer, mifflin, verifierProfil, type Profil } from './profile'

const homme: Profil = { poids: 80, poidsVise: 75, taille: 180, age: 30, sexe: 'homme', activite: 'modere' }
const femme: Profil = { poids: 65, poidsVise: 60, taille: 165, age: 40, sexe: 'femme', activite: 'sedentaire' }

describe('profil', () => {
  it('Mifflin-St Jeor', () => {
    expect(mifflin(homme)).toBe(1780)
    expect(mifflin(femme)).toBeCloseTo(1320.25)
  })
  it('plafond de déficit à 500 kcal', () => {
    const e = estimer({ ...homme, activite: 'actif' }) // dépense 3070,5 → 15 % = 460
    expect(e.depense - e.apport).toBeCloseTo(460.6, 0)
    const gros = estimer({ ...homme, poids: 140, poidsVise: 100, activite: 'actif' })
    expect(gros.depense - gros.apport).toBe(500)
    expect(gros.perteParSemaine).toBeLessThanOrEqual(1)
  })
  it('plancher calorique : jamais sous le métabolisme ni sous 1200 / 1500', () => {
    const petite: Profil = { poids: 50, poidsVise: 48, taille: 155, age: 70, sexe: 'femme', activite: 'sedentaire' }
    const e = estimer(petite)
    expect(e.apport).toBeGreaterThanOrEqual(1200)
    expect(e.apport).toBeGreaterThanOrEqual(e.metabolisme)
    const h = estimer({ ...petite, sexe: 'homme', poids: 55, poidsVise: 52, taille: 160 })
    expect(h.apport).toBeGreaterThanOrEqual(1500)
  })
  it('maintien si poids visé égal', () => {
    const e = estimer({ ...femme, poidsVise: 65 })
    expect(e.apport).toBe(e.depense)
    expect(e.perteParSemaine).toBe(0)
  })
  it('refus d’un poids visé sous IMC 18,5', () => {
    expect(verifierProfil({ ...femme, poidsVise: 48 })).toBeDefined() // IMC 17,6
    expect(verifierProfil(femme)).toBeUndefined()
    expect(verifierProfil({ ...femme, age: 15 })).toBeDefined()
  })
  it('répartition par repas 35 % / 30 %', () => {
    const e = estimer(homme)
    expect(e.repas.dejeuner.p).toBeCloseTo(e.jour.p * 0.35)
    expect(e.repas.diner.l).toBeCloseTo(e.jour.l * 0.3)
    expect(e.jour.p).toBeCloseTo(105) // 1,4 × 75
  })
  it('écart avec les portions de référence', () => {
    const ref = budgetRepas(PORTIONS, 'dejeuner', false)
    expect(ecart(ref, ref)).toBe(0)
    expect(ecart(ref, { g: 60, p: 24, l: 16 })).toBeGreaterThan(0.2)
  })
})
