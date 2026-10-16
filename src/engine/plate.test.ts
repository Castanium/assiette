import { describe, expect, it } from 'vitest'
import { COMPLEMENTS, LEGUMES, type Macros } from '../config/reference'
import { equilibrer, nombre, normaliser, type Entree } from './plate'
import { besoins } from './profile'
const homme = { sexe: 'homme', age: 35, taille: 180, poids: 90, poidsVise: 80, activite: 'leger' } as const
const reglages = { deficit: 0.15, proteinesGkg: 1.8, partRepas: 0.75 }

const al = (id: string) => COMPLEMENTS.find((a) => a.id === id)!
const budget = besoins(homme, reglages).repas // ≈ G 78,1 / P 54 / L 31,6 (perte de poids)
const complements = { proteine: al('poulet'), feculent: al('riz'), gras: al('olive') }
const gyozas: Macros = { g: 26, p: 7, l: 6 }
const entree = (pour100: Macros, extra: Partial<Entree> = {}): Entree => ({
  budget, pour100, tolerance: 0, complements, legumes: LEGUMES, ...extra,
})
const grammes = (r: ReturnType<typeof equilibrer>, cat: string) => r.complements.find((c) => c.aliment.categorie === cat)?.grammes

describe('acceptation : gyozas avec le profil type', () => {
  const r = equilibrer(entree(gyozas))
  it('budget hors légumes : G 69,1 / L 31', () => {
    expect(budget.g - r.legumes.apport.g).toBeCloseTo(69.1, 1)
    expect(budget.l - r.legumes.apport.l).toBeCloseTo(31, 1)
  })
  it('265 g, limité par les glucides', () => {
    expect(r.quantite).toBe(265) // 69,1 / 0,26 = 265,8 → 265 (lipides : 31 / 0,06 = 517)
    expect(r.limitante).toBe('g')
  })
  it('poulet pour le reste des protéines, pas de féculent, un peu d’huile', () => {
    // reste P = 51 − 18,55 = 32,45 g → 112 → 110 g ; reste L = 31 − 15,9 − 3,3 = 11,8 g → 10 g d'huile
    expect(grammes(r, 'proteine')).toBe(110)
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(grammes(r, 'gras')).toBe(10)
    expect(r.verifierSaisie).toBe(false)
  })
  it('avec la tolérance par défaut de 10 % : 290 g', () => {
    expect(equilibrer(entree(gyozas, { tolerance: 0.1 })).quantite).toBe(290) // 76 / 0,26 = 292,4 → 290
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
    expect(r.quantite).toBe(385) // lipides : 31 / 0,08 = 388
    expect(r.plat.p).toBeGreaterThan(budget.p)
    expect(r.proteinesAuDessus).toBe(true)
    expect(grammes(r, 'proteine')).toBeUndefined()
    // dette : 96,25 − 51 = 45 g de protéines en trop, plus que les 30,6 g de glucides restants → pas de riz
    // (sans la dette, il faudrait ≈ 105 g de riz)
    expect(grammes(r, 'feculent')).toBeUndefined()
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
    expect(r.depassement.g).toBeCloseTo(104 - (budget.g - 9))
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
    const soupe: Macros = { g: 10, p: 3, l: 2 } // peu dense : 690 g de plat
    const r = equilibrer(entree(soupe))
    expect(r.quantite).toBe(690)
    expect(grammes(r, 'proteine')).toBe(105)
    expect(grammes(r, 'gras')).toBe(15)
    expect(r.poidsTotal).toBe(690 + 105 + 15 + 200)
    expect(r.copieuse).toBe(true)
  })
  it('gyozas : 265 + 110 + 10 + 200 = 585 g, pas copieuse', () => {
    const r = equilibrer(entree(gyozas))
    expect(r.poidsTotal).toBe(585)
    expect(r.copieuse).toBe(false)
  })
})

describe('macros manquantes', () => {
  it('égales au budget moins le plat et les légumes', () => {
    const r = equilibrer(entree(gyozas))
    for (const k of ['g', 'p', 'l'] as const)
      expect(r.manque[k]).toBeCloseTo(Math.max(0, budget[k] - r.plat[k] - r.legumes.apport[k]))
    expect(r.manque.p).toBeCloseTo(32.45, 1)
    expect(r.manque.l).toBeCloseTo(15.1, 1)
  })
  it('cohérentes avec les compléments proposés', () => {
    const r = equilibrer(entree({ g: 10, p: 3, l: 2 }))
    const [prot, gras] = r.complements
    // la protéine vise tout le manque de protéines et le couvre à l'arrondi de 5 g près
    expect(prot.vise).toEqual({ macro: 'p', grammes: expect.closeTo(r.manque.p) })
    expect(Math.abs(prot.apport.p - r.manque.p)).toBeLessThanOrEqual(2.5 * 0.29)
    // la matière grasse vise le manque de lipides moins ce que la protéine apporte déjà
    expect(gras.vise).toEqual({ macro: 'l', grammes: expect.closeTo(r.manque.l - prot.apport.l, 1) }) // à la petite dette protéinée près
  })
  it('jamais négatives en cas de dépassement', () => {
    const r = equilibrer(entree(gyozas, { quantiteImposee: 400 }))
    expect(r.manque.g).toBe(0)
    expect(r.depassement.g).toBeGreaterThan(0)
  })
})

