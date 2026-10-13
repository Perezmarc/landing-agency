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

  it('says where the hero stream leaves each rendition, and how far the portrait one runs on', () => {
    // Under the pebble: about two thirds across the landscape frame, the
    // middle of the portrait one.
    expect(media.hero['16x9'].stream.x).toBeGreaterThan(0.6)
    expect(media.hero['16x9'].stream.x).toBeLessThan(0.72)
    expect(Math.abs(media.hero['9x16'].stream.x - 0.5)).toBeLessThan(0.03)
    // One card-stream pixel: a 1600-wide frame's pixel, scaled as the
    // portrait composition scales it.
    expect(media.hero['16x9'].stream.unit).toBeCloseTo(1 / 1600, 6)
    expect(media.hero['9x16'].stream.unit).toBeGreaterThan(media.hero['16x9'].stream.unit)
    // The portrait clips run on below their 9:16 frame.
    expect(media.hero['9x16'].extend).toBeGreaterThanOrEqual(0.3)
    expect(media.hero['16x9'].extend).toBeUndefined()
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
    // AFTER: it starts at the card's top edge (the stream coming in is the
    // stream clip), with room below for the stream going out.
    expect(media.cards.after.fit.top).toBeGreaterThan(0)
    expect(media.cards.after.fit.top).toBeLessThan(0.05)
    expect(media.cards.after.fit.bottom).toBeLessThan(0.9)
    // The stream: a tall, narrow column with the stream in its middle.
    const { aspect, width, x } = media.cards.stream
    expect(aspect).toBeLessThan(0.5)
    expect(width).toBeGreaterThanOrEqual(64)
    expect(Math.abs(x - 0.5)).toBeLessThan(0.1)
  })

  it('gives the footer pool its band and waterline', () => {
    const { aspect, waterline } = media.footer.pool
    // A wide, short band, like the footer.
    expect(aspect).toBeGreaterThan(3)
    expect(aspect).toBeLessThan(5)
    // The waterline is the band's top edge: a few rows of white above it
    // (so the line is never cut), the water below.
    expect(waterline).toBeGreaterThan(0)
    expect(waterline).toBeLessThan(0.02)
  })

  it('references only files that exist', () => {
    const files = []
    for (const clip of ['hero-before-16x9', 'hero-after-16x9', 'hero-before-9x16', 'hero-after-9x16']) {
      files.push(`${clip}.webm`, `${clip}.mp4`, `${clip}.jpg`)
    }
    for (const r of ['16x9', '9x16']) files.push(`hero-transition-${r}.webm`, `hero-transition-${r}.mp4`)
    for (const which of ['before', 'after', 'stream']) files.push(`card-${which}.webm`, `card-${which}.mp4`)
    // The pool: its clip, and its poster ready to serve as the footer's background.
    files.push('footer-pool.webm', 'footer-pool.mp4', 'footer-pool.avif', 'footer-pool.webp')
    for (let i = 1; i <= media.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= media.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    expect(readFileSync(here('media.json'), 'utf8')).toContain('build-media.mjs')
  })
})
