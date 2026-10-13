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
    // Its width there, edge to edge: a thin stream (about 20 px of the
    // 1600-wide frame), wider in the portrait frame, which shows the
    // landscape one scaled up.
    expect(media.hero['16x9'].stream.width).toBeGreaterThan(8 / 1600)
    expect(media.hero['16x9'].stream.width).toBeLessThan(32 / 1600)
    expect(media.hero['9x16'].stream.width).toBeGreaterThan(media.hero['16x9'].stream.width)
    expect(media.hero['9x16'].stream.width).toBeLessThan(0.04)
    // The portrait clips run on below their 9:16 frame.
    expect(media.hero['9x16'].extend).toBeGreaterThanOrEqual(0.3)
    expect(media.hero['16x9'].extend).toBeUndefined()
  })

  it('gives the BEFORE strip its scale and edge, and the AFTER clip a box to fit to its card', () => {
    // BEFORE: a thin strip along the slab's top edge (a wide, short frame),
    // its source width (the page draws it at a fraction of a CSS px per
    // source px) and its edge row low in it: the splashes above, a few rows
    // of the slab under it.
    const { aspect, width, edge } = media.cards.before
    expect(aspect).toBeGreaterThan(10)
    expect(aspect).toBeLessThan(20)
    expect(width).toBeGreaterThan(900)
    expect(edge).toBeGreaterThan(0.7)
    expect(edge).toBeLessThan(0.9)
    expect(media.cards.before.fit).toBeUndefined()
    // AFTER: the slab's silhouette, inside the frame, with room below for
    // the stream going out; it starts at the card's top edge (the stream
    // coming in is drawn by the page).
    const { fit } = media.cards.after
    expect(media.cards.after.aspect).toBeGreaterThan(0.5)
    expect(media.cards.after.aspect).toBeLessThan(4)
    expect(fit.left).toBeGreaterThan(0)
    expect(fit.right).toBeLessThan(1)
    expect(fit.right - fit.left).toBeGreaterThan(0.5)
    expect(fit.bottom).toBeGreaterThan(fit.top)
    expect(fit.top).toBeGreaterThan(0)
    expect(fit.top).toBeLessThan(0.05)
    expect(fit.bottom).toBeLessThan(0.9)
    // The stream down to the AFTER card is drawn, not a clip.
    expect(media.cards.stream).toBeUndefined()
  })

  it('gives the footer pool its band, its phone rendition and waterline', () => {
    const { aspect, waterline, narrow } = media.footer.pool
    // A wide, short band, like the footer.
    expect(aspect).toBeGreaterThan(3)
    expect(aspect).toBeLessThan(5)
    // The phone rendition: the band's centre, the same rows, narrower.
    expect(narrow.aspect).toBeGreaterThan(1.5)
    expect(narrow.aspect).toBeLessThan(aspect)
    // Both clips are 10-bit AV1, and their <source> type says so.
    for (const { av1 } of [media.footer.pool, narrow]) expect(av1).toMatch(/^av01\.0\.\d\dM\.10$/)
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
    for (const clip of ['card-splash', 'card-after']) files.push(`${clip}.webm`, `${clip}.mp4`)
    // The pool, in both renditions: its clip, and its poster ready to serve as the footer's background.
    for (const name of ['footer-pool', 'footer-pool-narrow']) files.push(`${name}.webm`, `${name}.mp4`, `${name}.avif`, `${name}.webp`)
    for (let i = 1; i <= media.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= media.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    // The BEFORE card's old full-frame clip was replaced by the splash strip.
    for (const f of ['card-before.webm', 'card-before.mp4']) expect(existsSync(here(f)), f).toBe(false)
    // The stacked card-stream clip was replaced by the drawn stream.
    for (const f of ['card-stream.webm', 'card-stream.mp4']) expect(existsSync(here(f)), f).toBe(false)
    expect(readFileSync(here('media.json'), 'utf8')).toContain('build-media.mjs')
  })
})
