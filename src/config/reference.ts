// Seul fichier de valeurs par défaut. Valeurs génériques, réglables dans « Réglages ».
// Source des macros : table Ciqual (ANSES), valeurs moyennes arrondies, aliments cuits.

export type Macros = { g: number; p: number; l: number }
export type Repas = 'dejeuner' | 'diner'
export type Categorie = 'proteine' | 'feculent' | 'gras' | 'legumes'

export type Aliment = {
  id: string
  nom: string
  categorie: Categorie
  pour100: Macros
  astuce?: string
}

export type Portions = {
  proteines: Macros
  feculents: Macros
  fromage: Macros
  pain: Macros
  gras: Record<Repas, Macros>
}

export const PORTIONS: Portions = {
  proteines: { g: 0, p: 20, l: 5 },
  feculents: { g: 30, p: 4, l: 1 },
  fromage: { g: 0, p: 7, l: 8 },
  pain: { g: 15, p: 2.5, l: 0.5 },
  gras: { dejeuner: { g: 0, p: 0, l: 10 }, diner: { g: 0, p: 0, l: 10 } },
}

export const TOLERANCE = 0.1
export const LEGUMES_G = 200
export const REPARTITION: Record<Repas, number> = { dejeuner: 0.35, diner: 0.3 }

const COMPLET = 'Choisis-le complet ou semi-complet si tu peux.'

export const COMPLEMENTS: Aliment[] = [
  { id: 'poulet', nom: 'Blanc de poulet', categorie: 'proteine', pour100: { g: 0, p: 29, l: 3 } },
  { id: 'poisson', nom: 'Poisson blanc', categorie: 'proteine', pour100: { g: 0, p: 21, l: 1 } },
  { id: 'saumon', nom: 'Saumon', categorie: 'proteine', pour100: { g: 0, p: 24, l: 13 } },
  { id: 'oeuf', nom: 'Œuf', categorie: 'proteine', pour100: { g: 0, p: 13, l: 10 } },
  { id: 'jambon', nom: 'Jambon blanc', categorie: 'proteine', pour100: { g: 1, p: 21, l: 3 } },
  { id: 'tofu', nom: 'Tofu', categorie: 'proteine', pour100: { g: 2, p: 13, l: 8 } },
  { id: 'cottage', nom: 'Cottage cheese', categorie: 'proteine', pour100: { g: 3, p: 11, l: 4.5 } },
  { id: 'riz', nom: 'Riz cuit', categorie: 'feculent', pour100: { g: 29, p: 3, l: 1 }, astuce: COMPLET },
  { id: 'pates', nom: 'Pâtes cuites', categorie: 'feculent', pour100: { g: 30, p: 5, l: 1 }, astuce: COMPLET },
  { id: 'semoule', nom: 'Semoule cuite', categorie: 'feculent', pour100: { g: 24, p: 4, l: 1 }, astuce: COMPLET },
  { id: 'quinoa', nom: 'Quinoa cuit', categorie: 'feculent', pour100: { g: 20, p: 4, l: 2 } },
  { id: 'pdt', nom: 'Pomme de terre', categorie: 'feculent', pour100: { g: 18, p: 2, l: 0 } },
  { id: 'patate', nom: 'Patate douce', categorie: 'feculent', pour100: { g: 19, p: 2, l: 0 } },
  { id: 'pain', nom: 'Pain complet', categorie: 'feculent', pour100: { g: 43, p: 9, l: 2 } },
  { id: 'lentilles', nom: 'Lentilles cuites', categorie: 'feculent', pour100: { g: 17, p: 9, l: 0.5 } },
  { id: 'colza', nom: 'Huile de colza', categorie: 'gras', pour100: { g: 0, p: 0, l: 100 } },
  { id: 'olive', nom: "Huile d'olive", categorie: 'gras', pour100: { g: 0, p: 0, l: 100 } },
  { id: 'avocat', nom: 'Avocat', categorie: 'gras', pour100: { g: 2, p: 2, l: 20 } },
  { id: 'creme', nom: 'Crème fraîche légère', categorie: 'gras', pour100: { g: 4, p: 3, l: 15 } },
  { id: 'legumes', nom: 'Légumes variés', categorie: 'legumes', pour100: { g: 4, p: 2, l: 0 } },
]

export const PREFERES: Record<Exclude<Categorie, 'legumes'>, string> = {
  proteine: 'poulet',
  feculent: 'riz',
  gras: 'olive',
}
