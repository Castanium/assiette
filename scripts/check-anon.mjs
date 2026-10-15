// Vérification d'anonymat : échoue si le dépôt, le build ou l'historique git contient
// un élément identifiant. Lancé en CI et avant chaque push (.githooks/pre-push).
// Aucune valeur personnelle n'est écrite ici : elles sont lues au moment de l'exécution.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }

const emailAutorise = (process.env.ALLOWED_EMAIL || sh('git config user.email')).toLowerCase()
const m = emailAutorise.match(/^\d+\+([a-z0-9-]+)@users\.noreply\.github\.com$/i)
if (!m) {
  console.error(`✗ adresse autorisée absente ou non « noreply » : définis git config user.email ou ALLOWED_EMAIL`)
  process.exit(1)
}
const pseudoGithub = (process.env.GH_USER || m[1]).toLowerCase()
const session = userInfo().username.toLowerCase()

const IMAGES_GENEREES = new Set(['src/assets/logo.svg', 'public/favicon.svg', 'public/icons/icon-180.png', 'public/icons/icon-192.png', 'public/icons/icon-512.png'])
const BINAIRE = /\.(png|jpe?g|gif|webp|avif|heic|bmp|ico|tiff?|pdf|docx?|xlsx?|pptx?|odt|zip)$/i
const URL_OK = [/^https:\/\/world\.openfoodfacts\.org(\/|$)/, /^https?:\/\/www\.w3\.org\//]
const RESEAU = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.connection)/
const CHEMIN = /([a-z]:[\\/]+(users|documents and settings)[\\/])|(\/users\/[^/\s'"`]+)|(\/home\/[a-z_][^/\s'"`]*)/i

const fichiers = sh('git ls-files --cached --others --exclude-standard').split('\n').filter(Boolean).filter((f) => existsSync(f))
const build = []
const parcourir = (d) => readdirSync(d).forEach((f) => { const p = join(d, f).replaceAll('\\', '/'); statSync(p).isDirectory() ? parcourir(p) : build.push(p) })
if (existsSync('dist')) parcourir('dist')

const fautes = []
const faute = (f, t) => fautes.push(`${f} : ${t}`)

for (const f of [...fichiers, ...build]) {
  const dansBuild = f.startsWith('dist/')
  const source = dansBuild ? f.replace(/^dist\//, 'public/') : f
  if (f.startsWith('_ref/')) faute(f, 'le dossier _ref/ ne doit jamais être versionné')
  if (BINAIRE.test(f) || /\.svg$/i.test(f)) {
    if (!IMAGES_GENEREES.has(source)) { faute(f, 'image ou document non généré'); continue }
  }
  const buf = readFileSync(f)
  if (/\.png$/i.test(f)) {
    // Fragments de métadonnées PNG : texte, EXIF, profil ICC nommé, date
    for (const c of ['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME', 'iCCP']) if (buf.includes(c)) faute(f, `métadonnée PNG ${c}`)
    continue
  }
  if (BINAIRE.test(f)) continue
  const txt = buf.toString('utf8')
  const bas = txt.toLowerCase()

  const soiMeme = f === 'scripts/check-anon.mjs'
  if (!soiMeme && /<metadata[\s>]/i.test(txt)) faute(f, 'bloc <metadata> dans un SVG')
  if (bas.includes(pseudoGithub)) faute(f, 'nom d’utilisateur GitHub')
  if (session.length >= 3 && new RegExp(`\\b${session}\\b`, 'i').test(txt)) faute(f, 'nom de session de la machine')
  if (CHEMIN.test(txt)) faute(f, `chemin absolu de machine (${txt.match(CHEMIN)[0]})`)

  if (!soiMeme)
    for (const e of txt.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [])
      if (e.toLowerCase() !== emailAutorise && !/@\d+\.\d+/.test(e)) faute(f, `adresse e-mail ${e}`)

  // package-lock.json : métadonnées des dépendances (registre, financement), jamais chargées par la page.
  if (!soiMeme && f !== 'package-lock.json')
    for (const u of txt.match(/https?:\/\/[^\s'"`)<>\];]+/g) ?? [])
      if (!URL_OK.some((r) => r.test(u))) faute(f, `URL externe ${u}`)

  if (!dansBuild && /\.(m?[jt]s)$/.test(f) && !f.startsWith('src/scan/') && !f.startsWith('scripts/') && f !== 'vite.config.ts' && RESEAU.test(txt))
    faute(f, 'appel réseau en dehors du module de scan')
  if (dansBuild && f.endsWith('.map')) faute(f, 'sourcemap dans le build')
}

// Historique git : identités et messages
const log = sh('git log --all --format=%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e')
for (const c of log.split('\x1e').map((x) => x.trim()).filter(Boolean)) {
  const [an, ae, cn, ce, msg] = c.split('\x1f')
  for (const e of [ae, ce]) if (e.toLowerCase() !== emailAutorise && e !== 'noreply@github.com') faute('historique', `commit avec l’adresse ${e}`)
  if (/co-authored-by/i.test(msg)) faute('historique', 'ligne Co-Authored-By dans un message de commit')
  if (session.length >= 3 && [an, cn, msg].some((x) => new RegExp(`\\b${session}\\b`, 'i').test(x))) faute('historique', 'nom de session dans un commit')
  if (/@/.test(msg) && (msg.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).some((e) => e.toLowerCase() !== emailAutorise)) faute('historique', 'adresse e-mail dans un message de commit')
}
const branches = sh('git branch --format=%(refname:short)')
if (branches.toLowerCase().includes(session)) faute('branches', 'nom de session dans un nom de branche')

if (fautes.length) {
  console.error(`✗ vérification d’anonymat : ${fautes.length} problème(s)\n` + fautes.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log(`✓ anonymat vérifié : ${fichiers.length} fichiers du dépôt, ${build.length} fichiers de build, historique git`)
