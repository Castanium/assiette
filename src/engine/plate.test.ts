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
  it('budget hors légumes : G 86,25 / L 23,4', () => {
    expect(budget.g - r.legumes.apport.g).toBeCloseTo(86.25)
    expect(budget.l - r.legumes.apport.l).toBeCloseTo(23.4)
  })
  it('330 g, limité par les glucides', () => {
    expect(r.quantite).toBe(330) // 86,25 / 0,26 = 331,7 → 330 (lipides : 23,4 / 0,06 = 390)
    expect(r.limitante).toBe('g')
  })
  it('poulet pour le reste des protéines, ni féculent ni huile', () => {
    // reste P = 51 − 23,1 = 27,9 g → 27,9 / 0,29 = 96,2 → 95 g ; reste L = 23,4 − 19,8 − 2,85 ≈ 0,75 g → huile < 3 g
    expect(grammes(r, 'proteine')).toBe(95)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(grammes(r, 'gras')).toBeUndefined()
    expect(r.verifierSaisie).toBe(false)
  })
  it('avec la tolérance par défaut de 10 % : 360 g', () => {
    expect(equilibrer(entree(gyozas, { tolerance: 0.1 })).quantite).toBe(360) // 94,9 / 0,26 = 364,9 → 360
  })
})

describe('légumes', () => {
  it('200 g par repas, macros retirées du budget avant le calcul du plat', () => {
    const r = equilibrer(entree({ g: 50, p: 5, l: 1 }))
    expect(r.legumes.grammes).toBe(200)
    expect(r.legumes.apport).toEqual({ g: 9, p: 3, l: expect.closeTo(0.6) })
    expect(r.quantite).toBe(Math.floor((budget.g - 9) / 0.5 / 5) * 5)
  })
})

describe('protéines', () => {
  it('plat plus protéiné que le budget : pas de limite, mention positive, féculent réduit', () => {
    const steak: Macros = { g: 10, p: 25, l: 8 }
    const r = equilibrer(entree(steak))
    expect(r.limitante).toBe('l')
    expect(r.quantite).toBe(290) // lipides : 23,4 / 0,08 = 292,5
    expect(r.plat.p).toBeGreaterThan(budget.p)
    expect(r.proteinesAuDessus).toBe(true)
    expect(grammes(r, 'proteine')).toBeUndefined()
    // dette : 72,5 − 51 = 21,5 g de protéines en trop → (86,25 − 29 − 21,5) / 0,29 = 123 → 125 g
    // (sans la dette, il faudrait ≈ 195 g de riz)
    expect(grammes(r, 'feculent')).toBe(125)
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
    expect(r.quantite).toBe(460) // 51 / 0,11 = 463,6
  })
  it('mode inverse avec dépassement', () => {
    const r = equilibrer(entree(gyozas, { quantiteImposee: 400 }))
    expect(r.quantite).toBe(400)
    expect(r.depassement.g).toBeCloseTo(104 - 86.25)
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
    expect(equilibrer(entree(gyozas, { quantiteImposee: 330 })).verifierSaisie).toBe(false)
  })
})

describe('assiette copieuse et poids total', () => {
  it('plus de 650 g : note copieuse, poids total = plat + compléments + légumes', () => {
    const soupe: Macros = { g: 10, p: 3, l: 2 } // peu dense : 860 g de plat
    const r = equilibrer(entree(soupe))
    expect(r.quantite).toBe(860)
    expect(grammes(r, 'proteine')).toBe(85)
    expect(grammes(r, 'gras')).toBe(5)
    expect(r.poidsTotal).toBe(860 + 85 + 5 + 200)
    expect(r.copieuse).toBe(true)
  })
  it('gyozas : 330 + 95 + 200 = 625 g, pas copieuse', () => {
    const r = equilibrer(entree(gyozas))
    expect(r.poidsTotal).toBe(625)
    expect(r.copieuse).toBe(false)
  })
})

describe('macros manquantes', () => {
  it('égales au budget moins le plat et les légumes', () => {
    const r = equilibrer(entree(gyozas))
    for (const k of ['g', 'p', 'l'] as const)
      expect(r.manque[k]).toBeCloseTo(Math.max(0, budget[k] - r.plat[k] - r.legumes.apport[k]))
    expect(r.manque.p).toBeCloseTo(27.9)
    expect(r.manque.l).toBeCloseTo(3.6)
  })
  it('cohérentes avec les compléments proposés', () => {
    const r = equilibrer(entree({ g: 10, p: 3, l: 2 }))
    const [prot, gras] = r.complements
    // la protéine vise tout le manque de protéines et le couvre à l'arrondi de 5 g près
    expect(prot.vise).toEqual({ macro: 'p', grammes: expect.closeTo(r.manque.p) })
    expect(Math.abs(prot.apport.p - r.manque.p)).toBeLessThanOrEqual(2.5 * 0.29)
    // la matière grasse vise le manque de lipides moins ce que la protéine apporte déjà
    expect(gras.vise).toEqual({ macro: 'l', grammes: expect.closeTo(r.manque.l - prot.apport.l) })
  })
  it('jamais négatives en cas de dépassement', () => {
    const r = equilibrer(entree(gyozas, { quantiteImposee: 400 }))
    expect(r.manque.g).toBe(0)
    expect(r.depassement.g).toBeGreaterThan(0)
  })
})
