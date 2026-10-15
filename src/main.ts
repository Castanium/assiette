import './styles.css'
import logoSvg from './assets/logo.svg?raw'
import { type Aliment, type Categorie, type Macros, type Repas } from './config/reference'
import {
  MACROS, NOM_MACRO, budgetRepas, cuilleres, equilibrer, kcal, nombre, normaliser, pastilles,
  type Macro, type Qualite, type Resultat,
} from './engine/plate'
import { ecart, estimer, verifierProfil, type Activite, type Profil, type Sexe } from './engine/profile'
import { chercherProduit, demarrerCamera } from './scan/scan'
import { charger, defauts, fusionner, sauver, type DernierAliment } from './store'

type Ecran = 'saisie' | 'resultat' | 'reglages' | 'profil' | 'apropos'
type Cat = Exclude<Categorie, 'legumes'>
type QualiteTexte = Record<'sucres' | 'sel' | 'satures' | 'fibres', string>

let donnees = charger()
const vide: DernierAliment = { nom: '', quantiteRef: '100', g: '', p: '', l: '' }
const s = {
  ecran: 'saisie' as Ecran,
  repas: (new Date().getHours() < 15 ? 'dejeuner' : 'diner') as Repas,
  mode: 'manuel' as 'manuel' | 'scan',
  aliment: { ...vide, ...donnees.dernierAliment } as DernierAliment,
  qualite: { sucres: '', sel: '', satures: '', fibres: '' } as QualiteTexte,
  extra: {} as Pick<Qualite, 'nutriscore' | 'nova'>,
  fromagePain: false,
  imposer: false,
  quantiteImposee: '',
  code: '',
  erreur: '',
  info: '',
  choix: { ...donnees.reglages.preferes },
  pour100: { g: 0, p: 0, l: 0 } as Macros,
  profil: profilTexte(donnees.profil),
  profilErreur: '',
}
const q0 = donnees.dernierAliment?.qualite
if (q0) {
  for (const k of ['sucres', 'sel', 'satures', 'fibres'] as const) s.qualite[k] = q0[k] != null ? fr(q0[k]!) : ''
  s.extra = { nutriscore: q0.nutriscore, nova: q0.nova }
}
let arreterCamera: (() => void) | undefined

// ---------- Utilitaires ----------
function fr(n: number, dec = 1) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: dec })
}
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const NOM_REPAS: Record<Repas, string> = { dejeuner: 'Déjeuner', diner: 'Dîner' }
const NOM_CAT: Record<Cat, string> = { proteine: 'Protéines', feculent: 'Féculents', gras: 'Matières grasses' }
const deLiaison = (nom: string) => {
  const n = nom.trim()
  if (!n) return 'de ce plat'
  const m = n.charAt(0).toLowerCase() + n.slice(1)
  return /^[aeiouyhàâéèêëîïôûœ]/i.test(m) ? `d’${m}` : `de ${m}`
}
const ICONE = {
  reglages: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.4"/><circle cx="10" cy="17" r="2.4"/></svg>',
  retour: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  scan: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M12 9v6M16 9v6"/></svg>',
  changer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
}
const message = (texte: string, type: 'erreur' | 'info') =>
  texte ? `<p class="message ${type} o2" role="${type === 'erreur' ? 'alert' : 'status'}">${esc(texte)}</p>` : ''
const champNombre = (attr: string, valeur: string, label: string, unite = 'g', cls = '') => `
  <label class="champ ${cls}">${label}
    <span class="saisie"><input type="text" inputmode="decimal" autocomplete="off" ${attr} value="${esc(valeur)}"><span class="unite">${unite}</span></span>
  </label>`
const enTete = (titre: string) => `
  <header class="entete"><button type="button" class="rond press" data-a="retour" aria-label="Retour">${ICONE.retour}</button><h2>${titre}</h2></header>`

