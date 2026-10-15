// Seul module autorisé à faire une requête réseau : Open Food Facts, avec le code-barres uniquement.
import type { Macros } from '../config/reference'
import type { Qualite } from '../engine/plate'

const API = 'https://world.openfoodfacts.org/api/v2/product/'
const CHAMPS = 'product_name,nutriments,nutriscore_grade,nova_group'

export const codeValide = (code: string) => /^\d{8,14}$/.test(code)

export type Produit = { nom: string; pour100: Macros; qualite: Qualite }

export async function chercherProduit(code: string): Promise<Produit | { erreur: string }> {
  if (!codeValide(code)) return { erreur: 'Ce code-barres ne semble pas valide (8 à 14 chiffres).' }
  let json: any
  try {
    const rep = await fetch(`${API}${code}.json?fields=${CHAMPS}`, {
      signal: AbortSignal.timeout(10000),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (rep.status === 404) return { erreur: 'Produit introuvable. Pas grave : saisis ses valeurs à la main.' }
    json = await rep.json()
  } catch {
    return { erreur: 'Impossible de joindre Open Food Facts. Vérifie ta connexion, ou saisis les valeurs à la main.' }
  }
  const p = json?.product
  const n = p?.nutriments ?? {}
  const num = (k: string) => (typeof n[k] === 'number' ? n[k] : typeof n[k] === 'string' && n[k] !== '' ? Number(n[k]) : undefined)
  const g = num('carbohydrates_100g'), pr = num('proteins_100g'), l = num('fat_100g')
  if (!p || json.status === 0) return { erreur: 'Produit introuvable. Pas grave : saisis ses valeurs à la main.' }
  if ([g, pr, l].some((x) => x == null || !Number.isFinite(x)))
    return { erreur: 'Ce produit est incomplet sur Open Food Facts. Complète les valeurs à la main.' }
  return {
    nom: String(p.product_name || '').trim(),
    pour100: { g: g!, p: pr!, l: l! },
    qualite: {
      sucres: num('sugars_100g'),
      sel: num('salt_100g'),
      satures: num('saturated-fat_100g'),
      fibres: num('fiber_100g'),
      nutriscore: typeof p.nutriscore_grade === 'string' ? p.nutriscore_grade : undefined,
      nova: typeof p.nova_group === 'number' ? p.nova_group : undefined,
    },
  }
}

/** Lance la caméra et appelle onCode au premier code lu. Renvoie une fonction d'arrêt. */
export async function demarrerCamera(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const Detecteur = (globalThis as any).BarcodeDetector
  if (Detecteur) {
    const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    video.srcObject = flux
    await video.play()
    const det = new Detecteur({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    let actif = true
    const boucle = async () => {
      if (!actif) return
      try {
        const [c] = await det.detect(video)
        if (c?.rawValue) {
          actif = false
          return onCode(c.rawValue)
        }
      } catch {
        /* image pas prête */
      }
      setTimeout(boucle, 200)
    }
    boucle()
    return () => {
      actif = false
      flux.getTracks().forEach((t) => t.stop())
    }
  }
  // Safari iPhone : pas de BarcodeDetector, on charge la librairie empaquetée.
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const lecteur = new BrowserMultiFormatReader()
  const controles = await lecteur.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video, (res) => {
    if (res) {
      controles.stop()
      onCode(res.getText())
    }
  })
  return () => controles.stop()
}
