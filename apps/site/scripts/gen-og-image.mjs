#!/usr/bin/env node
/* Generates public/og-image.png — the 1200×630 card shown when someone shares
   a link on Slack, X, LinkedIn or iMessage.

   Why bother: a link with no card is a grey rectangle with a URL in it, and it
   is the single cheapest visual win a product ships. Why generate rather than
   design once: the card carries the product name, so it has to change when you
   rename, and a PNG nobody can regenerate goes stale silently.

   The SVG below is written from the manifest and rasterised with the
   headless Chromium already installed for Playwright — no image library, no
   font downloads, no additional dependency.

     npm run gen:og
*/

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from '@forge/manifest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const WIDTH = 1200
const HEIGHT = 630

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Wrap the tagline by character count. Crude, but SVG has no text flow and the
   alternative is measuring glyphs with a font library. */
function wrap(text, max = 42) {
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

  <g transform="translate(88, 96)" stroke="#f3f3f5" fill="none">
    <rect x="1.5" y="1.5" width="45" height="45" rx="13" stroke-width="2.4"/>
    <path d="M13 33 L24 14 L35 33" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17 26 h14" stroke-width="3.2" stroke-linecap="round"/>
  </g>
  <text x="152" y="130" fill="#f3f3f5" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="30" font-weight="600" letter-spacing="-0.5">${esc(forge.brand.name)}</text>

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
await page.screenshot({ path: join(root, 'public', 'og-image.png') })
await browser.close()

console.log('✓ wrote public/og-image.svg and public/og-image.png (1200×630)')