function profilTexte(p?: Profil) {
  return {
    poids: p ? fr(p.poids) : '', poidsVise: p ? fr(p.poidsVise) : '', taille: p ? String(p.taille) : '',
    age: p ? String(p.age) : '', sexe: (p?.sexe ?? 'femme') as Sexe, activite: (p?.activite ?? 'leger') as Activite,
  }
}
const profilValide = () => (donnees.profil && !verifierProfil(donnees.profil) ? donnees.profil : undefined)
const utiliseProfil = () => donnees.reglages.source === 'profil' && !!profilValide()

function budgetActuel(): Macros {
  if (utiliseProfil()) return estimer(profilValide()!).repas[s.repas]
  return budgetRepas(donnees.reglages.portions, s.repas, s.fromagePain)
}
const complement = (id: string) => donnees.reglages.complements.find((c) => c.id === id)!
const parCategorie = (cat: Categorie) => donnees.reglages.complements.filter((c) => c.categorie === cat)
const qualiteSaisie = (): Qualite => {
  const n = (t: string) => (Number.isFinite(nombre(t)) ? nombre(t) : undefined)
  return { sucres: n(s.qualite.sucres), sel: n(s.qualite.sel), satures: n(s.qualite.satures), fibres: n(s.qualite.fibres), ...s.extra }
}

// ---------- Écran de saisie ----------
function ecranSaisie() {
  const a = s.aliment
  const formulaire = `
    <div class="carte o1">
      <label class="champ">Aliment
        <span class="saisie"><input type="text" data-k="nom" value="${esc(a.nom)}" placeholder="Gyozas poulet" autocomplete="off" enterkeyhint="next"></span>
      </label>
      ${champNombre('data-k="quantiteRef"', a.quantiteRef, 'Valeurs pour')}
      <div class="trio">
        ${champNombre('data-k="g"', a.g, 'Glucides', 'g', 'g')}
        ${champNombre('data-k="p"', a.p, 'Protéines', 'g', 'p')}
        ${champNombre('data-k="l"', a.l, 'Lipides', 'g', 'l')}
      </div>
      <details class="plus">
        <summary>Infos qualité (facultatif, pour 100 g)</summary>
        <div class="trio">
          ${champNombre('data-q="sucres"', s.qualite.sucres, 'dont sucres')}
          ${champNombre('data-q="sel"', s.qualite.sel, 'Sel')}
          ${champNombre('data-q="satures"', s.qualite.satures, 'dont saturés')}
          ${champNombre('data-q="fibres"', s.qualite.fibres, 'Fibres')}
        </div>
      </details>
    </div>`
  const scan = `
    <div class="camera o1"><video playsinline muted aria-label="Caméra"></video><button type="button" class="btn-doux press" data-a="camera">Activer la caméra</button></div>
    <div class="rangee o1">
      <label class="saisie"><span class="visuellement-cache">Code-barres</span><input type="text" inputmode="numeric" data-k="code" value="${esc(s.code)}" placeholder="Ou tape le code-barres" autocomplete="off"></label>
      <button type="button" class="btn-doux press" data-a="chercher">Chercher</button>
    </div>
    <p class="aide o1">Seul le code-barres est envoyé à Open Food Facts, rien d’autre.</p>`
  return `
  <main class="ecran deux">
    <div class="blob blob-d" aria-hidden="true"></div>
    <div class="col">
      <header class="entete">
        <span class="logo" aria-hidden="true">${logoSvg}</span><h1>Assiette</h1>
        <button type="button" class="rond press" data-a="reglages" aria-label="Réglages">${ICONE.reglages}</button>
      </header>
      <p class="question">Qu’est-ce qui te fait envie ?</p>
      <div class="bascule" role="group" aria-label="Repas">
        ${(['dejeuner', 'diner'] as Repas[]).map((r) => `<button type="button" class="press" data-a="repas" data-v="${r}" aria-pressed="${s.repas === r}">${NOM_REPAS[r]}</button>`).join('')}
      </div>
      <div class="modes" role="group" aria-label="Mode de saisie">
        <button type="button" class="btn-contour press" data-a="mode" data-v="manuel" aria-pressed="${s.mode === 'manuel'}">Saisie manuelle</button>
        <button type="button" class="btn-contour press" data-a="mode" data-v="scan" aria-pressed="${s.mode === 'scan'}">${ICONE.scan}Scanner</button>
      </div>
      ${utiliseProfil() ? '' : `<label class="coche o2"><input type="checkbox" data-k="fromagePain" ${s.fromagePain ? 'checked' : ''}>Fromage + pain à ce repas</label>`}
      <label class="coche o2"><input type="checkbox" data-k="imposer" ${s.imposer ? 'checked' : ''}>Je choisis ma quantité</label>
      ${s.imposer ? `<div class="o2">${champNombre('data-k="quantiteImposee"', s.quantiteImposee, 'Je mange')}</div>` : ''}
      ${message(s.erreur, 'erreur')}${message(s.info, 'info')}
      <div class="cta-zone o3"><button type="button" class="cta press" data-a="equilibrer">Équilibrer mon assiette</button></div>
    </div>
    <div class="col">
      ${s.mode === 'scan' ? scan : ''}
      ${formulaire}
    </div>
  </main>`
}

