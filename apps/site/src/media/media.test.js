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
    // Both renditions are cut from the same crash, trimmed the same way.
    expect(media.hero['9x16'].transition).toBe(media.hero['16x9'].transition)
  })

  it('gives each card clip a box to fit to its card', () => {
    for (const which of ['before', 'after']) {
      const { aspect, fit } = media.cards[which]
      expect(aspect, which).toBeGreaterThan(0.5)
      expect(aspect, which).toBeLessThan(4)
      expect(fit.left, which).toBeGreaterThanOrEqual(0)
      expect(fit.right, which).toBeLessThanOrEqual(1)
      expect(fit.right - fit.left, which).toBeGreaterThan(0.5)
      expect(fit.bottom, which).toBeGreaterThan(fit.top)
    }
    // BEFORE: the slab spans the clip's width, its top edge with streams above it.
    expect(media.cards.before.fit.left).toBe(0)
    expect(media.cards.before.fit.right).toBe(1)
    expect(media.cards.before.fit.top).toBeGreaterThan(0.2)
    expect(media.cards.before.fit.top).toBeLessThan(0.6)
    // AFTER: room above and below the card for the stream coming in and going out.
    expect(media.cards.after.fit.top).toBeGreaterThan(0.1)
    expect(media.cards.after.fit.bottom).toBeLessThan(0.9)
  })

  it('references only files that exist', () => {
    const files = []
    for (const clip of ['hero-before-16x9', 'hero-after-16x9', 'hero-before-9x16', 'hero-after-9x16']) {
      files.push(`${clip}.webm`, `${clip}.mp4`, `${clip}.jpg`)
    }
    for (const r of ['16x9', '9x16']) files.push(`hero-transition-${r}.webm`, `hero-transition-${r}.mp4`)
    for (const which of ['before', 'after']) files.push(`card-${which}.webm`, `card-${which}.mp4`)
    for (let i = 1; i <= media.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= media.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    expect(readFileSync(here('media.json'), 'utf8')).toContain('build-media.mjs')
  })
})
