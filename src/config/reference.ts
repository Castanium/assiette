// Base d'aliments de complément et constantes de calcul. Seul fichier de valeurs par défaut.
// Source des macros : table Ciqual (ANSES), valeurs moyennes arrondies, aliments cuits.

export type Macros = { g: number; p: number; l: number }
export type Categorie = 'proteine' | 'feculent' | 'gras' | 'legumes'
export type Cat = Exclude<Categorie, 'legumes'>

export type Aliment = {
  id: string
  nom: string
  categorie: Categorie
  pour100: Macros
  astuce?: string
}

// ---- Besoins (engine/profile.ts) ----
export const COEF_ACTIVITE = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725 }
export const DEFICIT = { defaut: 0.15, max: 0.25, pas: 0.05, plafondKcal: 750 }
export const PROTEINES_GKG = { standard: 1.2, muscle: 1.8, maximum: 2.2 }
export const PROTEINES_DEFAUT = PROTEINES_GKG.muscle
export const PARTS_REPAS = [0.7, 0.75, 0.8]
export const PART_REPAS_DEFAUT = 0.75
// Objectif choisi dans le profil : énergie et part des lipides (ANSES 2016 : lipides 35 à 40 % des kcal).
// Les glucides prennent le reste ; repas et collations gardent les proportions de la journée.
export const OBJECTIFS = {
  perte: { nom: 'Perte de poids', lipides: 0.35 }, // déficit réglable
  equilibre: { nom: 'Entre deux', lipides: 0.35 }, // maintien
  masse: { nom: 'Prise de masse', lipides: 0.3 }, // surplus
}
export const SURPLUS_MASSE = 0.1
export const LIPIDES_MIN_GKG = 0.8
export const PLANCHER_PROTEINES_REPAS_GKG = 0.4
export const GLUCIDES_BAS_JOUR = 100
export const KCAL_PAR_KG = 7700

// ---- Assiette (engine/plate.ts) ----
export const TOLERANCE = 0.1
export const ECART_ASSIETTE = 0.25
export const ASSIETTE_COPIEUSE_G = 650 // au-delà : note « assiette copieuse »
export const LEGUMES_G = 200
export const LEGUMES: Aliment = { id: 'legumes', nom: 'Légumes variés', categorie: 'legumes', pour100: { g: 4.5, p: 1.5, l: 0.3 } }
// (≈ 2,5 g de fibres et 25 kcal pour 100 g)

// ---- Collations : 1 à 2 fruits par jour ; un fruit de 150 g est déduit du budget ----
export const FRUIT_POUR100: Macros = { g: 12, p: 0.7, l: 0.3 } // fruit moyen (≈ 2 g de fibres)
export const FRUIT_G = 150

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
]

export const PREFERES: Record<Cat, string> = { proteine: 'poulet', feculent: 'riz', gras: 'olive' }

// Idées de collations, purement indicatives, par tranche de kcal restantes après le fruit.
// Toutes incluent un fruit, ou se prennent avec.
export const IDEES_COLLATIONS: { jusqua: number; idees: string[] }[] = [
  { jusqua: 250, idees: ['Un yaourt grec nature et un fruit', 'Un fromage blanc et un fruit', 'Un fruit et une petite poignée d’amandes'] },
  { jusqua: 450, idees: ['Un yaourt grec, un fruit et une poignée d’oléagineux', 'Un fromage blanc, des flocons d’avoine et un fruit', 'Un fruit, une tartine de pain complet et un œuf dur'] },
  { jusqua: Infinity, idees: ['Un fromage blanc, des flocons d’avoine et un fruit', 'Un yaourt grec, une poignée d’oléagineux et une banane', 'Un fruit, une tartine de pain complet et du houmous'] },
]