function equilibrerSaisie() {
  const a = s.aliment
  const res = normaliser(nombre(a.quantiteRef), { g: nombre(a.g), p: nombre(a.p), l: nombre(a.l) })
  if (res.erreur) return afficherErreur(res.erreur)
  if (s.imposer) {
    const q = nombre(s.quantiteImposee)
    if (!(q > 0 && q <= 2000)) return afficherErreur('Indique combien de grammes tu comptes manger.')
  }
  s.pour100 = res.pour100!
  s.erreur = s.info = ''
  donnees.dernierAliment = { ...a, qualite: qualiteSaisie() }
  sauver(donnees)
  s.choix = { ...donnees.reglages.preferes }
  aller('resultat')
}
function afficherErreur(t: string) {
  s.erreur = t
  s.info = ''
  rendre()
  document.querySelector('.message.erreur')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

async function lancerCamera() {
  const video = document.querySelector<HTMLVideoElement>('.camera video')
  if (!video) return
  document.querySelector('[data-a="camera"]')?.remove()
  try {
    arreterCamera = await demarrerCamera(video, (code) => {
      arreterCamera?.()
      s.code = code
      rechercher(code)
    })
  } catch {
    s.erreur = 'Caméra indisponible ou refusée. Tape le code-barres juste en dessous.'
    rendre()
  }
}
async function rechercher(code: string) {
  s.info = 'Je cherche ce produit…'
  s.erreur = ''
  rendre()
  const r = await chercherProduit(code.trim())
  stopperCamera()
  s.mode = 'manuel'
  if ('erreur' in r) {
    s.info = ''
    s.erreur = r.erreur
  } else {
    s.aliment = { nom: r.nom, quantiteRef: '100', g: fr(r.pour100.g), p: fr(r.pour100.p), l: fr(r.pour100.l) }
    for (const k of ['sucres', 'sel', 'satures', 'fibres'] as const) s.qualite[k] = r.qualite[k] != null ? fr(r.qualite[k]!) : ''
    s.extra = { nutriscore: r.qualite.nutriscore, nova: r.qualite.nova }
    s.info = `Trouvé${r.nom ? ` : ${r.nom}` : ''}. Valeurs pour 100 g, modifiables si besoin.`
  }
  rendre()
}
function stopperCamera() {
  arreterCamera?.()
  arreterCamera = undefined
}

// ---------- Écran de résultat ----------
function calculer(): Resultat {
  const c = (cat: Cat) => complement(s.choix[cat])
  return equilibrer({
    budget: budgetActuel(),
    pour100: s.pour100,
    tolerance: donnees.reglages.tolerance,
    complements: { proteine: c('proteine'), feculent: c('feculent'), gras: c('gras'), legumes: parCategorie('legumes')[0] },
    quantiteImposee: s.imposer ? nombre(s.quantiteImposee) : undefined,
  })
}

function ecranResultat() {
  const r = calculer()
  const nom = s.aliment.nom
  const dep = MACROS.some((k) => r.depassement[k] > 0.5)
  let verdict: string
  if (r.tresDense) {
    verdict = `
      <p class="chapeau">Ce plat est très dense pour ce repas</p>
      <p class="dense"><span>À partager !</span></p>
      <p class="plat">Prends-en juste une petite part, et fais le plein de légumes.</p>`
  } else {
    const pill = s.imposer
      ? dep ? 'Un peu au-dessus du budget, rien de grave' : 'Il reste de la place pour compléter'
      : r.limitante ? `Limité par les ${NOM_MACRO[r.limitante]}` : ''
    verdict = `
      <p class="chapeau">${s.imposer ? 'Tu manges' : 'Tu peux manger'}</p>
      <p class="chiffre"><span>${fr(r.quantite, 0)} g</span></p>
      <p class="plat">${esc(deLiaison(nom))}</p>
      ${pill ? `<span class="limite">${pill}</span>` : ''}`
  }
  const q = pastilles(qualiteSaisie())
  const lignes = r.complements.map((c) => {
    const cat = c.aliment.categorie as Cat
    const detail = cat === 'gras' && c.aliment.pour100.l >= 90 ? cuilleres(c.grammes) : c.aliment.astuce ? 'complet si possible' : ''
    return `
      <div class="ligne">
        <span class="puce ${cat}" aria-hidden="true"></span>
        <span class="nom">${esc(c.aliment.nom)}${detail ? `<small>${detail}</small>` : ''}</span>
        <span class="qte">${fr(c.grammes, 0)} g</span>
        <button type="button" class="changer press" data-a="changer" data-v="${cat}" aria-label="Changer de ${NOM_CAT[cat].toLowerCase()}">${ICONE.changer}</button>
      </div>`
  })
  lignes.push(`
    <div class="ligne sans-bouton">
      <span class="puce legumes" aria-hidden="true"></span><span class="nom">Légumes, à volonté</span><span class="qte">${r.legumes.grammes} g</span>
    </div>`)
  const notes = [...r.conseils]
  if (!r.complements.length) notes.unshift('Rien à ajouter, ton plat couvre tout : juste des légumes !')
  const fec = r.complements.find((c) => c.aliment.categorie === 'feculent')?.aliment.astuce
  if (fec) notes.push(fec)
  if (q.conseil) notes.push(q.conseil)
  if (r.tresDense) notes.unshift('Ajoute des légumes en plus, autant que tu veux.')
  notes.push(`Environ ${fr(r.totalKcal, 0)} kcal pour l’assiette complète, à titre indicatif.`)

  return `
  <main class="ecran deux">
    <div class="blob blob-g" aria-hidden="true"></div>
    <div class="col">
      <header class="entete entete-resultat">
        <button type="button" class="rond press" data-a="retour" aria-label="Retour">${ICONE.retour}</button>
        <span class="pastille-repas">${NOM_REPAS[s.repas]}${utiliseProfil() ? ' · profil' : ''}</span>
      </header>
      <section class="verdict" aria-live="polite">${verdict}</section>
      ${q.pastilles.length ? `<div class="pastilles">${q.pastilles.map((p) => `<span class="pastille ${p.ton}">${p.texte}</span>`).join('')}</div>` : ''}
      ${r.verifierSaisie ? message('Ce total paraît étonnant pour une assiette. Vérifie tes valeurs : sont-elles bien pour la quantité indiquée, et pas pour toute la portion ?', 'info') : ''}
      ${jauges(r)}
    </div>
    <div class="col">
      <p class="sous-titre o1">À compléter avec</p>
      <div class="liste o1">${lignes.join('')}</div>
      ${notes.map((n) => `<p class="note o1">${esc(n)}</p>`).join('')}
    </div>
  </main>`
}

function jauges(r: Resultat) {
  const compl = r.complements.reduce((m, c) => ({ g: m.g + c.apport.g, p: m.p + c.apport.p, l: m.l + c.apport.l }), { g: 0, p: 0, l: 0 })
  const nom: Record<Macro, string> = { g: 'Glucides', p: 'Protéines', l: 'Lipides' }
  return `
    <div class="jauges o3">
      ${MACROS.map((k) => {
        const total = r.plat[k] + compl[k]
        const max = Math.max(r.budget[k], total, 0.001)
        return `
        <div class="jauge ${k}" data-plat="${(r.plat[k] / max) * 100}" data-compl="${(compl[k] / max) * 100}">
          <div class="tete"><span>${nom[k]}</span><span>${fr(total, 0)} / ${fr(r.budget[k], 0)} g</span></div>
          <div class="piste" role="img" aria-label="${nom[k]} : ${fr(total, 0)} sur ${fr(r.budget[k], 0)} grammes"><span class="seg plat"></span><span class="seg compl"></span></div>
        </div>`
      }).join('')}
      <div class="legende"><span><i></i>le plat</span><span><i class="compl"></i>les compléments</span></div>
    </div>`
}

// Positions et décalages posés via le CSSOM (aucun attribut style, pour la CSP).
function animerResultat() {
  document.querySelectorAll<HTMLElement>('.ligne, .note').forEach((el, i) => (el.style.animationDelay = `${0.35 + i * 0.08}s`))
  document.querySelectorAll<HTMLElement>('.jauge').forEach((j) => {
    const p = Number(j.dataset.plat), c = Number(j.dataset.compl)
    const [plat, compl] = j.querySelectorAll<HTMLElement>('.seg')
    plat.style.width = `${p}%`
    plat.style.animationDelay = '.8s'
    compl.style.left = `${p}%`
    compl.style.width = `${c}%`
    compl.style.animationDelay = '1.2s'
    if (p <= 0) compl.style.borderRadius = '999px'
  })
  const j = document.querySelector<HTMLElement>('.jauges')
  if (j) j.style.animationDelay = '.6s'
}

function changer(cat: Cat) {
  const liste = parCategorie(cat)
  const i = liste.findIndex((a) => a.id === s.choix[cat])
  s.choix[cat] = liste[(i + 1) % liste.length].id
  rendre()
}

// ---------- Réglages ----------
function trioPortion(cle: string, m: Macros, titre: string) {
  return `
    <div class="section"><p class="groupe-titre">${titre}</p><div class="trio">
      ${MACROS.map((k) => champNombre(`data-portion="${cle}" data-m="${k}"`, fr(m[k]), NOM_MACRO[k].replace(/^./, (c) => c.toUpperCase()), 'g', k)).join('')}
    </div></div>`
}

function ecranReglages() {
  const r = donnees.reglages
  const P = r.portions
  const cats: Cat[] = ['proteine', 'feculent', 'gras']
  return `
  <main class="ecran">
    ${enTete('Réglages')}
    <section class="carte">
      <h3 class="groupe-titre">Budget utilisé</h3>
      <p>${utiliseProfil() ? 'L’estimation de ton profil.' : 'Les portions de référence.'}</p>
      <button type="button" class="btn-doux press" data-a="profil">Mon profil et estimation</button>
    </section>
    <section class="carte">
      <h3 class="groupe-titre">Portions de référence</h3>
      <p class="aide">Ce que chaque portion apporte, en grammes. Les légumes (200 g) s’ajoutent toujours en plus.</p>
      ${trioPortion('proteines', P.proteines, 'Portion protéines')}
      ${trioPortion('feculents', P.feculents, 'Portion féculents')}
      ${trioPortion('gras.dejeuner', P.gras.dejeuner, 'Matières grasses du déjeuner')}
      ${trioPortion('gras.diner', P.gras.diner, 'Matières grasses du dîner')}
      ${trioPortion('fromage', P.fromage, 'Fromage (30 g)')}
      ${trioPortion('pain', P.pain, 'Pain (30 g)')}
      ${champNombre('data-k="tolerance"', fr(r.tolerance * 100), 'Tolérance', '%')}
    </section>
    <section class="carte">
      <h3 class="groupe-titre">Compléments préférés</h3>
      ${cats.map((c) => `
        <label class="champ">${NOM_CAT[c]}
          <span class="saisie"><select data-pref="${c}">${parCategorie(c).map((a) => `<option value="${a.id}" ${r.preferes[c] === a.id ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select><span class="unite" aria-hidden="true">▾</span></span>
        </label>`).join('')}
      <details class="plus">
        <summary>Valeurs des compléments (pour 100 g)</summary>
        ${r.complements.map((a) => trioComplement(a)).join('')}
      </details>
    </section>
    <section class="carte">
      <h3 class="groupe-titre">Sauvegarde</h3>
      <p class="aide">Tes données restent dans ce navigateur. Exporte-les pour les garder ou les passer sur un autre appareil.</p>
      <div class="boutons">
        <button type="button" class="btn-doux press" data-a="exporter">Exporter</button>
        <label class="btn-doux press">Importer<input type="file" accept="application/json,.json" data-a="importer" class="visuellement-cache"></label>
      </div>
      <button type="button" class="btn-doux press" data-a="reinitialiser">Revenir aux valeurs par défaut</button>
    </section>
    ${message(s.erreur, 'erreur')}${message(s.info, 'info')}
    <button type="button" class="btn-doux press" data-a="apropos">À propos</button>
  </main>`
}
function trioComplement(a: Aliment) {
  return `
    <div class="section"><p class="groupe-titre">${esc(a.nom)}</p><div class="trio">
      ${MACROS.map((k) => champNombre(`data-compl="${a.id}" data-m="${k}"`, fr(a.pour100[k]), NOM_MACRO[k].replace(/^./, (c) => c.toUpperCase()), 'g', k)).join('')}
    </div></div>`
}

function exporter() {
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'assiette-sauvegarde.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function importer(input: HTMLInputElement) {
  const f = input.files?.[0]
  if (!f) return
  try {
    donnees = fusionner(JSON.parse(await f.text()))
    sauver(donnees)
    s.profil = profilTexte(donnees.profil)
    s.erreur = ''
    s.info = 'Sauvegarde importée.'
  } catch {
    s.info = ''
    s.erreur = 'Ce fichier n’est pas une sauvegarde valide.'
  }
  rendre()
}

// ---------- Profil ----------
function lireProfil(): Profil {
  const p = s.profil
  return { poids: nombre(p.poids), poidsVise: nombre(p.poidsVise), taille: nombre(p.taille), age: nombre(p.age), sexe: p.sexe, activite: p.activite }
}

function ecranProfil() {
  const p = s.profil
  const prof = profilValide()
  const activites: [Activite, string][] = [['sedentaire', 'Sédentaire'], ['leger', 'Léger (marche, un peu de sport)'], ['modere', 'Modéré (sport 3 à 5 fois par semaine)'], ['actif', 'Actif (sport intense ou métier physique)']]
  let estimation = ''
  if (prof) {
    const e = estimer(prof)
    const ligne = (t: string, m: Macros) => `<tr><td>${t}</td><td>${fr(m.g, 0)}</td><td>${fr(m.p, 0)}</td><td>${fr(m.l, 0)}</td><td>${fr(kcal(m), 0)}</td></tr>`
    const refs = { dejeuner: budgetRepas(donnees.reglages.portions, 'dejeuner', false), diner: budgetRepas(donnees.reglages.portions, 'diner', false) }
    const grandEcart = (['dejeuner', 'diner'] as Repas[]).some((r) => ecart(refs[r], e.repas[r]) > 0.2)
    const rythme = e.perteParSemaine > 0
      ? `Rythme estimé : environ ${fr(e.perteParSemaine)} kg par semaine, soit ton poids visé vers ${e.dateIndicative!.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} (date indicative).`
      : prof.poidsVise > prof.poids ? 'Objectif : léger surplus, en douceur.' : 'Objectif : maintien de ton poids.'
    estimation = `
    <section class="carte">
      <h3 class="groupe-titre">Comparaison par repas (en g, et kcal)</h3>
      <table class="compare">
        <thead><tr><th></th><th>Gluc.</th><th>Prot.</th><th>Lip.</th><th>kcal</th></tr></thead>
        <tbody>
          ${ligne('Déjeuner · référence', refs.dejeuner)}${ligne('Déjeuner · estimation', e.repas.dejeuner)}
          ${ligne('Dîner · référence', refs.diner)}${ligne('Dîner · estimation', e.repas.diner)}
        </tbody>
      </table>
      <p class="aide">Apport estimé : ${fr(e.apport, 0)} kcal par jour, dont 65 % au déjeuner et au dîner (le reste pour le petit-déjeuner et la collation).</p>
      <p>${rythme}</p>
      ${grandEcart ? '<p class="message info">L’estimation s’éloigne nettement de tes portions de référence. Avant de changer, prends le temps d’en parler avec un professionnel de santé : il saura ajuster avec toi.</p>' : ''}
      <div class="choix" role="radiogroup" aria-label="Budget à utiliser">
        <label class="coche"><input type="radio" name="source" data-source="reference" ${donnees.reglages.source === 'reference' ? 'checked' : ''}>Utiliser les portions de référence</label>
        <label class="coche"><input type="radio" name="source" data-source="profil" ${donnees.reglages.source === 'profil' ? 'checked' : ''}>Utiliser mon estimation</label>
      </div>
    </section>`
  }
  return `
  <main class="ecran">
    ${enTete('Mon profil')}
    <p class="mention">Estimation indicative, qui ne remplace pas un avis médical ou diététique.</p>
    <section class="carte">
      <p class="aide">Taille, âge, sexe et activité permettent d’estimer ce que ton corps dépense chaque jour : sans eux, le calcul serait au petit bonheur.</p>
      <div class="trio">
        ${champNombre('data-p="poids"', p.poids, 'Poids', 'kg')}
        ${champNombre('data-p="poidsVise"', p.poidsVise, 'Poids visé', 'kg')}
        ${champNombre('data-p="taille"', p.taille, 'Taille', 'cm')}
      </div>
      <div class="trio">${champNombre('data-p="age"', p.age, 'Âge', 'ans')}</div>
      <div class="bascule" role="group" aria-label="Sexe">
        ${(['femme', 'homme'] as Sexe[]).map((x) => `<button type="button" class="press" data-a="sexe" data-v="${x}" aria-pressed="${p.sexe === x}">${x === 'femme' ? 'Femme' : 'Homme'}</button>`).join('')}
      </div>
      <label class="champ">Activité
        <span class="saisie"><select data-p="activite">${activites.map(([v, t]) => `<option value="${v}" ${p.activite === v ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="unite" aria-hidden="true">▾</span></span>
      </label>
      ${message(s.profilErreur, 'erreur')}
      <button type="button" class="cta press" data-a="estimer">Estimer</button>
    </section>
    ${estimation}
    ${donnees.profil ? '<button type="button" class="btn-doux press" data-a="effacerProfil">Effacer mon profil</button>' : ''}
  </main>`
}

// ---------- À propos ----------
function ecranAPropos() {
  return `
  <main class="ecran">
    ${enTete('À propos')}
    <section class="carte">
      <p>Assiette t’aide à équilibrer ton déjeuner et ton dîner à partir de portions de référence : tu choisis ce qui te fait envie, elle te dit combien en prendre et avec quoi compléter.</p>
      <p class="mention">L’app applique des portions de référence et ne remplace pas un suivi professionnel.</p>
      <p class="aide">Tout reste dans ce navigateur : pas de compte, pas de cookie, pas de mesure d’audience. Seul le scan envoie le code-barres à Open Food Facts, base de données ouverte et collaborative. Valeurs des compléments d’après la table Ciqual de l’ANSES.</p>
    </section>
  </main>`
}

// ---------- Rendu et navigation ----------
const app = document.getElementById('app')!
let ecranRendu: Ecran | undefined

function rendre() {
  const vues: Record<Ecran, () => string> = { saisie: ecranSaisie, resultat: ecranResultat, reglages: ecranReglages, profil: ecranProfil, apropos: ecranAPropos }
  const nouveau = ecranRendu !== s.ecran
  app.innerHTML = vues[s.ecran]()
  if (!nouveau) app.querySelector<HTMLElement>('.ecran')!.style.animation = 'none'
  if (s.ecran === 'resultat') animerResultat()
  ecranRendu = s.ecran
}
function aller(e: Ecran) {
  stopperCamera()
  if (e !== s.ecran) {
    s.erreur = s.info = ''
    s.profilErreur = ''
  }
  s.ecran = e
  rendre()
  window.scrollTo(0, 0)
}
const PARENT: Record<Ecran, Ecran> = { saisie: 'saisie', resultat: 'saisie', reglages: 'saisie', profil: 'reglages', apropos: 'reglages' }

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]')
  if (!el || el.tagName === 'INPUT') return
  const v = el.dataset.v!
  switch (el.dataset.a) {
    case 'repas': s.repas = v as Repas; return rendre()
    case 'mode':
      if (v !== s.mode) {
        stopperCamera()
        s.mode = v as 'manuel' | 'scan'
        s.erreur = s.info = ''
        rendre()
      }
      return
    case 'camera': return void lancerCamera()
    case 'chercher': return void rechercher(s.code)
    case 'equilibrer': return equilibrerSaisie()
    case 'changer': return changer(v as Cat)
    case 'retour': return aller(PARENT[s.ecran])
    case 'reglages': return aller('reglages')
    case 'profil': return aller('profil')
    case 'apropos': return aller('apropos')
    case 'exporter': return exporter()
    case 'reinitialiser': {
      const p = donnees.profil, d = donnees.dernierAliment
      donnees = { ...defauts(), profil: p, dernierAliment: d }
      sauver(donnees)
      s.info = 'Valeurs par défaut rétablies.'
      return rendre()
    }
    case 'sexe': s.profil.sexe = v as Sexe; return rendre()
    case 'estimer': {
      const p = lireProfil()
      const err = verifierProfil(p)
      s.profilErreur = err ?? ''
      if (!err) {
        donnees.profil = p
        sauver(donnees)
      }
      return rendre()
    }
    case 'effacerProfil':
      delete donnees.profil
      donnees.reglages.source = 'reference'
      sauver(donnees)
      s.profil = profilTexte()
      s.profilErreur = ''
      return rendre()
  }
})

