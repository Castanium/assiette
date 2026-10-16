import { describe, expect, it } from 'vitest'
import { besoins, kcal, mifflin, repasPrincipal, verifierProfil, type Profil, type ReglagesBesoins } from './profile'

const homme: Profil = { sexe: 'homme', age: 35, taille: 180, poids: 90, poidsVise: 80, activite: 'leger' }
const reglages: ReglagesBesoins = { deficit: 0.15, proteinesGkg: 1.8, partRepas: 0.75 }

describe('profil type', () => {
  const b = besoins(homme, reglages)
  it('métabolisme, dépense, apport', () => {
    expect(b.metabolisme).toBe(1855)
    expect(b.depense).toBeCloseTo(2550.6, 1)
    expect(b.apport).toBeCloseTo(2168, 0)
  })
  it('macros du jour', () => {
    expect(b.jour.p).toBeCloseTo(144)
    expect(b.jour.l).toBeCloseTo(64) // 0,8 × 80 > 25 % de 2168 / 9 = 60,2
    expect(b.jour.g).toBeCloseTo(254, 0)
  })
  it('repas principal à 37,5 % et collations à 25 %', () => {
    expect(b.repas.p).toBeCloseTo(54)
    expect(b.repas.l).toBeCloseTo(24)
    expect(b.repas.g).toBeCloseTo(95.3, 0)
    expect(kcal(b.repas)).toBeCloseTo(813, 0)
    expect(kcal(b.collations)).toBeCloseTo(542, 0)
    expect(b.collations.p).toBeCloseTo(36)
  })
  it('collations : le fruit de 150 g est déduit du budget', () => {
    expect(b.fruit).toEqual({ g: 18, p: expect.closeTo(1.05), l: expect.closeTo(0.45) })
    expect(kcal(b.fruit)).toBeCloseTo(80.25)
    expect(kcal(b.collationsApresFruit)).toBeCloseTo(kcal(b.collations) - 80.25)
    expect(kcal(b.collationsApresFruit)).toBeCloseTo(462, 0)
    expect(b.collationsApresFruit.p).toBeCloseTo(36 - 1.05)
  })
  it('rythme de perte = déficit × 7 / 7700', () => {
    expect(b.perteParSemaine).toBeCloseTo(((b.depense - b.apport) * 7) / 7700)
    expect(b.perteParSemaine).toBeCloseTo(0.35, 2)
  })
})

describe('garde-fous des besoins', () => {
  it('déficit plafonné à 750 kcal', () => {
    const grand: Profil = { sexe: 'homme', age: 30, taille: 190, poids: 130, poidsVise: 100, activite: 'actif' }
    const b = besoins(grand, { ...reglages, deficit: 0.25 })
    expect(b.depense - b.apport).toBeCloseTo(750)
  })
  it('apport jamais sous le métabolisme de base', () => {
    const b = besoins({ ...homme, activite: 'sedentaire' }, { ...reglages, deficit: 0.25 }) // 1,2 × 0,75 < 1
    expect(b.apport).toBe(b.metabolisme)
  })
  it('maintien si le poids visé est atteint : déficit bloqué à 0', () => {
    const b = besoins({ ...homme, poidsVise: 90 }, reglages)
    expect(b.maintien).toBe(true)
    expect(b.deficitApplique).toBe(0)
    expect(b.apport).toBe(b.depense)
    expect(b.perteParSemaine).toBe(0)
  })
  it('plancher de 0,4 g/kg de protéines par repas principal', () => {
    // Inatteignable avec les réglages proposés (1,2 × 35 % = 0,42 g/kg) : testé directement.
    const jour = { g: 150, p: 1.2 * 50, l: 50 }
    const m = repasPrincipal(jour, 0.6, 50)
    expect(m.p).toBeCloseTo(20) // 0,4 × 50, au lieu de 18
    expect(m.g).toBeCloseTo(45 - 2) // 2 g de glucides retirés
    const petit = besoins({ sexe: 'femme', age: 30, taille: 150, poids: 50, poidsVise: 45, activite: 'sedentaire' }, { deficit: 0.15, proteinesGkg: 1.2, partRepas: 0.7 })
    expect(petit.repas.p).toBeGreaterThanOrEqual(0.4 * 45)
  })
  it('avertissement quand les glucides tombent sous 100 g par jour', () => {
    const p: Profil = { sexe: 'femme', age: 50, taille: 165, poids: 100, poidsVise: 85, activite: 'sedentaire' }
    expect(besoins(p, { deficit: 0.25, proteinesGkg: 2.2, partRepas: 0.75 }).glucidesBas).toBe(true)
    expect(besoins(homme, reglages).glucidesBas).toBe(false)
  })
  it('refus d’un poids visé sous IMC 18,5 et valeurs implausibles', () => {
    expect(verifierProfil({ ...homme, poidsVise: 58 })).toBeDefined() // IMC 17,9
    expect(verifierProfil(homme)).toBeUndefined()
    expect(verifierProfil({ ...homme, age: 15 })).toBeDefined()
    expect(verifierProfil({ ...homme, taille: 230 })).toBeDefined()
  })
  it('Mifflin-St Jeor femme', () => {
    expect(mifflin({ sexe: 'femme', poids: 65, taille: 165, age: 40 })).toBeCloseTo(1320.25)
  })
})
