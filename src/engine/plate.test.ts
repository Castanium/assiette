import { describe, expect, it } from 'vitest'
import { COMPLEMENTS, PORTIONS, type Aliment, type Macros } from '../config/reference'
import { budgetRepas, equilibrer, normaliser, pastilles, nombre, type Entree } from './plate'

const al = (id: string) => COMPLEMENTS.find((a) => a.id === id)!
const portionProteines: Aliment = { id: 't', nom: 'Portion protéines', categorie: 'proteine', pour100: { g: 0, p: 20, l: 5 } }
const complements = { proteine: portionProteines, feculent: al('riz'), gras: al('olive'), legumes: al('legumes') }
const gyozas: Macros = { g: 26, p: 7, l: 6 }
const dej = budgetRepas(PORTIONS, 'dejeuner', false)
const entree = (pour100: Macros, extra: Partial<Entree> = {}): Entree => ({
  budget: dej, pour100, tolerance: 0, complements, ...extra,
})
const grammes = (r: ReturnType<typeof equilibrer>, cat: string) =>
  r.complements.find((c) => c.aliment.categorie === cat)?.grammes

describe('acceptation : gyozas au déjeuner', () => {
  const r = equilibrer(entree(gyozas))
  it('budget G30 P24 L16', () => expect(dej).toEqual({ g: 30, p: 24, l: 16 }))
  it('115 g, limité par les glucides', () => {
    expect(r.quantite).toBe(115)
    expect(r.limitante).toBe('g')
  })
  it('80 g de protéines, pas de féculent, 5 g d’huile, 200 g de légumes', () => {
    expect(grammes(r, 'proteine')).toBe(80)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(grammes(r, 'gras')).toBe(5)
    expect(r.legumes.grammes).toBe(200)
    expect(r.verifierSaisie).toBe(false)
  })
})

describe('calcul', () => {
  it('tolérance de 10 % appliquée au calcul de q', () => {
    expect(equilibrer(entree(gyozas, { tolerance: 0.1 })).quantite).toBe(125)
  })
  it('aliment sans glucides : féculent proposé', () => {
    const r = equilibrer(entree({ g: 0, p: 26, l: 10 }))
    expect(r.limitante).toBe('p')
    expect(r.quantite).toBe(90)
    expect(grammes(r, 'feculent')).toBe(105) // 30 g de G / 0,29
  })
  it('aliment à 0 partout : erreur claire', () => {
    expect(() => equilibrer(entree({ g: 0, p: 0, l: 0 }))).toThrow()
    expect(normaliser(100, { g: 0, p: 0, l: 0 }).erreur).toMatch(/0/)
  })
  it('« pour 150 g » converti pour 100 g', () => {
    expect(normaliser(150, { g: 39, p: 10.5, l: 9 }).pour100).toEqual(gyozas)
  })
  it('virgule acceptée', () => expect(nombre('7,5')).toBe(7.5))
  it('mode inverse avec dépassement', () => {
    const r = equilibrer(entree(gyozas, { quantiteImposee: 150 }))
    expect(r.quantite).toBe(150)
    expect(r.depassement.g).toBeCloseTo(9)
    expect(r.depassement.p).toBe(0)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(r.conseils.join(' ')).toMatch(/Pas de féculents en plus/)
  })
  it('dîner avec fromage + pain', () => {
    const b = budgetRepas(PORTIONS, 'diner', true)
    expect(b).toEqual({ g: 45, p: 33.5, l: 24.5 })
    const r = equilibrer(entree(gyozas, { budget: b }))
    expect(r.quantite).toBe(170)
  })
})

describe('garde-fous', () => {
  it('légumes jamais sous 200 g, même si le plat est un plat de légumes', () => {
    const r = equilibrer(entree({ g: 5, p: 2, l: 3 }))
    expect(r.legumes.grammes).toBe(200)
  })
  it('protéine toujours proposée si le plat en apporte moins de la moitié', () => {
    const r = equilibrer(entree({ g: 30, p: 1, l: 2 }))
    expect(r.plat.p).toBeLessThan(12)
    expect(grammes(r, 'proteine')).toBeGreaterThan(0)
  })
  it('protéine proposée même pour un petit reste quand le plat est pauvre en protéines', () => {
    const r = equilibrer(entree({ g: 50, p: 1, l: 1 }, { budget: { g: 30, p: 1.5, l: 10 } }))
    expect(grammes(r, 'proteine')).toBe(5)
  })
  it('portion < 50 g signalée comme très dense', () => {
    const r = equilibrer(entree({ g: 70, p: 6, l: 30 }))
    expect(r.quantite).toBeLessThan(50)
    expect(r.tresDense).toBe(true)
  })
  it('saisie incohérente refusée', () => {
    expect(normaliser(100, { g: 60, p: 30, l: 20 }).erreur).toBeDefined()
    expect(normaliser(100, { g: -1, p: 3, l: 2 }).erreur).toBeDefined()
    expect(normaliser(0, { g: 1, p: 3, l: 2 }).erreur).toBeDefined()
  })
  it('total hors 350–750 kcal : vérifier la saisie', () => {
    // valeurs saisies « pour la portion » au lieu de 100 g : le mode inverse explose
    expect(equilibrer(entree(gyozas, { quantiteImposee: 600 })).verifierSaisie).toBe(true)
    expect(equilibrer(entree(gyozas, { budget: { g: 5, p: 5, l: 2 } })).verifierSaisie).toBe(true)
  })
  it('pastilles qualité et conseil sucré', () => {
    const q = pastilles({ sucres: 30, sel: 2, satures: 6, fibres: 7, nutriscore: 'd', nova: 4 })
    expect(q.pastilles.map((p) => p.texte)).toEqual([
      'Très sucré', 'Très salé', 'Riche en graisses saturées', 'Riche en fibres', 'Nutri-Score D', 'NOVA 4',
    ])
    expect(q.conseil).toBeDefined()
    expect(pastilles({}).pastilles).toEqual([])
  })
})
