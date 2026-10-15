import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const OFF = 'https://world.openfoodfacts.org'

// Ajoute la CSP après l'inlining : hash sha256 de chaque <script> et <style> inline, sans unsafe-inline.
function csp(): Plugin {
  let sortie = 'dist'
  return {
    name: 'csp-hash',
    apply: 'build',
    configResolved(c) {
      sortie = c.build.outDir
    },
    closeBundle() {
      const fichier = `${sortie}/index.html`
      const html = readFileSync(fichier, 'utf8')
      const hashes = (tag: string) =>
        [...html.matchAll(new RegExp(String.raw`<${tag}\b[^>]*>([\s\S]*?)</${tag}>`, 'g'))]
          .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
          .join(' ')
      const politique = [
        "default-src 'self'",
        `script-src ${hashes('script')}`,
        `style-src ${hashes('style')}`,
        "font-src 'self' data:",
        "img-src 'self' data: blob:",
        "media-src 'self' blob: mediastream:",
        `connect-src 'self' ${OFF}`,
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ')
      const meta = `<meta http-equiv="Content-Security-Policy" content="${politique}">`
      writeFileSync(fichier, html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    ${meta}`))
    },
  }
}

export default defineConfig({
  base: process.env.BASE ?? './',
  build: { sourcemap: false, assetsInlineLimit: 100_000_000 },
  plugins: [viteSingleFile(), csp()],
})
