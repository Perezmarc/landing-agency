import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/* What is tested here is the SHAPE of the token file, not the palette. A test
   that asserted `--accent` is a particular indigo would fail on the first
   re-theme, which is the one thing a design system must make cheap. */

const TOKENS_CSS = fileURLToPath(new URL('./tokens.css', import.meta.url))

describe('tokens.css', () => {
  const css = readFileSync(TOKENS_CSS, 'utf8')

  it('declares every token on :root, so one name works everywhere', () => {
    // A parallel scoped set (--x-ink inside one wrapper, --ink outside) means
    // every component change has to be checked against "which scope did this
    // land in". Don't reintroduce it.
    const outside = css.replace(/:root\s*\{[\s\S]*?\n\}/g, '')
    const strays = [...outside.matchAll(/^\s*(--[\w-]+):/gm)].map(m => m[1])
    expect(strays).toEqual([])
  })

  it('defines the tokens the site is built from', () => {
    ['--accent', '--surface', '--ink', '--line'].forEach((name) => {
      expect(css, name).toMatch(new RegExp(`${name}:`))
    })
  })
})
