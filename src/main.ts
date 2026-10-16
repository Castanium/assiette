import './styles.css'
import logoSvg from './assets/logo.svg?raw'
import {
  COMPLEMENTS, DEFICIT, IDEES_COLLATIONS, LEGUMES, PARTS_REPAS, PROTEINES_GKG, type Cat, type Macros,
} from './config/reference'
import { MACROS, NOM_MACRO, cuilleres, equilibrer, nombre, normaliser, type Resultat } from './engine/plate'
import { besoins, kcal, verifierProfil, type Activite, type Besoins, type Profil, type Sexe } from './engine/profile'
import { charger, fusionner, sauver, type DernierAliment } from './store'

type Ecran = 'profil' | 'saisie' | 'resultat' | 'reglages'

let donnees = charger()
const vide: DernierAliment = { nom: '', quantiteRef: '100', g: '', p: '', l: '' }
const s = {
  ecran: 'saisie' as Ecran,
  aliment: { ...vide, ...donnees.dernierAliment } as DernierAliment,
  imposer: false,
  quantiteImposee: '',
  erreur: '',
  info: '',
  choix: { ...donnees.reglages.preferes },
  pour100: { g: 0, p: 0, l: 0 } as Macros,
  profil: profilTexte(donnees.profil),
  profilErreur: '',
}

// ---------- Utilitaires ----------
function fr(n: number, dec = 1) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: dec })
}
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const NOM_CAT: Record<Cat, string> = { proteine: 'Protéines', feculent: 'Féculents', gras: 'Matières grasses' }
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const deLiaison = (nom: string) => {
  const n = nom.trim()
  if (!n) return 'de ce plat'
  const m = n.charAt(0).toLowerCase() + n.slice(1)
  return /^[aeiouyhàâéèêëîïôûœ]/i.test(m) ? `d’${m}` : `de ${m}`
}
const ICONE = {
  reglages: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.4"/><circle cx="10" cy="17" r="2.4"/></svg>',
  retour: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  changer: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
}
const MENTION = '<p class="mention">Estimation indicative, qui ne remplace pas un avis médical ou diététique.</p>'
const message = (texte: string, type: 'erreur' | 'info' | 'bien') =>
  texte ? `<p class="message ${type} o2" role="${type === 'erreur' ? 'alert' : 'status'}">${esc(texte)}</p>` : ''
const champNombre = (attr: string, valeur: string, label: string, unite = 'g', cls = '') => `
  <label class="champ ${cls}">${label}
    <span class="saisie"><input type="text" inputmode="decimal" autocomplete="off" ${attr} value="${esc(valeur)}"><span class="unite">${unite}</span></span>
  </label>`
const bascule = (label: string, action: string, options: [string | number, string][], actif: string | number) => `
  <div class="bascule" role="group" aria-label="${label}">
    ${options.map(([v, t]) => `<button type="button" class="press" data-a="${action}" data-v="${v}" aria-pressed="${v === actif}">${t}</button>`).join('')}
  </div>`

function profilTexte(p?: Profil) {
  return {
    poids: p ? fr(p.poids) : '', poidsVise: p ? fr(p.poidsVise) : '', taille: p ? String(p.taille) : '',
    age: p ? String(p.age) : '', sexe: (p?.sexe ?? 'femme') as Sexe, activite: (p?.activite ?? 'leger') as Activite,
  }
}
const profilValide = () => (donnees.profil && !verifierProfil(donnees.profil) ? donnees.profil : undefined)
const calculBesoins = (): Besoins => besoins(profilValide()!, donnees.reglages)
const complement = (id: string) => COMPLEMENTS.find((c) => c.id === id) ?? COMPLEMENTS[0]
const parCategorie = (cat: Cat) => COMPLEMENTS.filter((c) => c.categorie === cat)

