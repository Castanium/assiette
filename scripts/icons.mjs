// Génère favicon et icônes PNG à partir de src/assets/logo.svg (nettoyé de toute métadonnée).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const propre = (svg) =>
  svg
    .replace(/<\?xml[^>]*\?>\s*/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+xmlns:(?!xlink)\w+="[^"]*"/g, '')
    .trim() + '\n'

const logo = propre(readFileSync('src/assets/logo.svg', 'utf8'))
writeFileSync('src/assets/logo.svg', logo)
writeFileSync('public/favicon.svg', logo)
mkdirSync('public/icons', { recursive: true })

const interieur = logo.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
for (const [taille, arrondi] of [[180, 0], [192, 0.22], [512, 0.22]]) {
  const m = taille * 0.1
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}">
<rect width="${taille}" height="${taille}" rx="${taille * arrondi}" fill="#7A4FD1"/>
<svg x="${m}" y="${m}" width="${taille - 2 * m}" height="${taille - 2 * m}" viewBox="0 0 240 240">${interieur}</svg></svg>`
  writeFileSync(`public/icons/icon-${taille}.png`, new Resvg(svg).render().asPng())
}
console.log('icônes générées')
