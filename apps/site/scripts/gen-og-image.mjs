#!/usr/bin/env node
/* Generates public/og-image.png — the 1200×630 card shown when someone shares
   a link on Slack, X, LinkedIn or iMessage.

   Why bother: a link with no card is a grey rectangle with a URL in it, and it
   is the single cheapest visual win a product ships. Why generate rather than
   design once: the card carries the product name, so it has to change when you
   rename, and a PNG nobody can regenerate goes stale silently.

   The SVG below is written from the manifest and rasterised with the
   headless Chromium already installed for Playwright — no image library, no
   font downloads, no additional dependency. The name is the logo, so it is set
   in the logo face, embedded from @forge/tokens as a data URI.

     npm run gen:og
*/

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from '@forge/manifest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const WIDTH = 1200
const HEIGHT = 630

const logoFace = readFileSync(
  createRequire(import.meta.url).resolve('@forge/tokens/fonts/red-hat-display-latin-900-normal.woff2'),
).toString('base64')

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Wrap the tagline by character count. Crude, but SVG has no text flow and the
   alternative is measuring glyphs with a font library. */
function wrap(text, max = 28) {
  const lines = []
  let line = ''
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { lines.push(line.trim()); line = word }
    else line += ` ${word}`
  }
  if (line.trim()) lines.push(line.trim())
  return lines.slice(0, 3)
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style>@font-face { font-family: 'Red Hat Display'; font-weight: 900; src: url(data:font/woff2;base64,${logoFace}) format('woff2'); }</style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1e28"/>
      <stop offset="100%" stop-color="#14151c"/>
    </linearGradient>
    <radialGradient id="glow" cx="18%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#4c5bd4" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#4c5bd4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

  <text x="88" y="136" fill="#f3f3f5" font-family="'Red Hat Display', system-ui, sans-serif"
        font-size="52" font-weight="900" letter-spacing="-1.8">${esc(forge.brand.name.toLowerCase())}</text>

  ${wrap(forge.brand.tagline).map((line, i) => `<text x="88" y="${330 + i * 78}" fill="#f3f3f5"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="68" font-weight="600" letter-spacing="-2.4">${esc(line)}</text>`).join('\n  ')}

  <text x="88" y="548" fill="#8e8e9c" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="26" font-weight="500">${esc(forge.brand.domain)}</text>
</svg>`

mkdirSync(join(root, 'public'), { recursive: true })
// The SVG is written alongside the PNG: it's the editable source, and it lets
// you regenerate or tweak the card without re-running the rasteriser.
writeFileSync(join(root, 'public', 'og-image.svg'), svg)

let chromium
try {
  ({ chromium } = await import('@playwright/test'))
} catch {
  console.log('✓ wrote public/og-image.svg')
  console.log('  Playwright not installed — install it (npm i) to rasterise the PNG,')
  console.log('  or convert public/og-image.svg to a 1200×630 PNG yourself.')
  process.exit(0)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
await page.setContent(`<body style="margin:0">${svg}</body>`)
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: join(root, 'public', 'og-image.png') })
await browser.close()

console.log('✓ wrote public/og-image.svg and public/og-image.png (1200×630)')