describe('v1.4.1 : les trois macros du plat sont déduites des compléments', () => {
  const sauce: Macros = { g: 10, p: 12, l: 20 } // limité par les lipides
  const pates: Macros = { g: 60, p: 10, l: 3 } // limité par les glucides
  const viande: Macros = { g: 2, p: 30, l: 8 } // très protéiné
  const dispo = (r: ReturnType<typeof equilibrer>) => ({
    g: budget.g - r.legumes.apport.g, p: budget.p - r.legumes.apport.p, l: budget.l - r.legumes.apport.l,
  })
  const vise = (r: ReturnType<typeof equilibrer>, cat: string) => r.complements.find((c) => c.aliment.categorie === cat)?.vise?.grammes

  it('limité par les lipides : protéine et féculent visent le reste après le plat', () => {
    const r = equilibrer(entree(sauce))
    const d = dispo(r)
    expect(r.limitante).toBe('l')
    expect(r.quantite).toBe(155) // 31 / 0,2 = 155
    // féculent : glucides restants après le plat (à la petite dette protéinée près)
    expect(vise(r, 'feculent')).toBeCloseTo(d.g - r.plat.g, 0)
    // protéine : reste après le plat et les protéines du riz
    const riz = r.complements.find((c) => c.aliment.categorie === 'feculent')!
    expect(vise(r, 'proteine')).toBeCloseTo(d.p - r.plat.p - riz.apport.p)
    expect(grammes(r, 'gras')).toBeUndefined() // le plat a pris les lipides
  })
  it('limité par les glucides : pas de féculent, protéine et huile après le plat', () => {
    const r = equilibrer(entree(pates))
    const d = dispo(r)
    expect(r.limitante).toBe('g')
    expect(r.quantite).toBe(115) // 69,1 / 0,6 = 115,2
    expect(grammes(r, 'feculent')).toBeUndefined()
    expect(vise(r, 'proteine')).toBeCloseTo(d.p - r.plat.p)
    const prot = r.complements[0]
    expect(vise(r, 'gras')).toBeCloseTo(d.l - r.plat.l - prot.apport.l, 0)
  })
  it('très protéiné : limité par les lipides, pas de protéine, mention positive', () => {
    const r = equilibrer(entree(viande))
    expect(r.limitante).toBe('l')
    expect(r.quantite).toBe(385) // 31 / 0,08 = 388
    expect(r.manque.l).toBeCloseTo(dispo(r).l - r.plat.l)
    expect(r.manque.g).toBeCloseTo(dispo(r).g - r.plat.g)
    expect(grammes(r, 'proteine')).toBeUndefined()
    expect(r.proteinesAuDessus).toBe(true)
  })
  it('protéines du féculent déduites de la protéine', () => {
    // sans cette déduction : 37,2 / 0,29 = 128 → 130 g de poulet
    expect(grammes(equilibrer(entree(sauce)), 'proteine')).toBe(95)
  })
  it('note si les lipides des compléments font dépasser', () => {
    const r = equilibrer(entree(sauce, { complements: { ...complements, proteine: al('saumon') } }))
    expect(r.total.l).toBeGreaterThan(budget.l + 5)
    expect(r.conseils.join(' ')).toMatch(/plus de lipides que prévu/)
  })

  it('invariant : plat + légumes + compléments ≈ budget (± 5 g), mode normal et inverse', () => {
    const cas = [sauce, pates, viande, gyozas, { g: 10, p: 3, l: 2 }]
    for (const pour100 of cas)
      for (const quantiteImposee of [undefined, 100, 250]) {
        const r = equilibrer(entree(pour100, { quantiteImposee }))
        const dette = r.plat.p + r.legumes.apport.p > budget.p // protéines du plat en trop : retirées des glucides puis des lipides
        for (const k of ['g', 'p', 'l'] as const) {
          if (r.depassement[k] > 0.5) continue // le plat seul dépasse déjà
          const ecart = r.total[k] - budget[k]
          if (k !== 'p') expect(ecart, `${k} ${JSON.stringify(pour100)} ${quantiteImposee}`).toBeLessThanOrEqual(5)
          if (!dette) expect(ecart, `${k} ${JSON.stringify(pour100)} ${quantiteImposee}`).toBeGreaterThanOrEqual(-5)
        }
      }
  })
})