app.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement
  const d = el.dataset
  if (d.k && d.k in s.aliment) (s.aliment as unknown as Record<string, string>)[d.k] = el.value
  else if (d.k === 'code') s.code = el.value
  else if (d.k === 'quantiteImposee') s.quantiteImposee = el.value
  else if (d.q) s.qualite[d.q as keyof QualiteTexte] = el.value
  else if (d.p && d.p !== 'activite') (s.profil as Record<string, string>)[d.p] = el.value
  else if (d.portion || d.compl || d.k === 'tolerance') {
    const n = nombre(el.value)
    if (!(n >= 0)) return
    const r = donnees.reglages
    if (d.k === 'tolerance') r.tolerance = Math.min(n, 50) / 100
    else if (d.portion) {
      const [a, b] = d.portion.split('.')
      const cible: Macros = b ? r.portions.gras[b as Repas] : (r.portions as unknown as Record<string, Macros>)[a]
      cible[d.m as Macro] = n
    } else {
      const c = r.complements.find((x) => x.id === d.compl)!
      c.pour100[d.m as Macro] = n
    }
    sauver(donnees)
  }
})

app.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement
  const d = el.dataset
  if (d.k === 'fromagePain') s.fromagePain = el.checked
  else if (d.k === 'imposer') {
    s.imposer = el.checked
    rendre()
    if (s.imposer) document.querySelector<HTMLInputElement>('[data-k="quantiteImposee"]')?.focus()
  } else if (d.pref) {
    donnees.reglages.preferes[d.pref as Cat] = el.value
    sauver(donnees)
  } else if (d.p === 'activite') s.profil.activite = el.value as Activite
  else if (d.source) {
    donnees.reglages.source = d.source as 'reference' | 'profil'
    sauver(donnees)
  } else if (d.a === 'importer') importer(el)
})

// Entrée dans le formulaire = équilibrer (pratique sur le clavier iPhone).
app.addEventListener('keydown', (ev) => {
  const el = ev.target as HTMLElement
  if (ev.key !== 'Enter' || el.tagName !== 'INPUT') return
  if (el.dataset.k === 'code') return void rechercher(s.code)
  if (s.ecran === 'saisie') equilibrerSaisie()
})

rendre()
