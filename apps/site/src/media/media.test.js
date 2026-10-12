import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import media from './media.json' with { type: 'json' }

/* The pipeline's contract (scripts/media/build-media.mjs): what it writes is
   what the page imports. A rebuild that drops a file or changes the shape
   fails here, not on the page. */

const here = name => fileURLToPath(new URL(name, import.meta.url))

describe('media.json', () => {
  it('has the shape the page reads', () => {
    for (const r of ['16x9', '9x16']) {
      const { transition } = media.hero[r]
      // The crash plays once: a few seconds, not a loop.
      expect(transition, `${r} transition seconds`).toBeGreaterThan(1)
      expect(transition, `${r} transition seconds`).toBeLessThan(8)
    }
  })

  it('references only files that exist', () => {
    const files = []
    for (const clip of ['hero-before-16x9', 'hero-after-16x9', 'hero-before-9x16', 'hero-after-9x16']) {
      files.push(`${clip}.webm`, `${clip}.mp4`, `${clip}.jpg`)
    }
    for (const r of ['16x9', '9x16']) files.push(`hero-transition-${r}.webm`, `hero-transition-${r}.mp4`)
    for (let i = 1; i <= media.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= media.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    expect(readFileSync(here('media.json'), 'utf8')).toContain('build-media.mjs')
  })
})