// ---------- Profil (premier lancement et réglages) ----------
function formProfil(action: string, libelle: string) {
  const p = s.profil
  const activites: [Activite, string][] = [['sedentaire', 'Sédentaire'], ['leger', 'Léger (marche, un peu de sport)'], ['modere', 'Modéré (sport 3 à 5 fois par semaine)'], ['actif', 'Actif (sport intense ou métier physique)']]
  return `
    <section class="carte">
      <p class="aide">Taille, âge, sexe et activité permettent d’estimer ce que ton corps dépense chaque jour : sans eux, le calcul serait au petit bonheur.</p>
      ${bascule('Sexe', 'sexe', [['femme', 'Femme'], ['homme', 'Homme']], p.sexe)}
      <div class="trio">
        ${champNombre('data-p="age"', p.age, 'Âge', 'ans')}
        ${champNombre('data-p="taille"', p.taille, 'Taille', 'cm')}
      </div>
      <div class="trio">
        ${champNombre('data-p="poids"', p.poids, 'Poids', 'kg')}
        ${champNombre('data-p="poidsVise"', p.poidsVise, 'Poids visé', 'kg')}
      </div>
      <label class="champ">Activité
        <span class="saisie"><select data-p="activite">${activites.map(([v, t]) => `<option value="${v}" ${p.activite === v ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="unite" aria-hidden="true">▾</span></span>
      </label>
      ${message(s.profilErreur, 'erreur')}
      <button type="button" class="cta press" data-a="${action}">${libelle}</button>
    </section>`
}

function ecranProfil() {
  return `
  <main class="ecran">
    <div class="blob blob-d" aria-hidden="true"></div>
    <header class="entete"><span class="logo" aria-hidden="true">${logoSvg}</span><h1>Assiette</h1></header>
    <p class="question">Fais-moi un peu connaître ton corps, et je calcule ton assiette.</p>
    ${formProfil('enregistrerProfil', 'C’est parti')}
    <p class="aide">Ces infos restent dans ton navigateur, rien n’est envoyé nulle part.</p>
    ${MENTION}
  </main>`
}

function lireProfil(): Profil {
  const p = s.profil
  return { poids: nombre(p.poids), poidsVise: nombre(p.poidsVise), taille: nombre(p.taille), age: nombre(p.age), sexe: p.sexe, activite: p.activite }
}
function enregistrerProfil(): boolean {
  const p = lireProfil()
  s.profilErreur = verifierProfil(p) ?? ''
  if (s.profilErreur) return false
  donnees.profil = p
  sauver(donnees)
  return true
}

// ---------- Écran de saisie ----------
function ecranSaisie() {
  const a = s.aliment
  return `
  <main class="ecran deux">
    <div class="blob blob-d" aria-hidden="true"></div>
    <div class="col">
      <header class="entete">
        <span class="logo" aria-hidden="true">${logoSvg}</span><h1>Assiette</h1>
        <button type="button" class="rond press" data-a="reglages" aria-label="Réglages">${ICONE.reglages}</button>
      </header>
      <p class="question">Qu’est-ce qui te fait envie ?</p>
      <label class="coche o2"><input type="checkbox" data-k="imposer" ${s.imposer ? 'checked' : ''}>Je choisis ma quantité</label>
      ${s.imposer ? `<div class="o2">${champNombre('data-k="quantiteImposee"', s.quantiteImposee, 'Je mange')}</div>` : ''}
      ${message(s.erreur, 'erreur')}
      <div class="cta-zone o3"><button type="button" class="cta press" data-a="equilibrer">Équilibrer mon assiette</button></div>
    </div>
    <div class="col">
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
      </div>
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
  s.erreur = ''
  donnees.dernierAliment = { ...a }
  sauver(donnees)
  s.choix = { ...donnees.reglages.preferes }
  aller('resultat')
}
function afficherErreur(t: string) {
  s.erreur = t
  rendre()
  document.querySelector('.message.erreur')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ---------- Écran de résultat ----------
function calculer(): Resultat {
  const c = (cat: Cat) => complement(s.choix[cat])
  return equilibrer({
    budget: calculBesoins().repas,
    pour100: s.pour100,
    tolerance: donnees.reglages.tolerance,
    complements: { proteine: c('proteine'), feculent: c('feculent'), gras: c('gras') },
    legumes: LEGUMES,
    quantiteImposee: s.imposer ? nombre(s.quantiteImposee) : undefined,
  })
}

function ecranResultat() {
  const r = calculer()
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
      <p class="chapeau">${s.imposer ? 'Tu manges' : 'Tu peux manger jusqu’à'}</p>
      <p class="chiffre"><span>${fr(r.quantite, 0)} g</span></p>
      <p class="plat">${esc(deLiaison(s.aliment.nom))}</p>
      ${pill ? `<span class="limite">${pill}</span>` : ''}`
  }
  // Chaque carte : la macro visée en petit, l'aliment et son poids en gros, ses autres apports en tout petit.
  const lignes = r.complements.map((c) => {
    const cat = c.aliment.categorie as Cat
    const vise = c.vise!
    const aussi = MACROS.filter((k) => k !== vise.macro && c.apport[k] >= 1).map((k) => `${fr(c.apport[k], 0)} g de ${NOM_MACRO[k]}`)
    const details = [
      aussi.length ? `apporte aussi ${aussi.join(' et ')}` : '',
      cat === 'gras' && c.aliment.pour100.l >= 90 ? cuilleres(c.grammes) : c.aliment.astuce ? 'complet si possible' : '',
    ].filter(Boolean).join(' · ')
    return `
      <div class="ligne carte-compl">
        <span class="puce ${cat}" aria-hidden="true"></span>
        <span class="nom">
          <small class="vise">${majuscule(NOM_MACRO[vise.macro])} · +${fr(vise.grammes, 0)} g</small>
          <span class="aliment">${fr(c.grammes, 0)} g ${esc(deLiaison(c.aliment.nom))}</span>
          ${details ? `<small>${details}</small>` : ''}
        </span>
        <button type="button" class="changer press" data-a="changer" data-v="${cat}" aria-label="Changer de ${NOM_CAT[cat].toLowerCase()}">${ICONE.changer}</button>
      </div>`
  })
  lignes.push(`
    <div class="ligne sans-bouton">
      <span class="puce legumes" aria-hidden="true"></span>
      <span class="nom"><span class="aliment">${r.legumes.grammes} g de légumes</span><small>non féculents, tels que servis, crus ou cuits</small></span>
    </div>`)
  const manque = (['p', 'g', 'l'] as const)
    .map((k) => `<span class="manque ${k}${Math.round(r.manque[k]) === 0 ? ' zero' : ''}">${fr(r.manque[k], 0)} g de ${NOM_MACRO[k]}</span>`)
    .join('<span aria-hidden="true">·</span>')
  const notes = ['Avec 1 à 2 fruits en collation, tu atteins 550 à 700 g de fruits et légumes par jour.', 'Pomme de terre, patate douce, maïs, petits pois et légumineuses comptent comme féculents, pas comme légumes. Tu peux rajouter des légumes si tu as encore faim.']
  if (r.tresDense) notes.push('Ajoute des légumes en plus, autant que tu veux.')
  notes.push(...r.conseils)
  const fec = r.complements.find((c) => c.aliment.categorie === 'feculent')?.aliment.astuce
  if (fec) notes.push(fec)

  return `
  <main class="ecran deux">
    <div class="blob blob-g" aria-hidden="true"></div>
    <div class="col">
      <header class="entete entete-resultat">
        <button type="button" class="rond press" data-a="retour" aria-label="Retour">${ICONE.retour}</button>
        <span class="pastille-repas">Mon assiette</span>
      </header>
      <section class="verdict" aria-live="polite">${verdict}</section>
      <p class="aide poids">Assiette complète : ${fr(r.poidsTotal, 0)} g · ≈ ${fr(r.totalKcal, 0)} kcal</p>
      ${r.copieuse ? '<p class="message info" role="status">Assiette copieuse : arrête-toi quand tu n’as plus faim, ce qui reste peut passer en collation. Pour l’alléger, réduis d’abord le plat ou le féculent, jamais les protéines ni les légumes.</p>' : ''}
      ${r.proteinesAuDessus ? '<p class="message bien">Protéines au-dessus de ta cible, parfait pour tes muscles.</p>' : ''}
      ${r.verifierSaisie ? message('Ce total s’éloigne nettement de ton assiette type. Vérifie tes valeurs : sont-elles bien pour la quantité indiquée, et pas pour toute la portion ?', 'info') : ''}
      ${jauges(r)}
    </div>
    <div class="col">
      <p class="sous-titre o1">Pour atteindre ta cible</p>
      <p class="manques o1">Il te manque : ${manque}</p>
      <div class="liste o1">${lignes.join('')}</div>
      ${notes.map((n) => `<p class="note o1">${esc(n)}</p>`).join('')}
      <div class="o1">${carteCollations(calculBesoins())}</div>
    </div>
  </main>`
}

function jauges(r: Resultat) {
  // Le budget du repas comprend les légumes : ils comptent avec les compléments.
  const compl = [...r.complements, r.legumes].reduce((m, c) => ({ g: m.g + c.apport.g, p: m.p + c.apport.p, l: m.l + c.apport.l }), { g: 0, p: 0, l: 0 })
  return `
    <div class="jauges o3">
      ${MACROS.map((k) => {
        const total = r.plat[k] + compl[k]
        const max = Math.max(r.budget[k], total, 0.001)
        const nom = majuscule(NOM_MACRO[k])
        return `
        <div class="jauge ${k}" data-plat="${(r.plat[k] / max) * 100}" data-compl="${(compl[k] / max) * 100}">
          <div class="tete"><span>${nom}</span><span>${fr(total, 0)} / ${fr(r.budget[k], 0)} g</span></div>
          <div class="piste" role="img" aria-label="${nom} : ${fr(total, 0)} sur ${fr(r.budget[k], 0)} grammes"><span class="seg plat"></span><span class="seg compl"></span></div>
        </div>`
      }).join('')}
      <div class="legende"><span><i></i>le plat</span><span><i class="compl"></i>compléments et légumes</span></div>
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

// ---------- Cartes de besoins ----------
function carteAssiette(b: Besoins) {
  const r = b.repas
  return `
    <section class="carte" id="carte-type">
      <h3 class="groupe-titre">Ton assiette type</h3>
      <p class="aide">Pour chacun des deux repas principaux, légumes compris.</p>
      <div class="chiffres">
        <span><b>${fr(r.g, 0)} g</b>glucides</span><span><b>${fr(r.p, 0)} g</b>protéines</span><span><b>${fr(r.l, 0)} g</b>lipides</span><span><b>${fr(kcal(r), 0)}</b>kcal</span>
      </div>
      <p class="aide">Dépense du jour ≈ ${fr(b.depense, 0)} kcal · apport visé ≈ ${fr(b.apport, 0)} kcal.</p>
      <p>${b.maintien ? 'Poids visé atteint : on vise le maintien.' : `Rythme estimé : environ ${fr(b.perteParSemaine)} kg par semaine.`}</p>
      ${b.glucidesBas ? '<p class="message info">Il reste moins de 100 g de glucides par jour. Pour garder de l’énergie, réduis un peu le déficit.</p>' : ''}
    </section>`
}

function carteCollations(b: Besoins) {
  const reste = kcal(b.collationsApresFruit)
  const idees = IDEES_COLLATIONS.find((t) => reste <= t.jusqua)!.idees
  return `
    <section class="carte" id="carte-coll">
      <h3 class="groupe-titre">Tes collations</h3>
      <p>≈ ${fr(kcal(b.collations), 0)} kcal, dont ${fr(b.collations.p, 0)} g de protéines, en 1 ou 2 collations, dont 1 à 2 fruits (≈ 150 à 300 g).</p>
      <p class="aide">Après un fruit de 150 g (≈ ${fr(kcal(b.fruit), 0)} kcal), il reste ≈ ${fr(reste, 0)} kcal, dont ${fr(b.collationsApresFruit.p, 0)} g de protéines.</p>
      <ul class="idees">${idees.map((i) => `<li>${i}</li>`).join('')}</ul>
    </section>`
}

// ---------- Réglages ----------
function ecranReglages() {
  const r = donnees.reglages
  const b = calculBesoins()
  const cats: Cat[] = ['proteine', 'feculent', 'gras']
  const pct = (x: number) => fr(x * 100, 0)
  return `
  <main class="ecran">
    <header class="entete"><button type="button" class="rond press" data-a="retour" aria-label="Retour">${ICONE.retour}</button><h2>Réglages</h2></header>
    ${carteAssiette(b)}
    ${carteCollations(b)}
    <section class="carte">
      <h3 class="groupe-titre">Ton rythme</h3>
      <label class="champ">Déficit calorique : <output id="val-deficit">${pct(b.deficitApplique)} %</output>
        <input type="range" class="curseur" min="0" max="${DEFICIT.max * 100}" step="${DEFICIT.pas * 100}" value="${pct(b.deficitApplique)}" data-r="deficit" ${b.maintien ? 'disabled' : ''}>
      </label>
      ${b.maintien ? '<p class="aide">Ton poids visé est atteint ou au-dessus : le déficit reste à 0 %.</p>' : '<p class="aide">Plafonné à 750 kcal par jour, et jamais sous ton métabolisme de base.</p>'}
      <p class="groupe-titre">Priorité protéines</p>
      ${bascule('Priorité protéines', 'proteines', [[PROTEINES_GKG.standard, 'Standard'], [PROTEINES_GKG.muscle, 'Muscle'], [PROTEINES_GKG.maximum, 'Maximum']], r.proteinesGkg)}
      <p class="aide">${fr(r.proteinesGkg)} g par kg de poids visé. Plus de protéines aide à garder tes muscles pendant un déficit.</p>
      <p class="groupe-titre">Part des deux repas</p>
      ${bascule('Part des deux repas', 'part', PARTS_REPAS.map((p) => [p, `${pct(p)} %`]), r.partRepas)}
      <p class="aide">Le reste de la journée va aux collations.</p>
      ${champNombre('data-k="tolerance"', fr(r.tolerance * 100), 'Tolérance', '%')}
    </section>
    <section class="carte">
      <h3 class="groupe-titre">Compléments préférés</h3>
      ${cats.map((c) => `
        <label class="champ">${NOM_CAT[c]}
          <span class="saisie"><select data-pref="${c}">${parCategorie(c).map((a) => `<option value="${a.id}" ${r.preferes[c] === a.id ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select><span class="unite" aria-hidden="true">▾</span></span>
        </label>`).join('')}
    </section>
    <h3 class="sous-titre">Mon profil</h3>
    ${formProfil('majProfil', 'Mettre à jour mon profil')}
    ${message(s.info, 'info')}
    <section class="carte">
      <h3 class="groupe-titre">Sauvegarde</h3>
      <p class="aide">Tes données restent dans ce navigateur. Exporte-les pour les garder ou les passer sur un autre appareil.</p>
      <div class="boutons">
        <button type="button" class="btn-doux press" data-a="exporter">Exporter</button>
        <label class="btn-doux press">Importer<input type="file" accept="application/json,.json" data-a="importer" class="visuellement-cache"></label>
      </div>
      ${message(s.erreur, 'erreur')}
      <button type="button" class="btn-doux press" data-a="effacerProfil">Effacer mon profil</button>
    </section>
    <section class="carte">
      <h3 class="groupe-titre">À propos · v1.4</h3>
      <p class="aide">Assiette calcule tes besoins à partir de ton profil et t’aide à équilibrer chaque assiette. Tout reste dans ce navigateur : pas de compte, pas de cookie, aucune connexion. Valeurs des aliments d’après la table Ciqual de l’ANSES.</p>
      ${MENTION}
    </section>
  </main>`
}

/** Après un changement de curseur : met à jour les deux cartes sans tout redessiner. */
function majCartes() {
  sauver(donnees)
  const b = calculBesoins()
  document.getElementById('carte-type')!.outerHTML = carteAssiette(b)
  document.getElementById('carte-coll')!.outerHTML = carteCollations(b)
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
    s.choix = { ...donnees.reglages.preferes }
    s.erreur = ''
    s.info = 'Sauvegarde importée.'
  } catch {
    s.info = ''
    s.erreur = 'Ce fichier n’est pas une sauvegarde valide.'
  }
  rendre()
}

// ---------- Rendu et navigation ----------
const app = document.getElementById('app')!
let ecranRendu: Ecran | undefined

function rendre() {
  if (!profilValide()) s.ecran = 'profil'
  const vues: Record<Ecran, () => string> = { profil: ecranProfil, saisie: ecranSaisie, resultat: ecranResultat, reglages: ecranReglages }
  const nouveau = ecranRendu !== s.ecran
  app.innerHTML = vues[s.ecran]()
  if (!nouveau) app.querySelector<HTMLElement>('.ecran')!.style.animation = 'none'
  if (s.ecran === 'resultat') animerResultat()
  ecranRendu = s.ecran
}
function aller(e: Ecran) {
  if (e !== s.ecran) s.erreur = s.info = s.profilErreur = ''
  s.ecran = e
  rendre()
  window.scrollTo(0, 0)
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]')
  if (!el || el.tagName === 'INPUT') return
  const v = el.dataset.v!
  switch (el.dataset.a) {
    case 'equilibrer': return equilibrerSaisie()
    case 'changer': return changer(v as Cat)
    case 'retour': return aller('saisie')
    case 'reglages': return aller('reglages')
    case 'exporter': return exporter()
    case 'sexe':
      s.profil.sexe = v as Sexe
      document.querySelectorAll('[data-a="sexe"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)))
      return
    case 'proteines':
    case 'part':
      donnees.reglages[el.dataset.a === 'part' ? 'partRepas' : 'proteinesGkg'] = Number(v)
      sauver(donnees)
      return rendre()
    case 'enregistrerProfil':
      if (enregistrerProfil()) return aller('saisie')
      return rendre()
    case 'majProfil':
      s.info = enregistrerProfil() ? 'Profil mis à jour.' : ''
      return rendre()
    case 'effacerProfil':
      delete donnees.profil
      sauver(donnees)
      s.profil = profilTexte()
      return aller('profil')
  }
})

app.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement
  const d = el.dataset
  if (d.k && d.k in s.aliment) (s.aliment as Record<string, string>)[d.k] = el.value
  else if (d.k === 'quantiteImposee') s.quantiteImposee = el.value
  else if (d.p && d.p !== 'activite') (s.profil as Record<string, string>)[d.p] = el.value
  else if (d.r === 'deficit') {
    donnees.reglages.deficit = Number(el.value) / 100
    document.getElementById('val-deficit')!.textContent = `${el.value} %`
    majCartes()
  } else if (d.k === 'tolerance') {
    const n = nombre(el.value)
    if (n >= 0 && n <= 50) {
      donnees.reglages.tolerance = n / 100
      sauver(donnees)
    }
  }
})

app.addEventListener('change', (ev) => {
  const el = ev.target as HTMLInputElement
  const d = el.dataset
  if (d.k === 'imposer') {
    s.imposer = el.checked
    rendre()
    if (s.imposer) document.querySelector<HTMLInputElement>('[data-k="quantiteImposee"]')?.focus()
  } else if (d.pref) {
    donnees.reglages.preferes[d.pref as Cat] = el.value
    sauver(donnees)
  } else if (d.p === 'activite') s.profil.activite = el.value as Activite
  else if (d.a === 'importer') importer(el)
})

// Entrée dans le formulaire = équilibrer (pratique sur le clavier iPhone).
app.addEventListener('keydown', (ev) => {
  const el = ev.target as HTMLElement
  if (ev.key === 'Enter' && el.tagName === 'INPUT' && s.ecran === 'saisie') equilibrerSaisie()
})

rendre()
