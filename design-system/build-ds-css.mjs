#!/usr/bin/env node
/* Generates design-system/ds-styles.css — one stylesheet carrying everything
 * the exported components need, for an external design canvas.
 *
 * WHY CONCATENATE INSTEAD OF @import: the consuming tool appends this file
 * verbatim into its own bundle, and `@import` is not resolved there. Inlining
 * is the only thing that works.
 *
 * It is a plain concatenation and nothing more, which is possible because
 * every token lives on `:root` (see tokens.css).
 *
 * Re-run before syncing (it is cfg.buildCmd), so a re-sync is reproducible.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packages = join(here, '..', 'packages')
const read = (file) => readFileSync(join(packages, file), 'utf8')

// Cascade order matters: tokens first, then base type, then the component
// sheets. The site's marketing.css is omitted — no exported component
// depends on it.
const SOURCES = [
  'tokens/tokens.css',
  'ui/base.css',
  'ui/kit.css',
  'ui/button.css',
]

const out = SOURCES
  .map(file => `\n/* ────── ${file} ────── */\n${read(file)}`)
  .join('\n')

writeFileSync(join(here, 'ds-styles.css'), out)
console.error(`build-ds-css: wrote design-system/ds-styles.css (${out.length} bytes)`)
