import { describe, expect, it } from 'vitest'
import { COMPLEMENTS, LEGUMES, type Macros } from '../config/reference'
import { equilibrer, nombre, normaliser, type Entree } from './plate'
import { besoins } from './profile'
const homme = { sexe: 'homme', age: 35, taille: 180, poids: 90, poidsVise: 80, activite: 'leger' } as const
const reglages = { deficit: 0.15, proteinesGkg: 1.8, partRepas: 0.75 }

const al = (id: string) => COMPLEMENTS.find((a) => a.id === id)!
const budget = besoins(homme, reglages).repas // ≈ G 95,25 / P 54 / L 24
const complements = { proteine: al('poulet'), feculent: al('riz'), gras: al('olive') }
const gyozas: Macros = { g: 26, p: 7, l: 6 }
const entree = (pour100: Macros, extra: Partial<Entree> = {}): Entree => ({
  budget, pour100, tolerance: 0, complements, legumes: LEGUMES, ...extra,
})
const grammes = (r: ReturnType<typeof equilibrer>, cat: string) => r.complements.find((c) => c.aliment.categorie === cat)?.grammes

describe('acceptation : gyozas avec le profil type', () => {
  const r = equilibrer(entree(gyozas))
  it('budget hors légumes : G 81,75 / L 23,1', () => {
    expect(budget.g - r.legumes.apport.g).toBeCloseTo(81.75)
    expect(budget.l - r.legumes.apport.l).toBeCloseTo(23.1)
  })
  it('310 g, limité par les glucides', () => {
    expect(r.quantite).toBe(310) // 81,75 / 0,26 = 314 → 310
    expect(r.limitante).toBe('g')
  })
  it('poulet pour le reste des protéines, ni féculent ni huile', () => {
    // reste P = 49,5 − 21,7 = 27,8 g → 27,8 / 0,29 = 96 → 95 g ; reste L ≈ 1,65 g → huile < 3 g
    expect(grammes(r, 'proteine')).toBe(95)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(grammes(r, 'gras')).toBeUndefined()
    expect(r.verifierSaisie).toBe(false)
  })
  it('avec la tolérance par défaut de 10 % : 345 g', () => {
    expect(equilibrer(entree(gyozas, { tolerance: 0.1 })).quantite).toBe(345)
  })
})

describe('légumes', () => {
  it('300 g par repas, macros retirées du budget avant le calcul du plat', () => {
    const r = equilibrer(entree({ g: 50, p: 5, l: 1 }))
    expect(r.legumes.grammes).toBe(300)
    expect(r.legumes.apport).toEqual({ g: 13.5, p: 4.5, l: expect.closeTo(0.9) })
    expect(r.quantite).toBe(Math.floor((budget.g - 13.5) / 0.5 / 5) * 5)
  })
})

describe('protéines', () => {
  it('plat plus protéiné que le budget : pas de limite, mention positive, féculent réduit', () => {
    const steak: Macros = { g: 10, p: 25, l: 8 }
    const r = equilibrer(entree(steak))
    expect(r.limitante).toBe('l')
    expect(r.quantite).toBe(285)
    expect(r.plat.p).toBeGreaterThan(budget.p)
    expect(r.proteinesAuDessus).toBe(true)
    expect(grammes(r, 'proteine')).toBeUndefined()
    // sans la dette protéinée, il faudrait (81,75 − 28,5) / 0,29 ≈ 185 g de riz
    expect(grammes(r, 'feculent')).toBe(110)
  })
  it('protéine toujours proposée si le plat en couvre moins de la moitié', () => {
    const r = equilibrer(entree({ g: 30, p: 1, l: 2 }))
    expect(r.plat.p).toBeLessThan(budget.p / 2)
    expect(grammes(r, 'proteine')).toBeGreaterThan(0)
  })
  it('pas de mention quand les protéines sont juste atteintes', () => {
    expect(equilibrer(entree(gyozas)).proteinesAuDessus).toBe(false)
  })
})

describe('calcul et saisie', () => {
  it('aliment à 0 partout : erreur claire', () => {
    expect(() => equilibrer(entree({ g: 0, p: 0, l: 0 }))).toThrow()
    expect(normaliser(100, { g: 0, p: 0, l: 0 }).erreur).toMatch(/0/)
  })
  it('« pour 150 g » converti pour 100 g', () => {
    expect(normaliser(150, { g: 39, p: 10.5, l: 9 }).pour100).toEqual(gyozas)
  })
  it('virgule acceptée', () => expect(nombre('7,5')).toBe(7.5))
  it('aliment sans glucides ni lipides : limité par les protéines', () => {
    const r = equilibrer(entree({ g: 0, p: 11, l: 0 }))
    expect(r.limitante).toBe('p')
    expect(r.quantite).toBe(450) // 49,5 / 0,11
  })
  it('mode inverse avec dépassement', () => {
    const r = equilibrer(entree(gyozas, { quantiteImposee: 400 }))
    expect(r.quantite).toBe(400)
    expect(r.depassement.g).toBeCloseTo(104 - 81.75)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(r.conseils.join(' ')).toMatch(/Pas de féculents en plus/)
  })
  it('portion < 50 g signalée comme très dense', () => {
    const r = equilibrer(entree({ g: 70, p: 6, l: 25 }, { budget: { g: 40, p: 30, l: 10 } }))
    expect(r.quantite).toBeLessThan(50)
    expect(r.tresDense).toBe(true)
  })
  it('saisie incohérente refusée', () => {
    expect(normaliser(100, { g: 60, p: 30, l: 20 }).erreur).toBeDefined()
    expect(normaliser(100, { g: -1, p: 3, l: 2 }).erreur).toBeDefined()
    expect(normaliser(0, { g: 1, p: 3, l: 2 }).erreur).toBeDefined()
  })
  it('alerte si le total s’écarte de plus de 25 % de l’assiette type', () => {
    expect(equilibrer(entree(gyozas, { quantiteImposee: 700 })).verifierSaisie).toBe(true)
    expect(equilibrer(entree(gyozas, { quantiteImposee: 310 })).verifierSaisie).toBe(false)
  })
})
