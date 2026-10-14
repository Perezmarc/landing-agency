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

  it('gives the stream below the hero its x and width in its column, and each rendition its aspect', () => {
    const { x, width } = media.stream
    // A thin stream (about 2% of the 1080 source, 30 px edge to edge) in a
    // column a few times as wide, with room either side for the mask.
    expect(width).toBeGreaterThan(0.1)
    expect(width).toBeLessThan(0.35)
    expect(x - width / 2).toBeGreaterThan(0.3)
    expect(x + width / 2).toBeLessThan(0.75)
    // Tall columns, the phone's the taller (it is drawn the smallest).
    for (const r of ['16x9', '9x16']) expect(media.stream[r].aspect).toBeLessThan(0.1)
    expect(media.stream['9x16'].aspect).toBeLessThan(media.stream['16x9'].aspect)
  })

  it('gives the BEFORE strip its scale and edge, and the AFTER rim its atlas', () => {
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
    // AFTER: ten pieces, inside the atlas and apart, at the sizes the page
    // assumes (the corners square, the strips the band deep).
    const rim = media.cards.rim, [W, H] = rim.size
    expect(Object.keys(rim.pieces).sort()).toEqual(['bl', 'bottom', 'br', 'in', 'left', 'out', 'right', 'tl', 'top', 'tr'])
    const rects = Object.values(rim.pieces)
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(2); expect(y).toBeGreaterThanOrEqual(2)
      expect(x + w).toBeLessThanOrEqual(W - 2); expect(y + h).toBeLessThanOrEqual(H - 2)
    }
    for (const [i, a] of rects.entries()) for (const b of rects.slice(i + 1)) {
      const apart = a[0] + a[2] + 4 <= b[0] || b[0] + b[2] + 4 <= a[0] || a[1] + a[3] + 4 <= b[1] || b[1] + b[3] + 4 <= a[1]
      expect(apart).toBe(true)
    }
    for (const k of ['tl', 'tr', 'bl', 'br']) expect(rim.pieces[k].slice(2)).toEqual([rim.out + rim.corner, rim.out + rim.corner])
    expect(rim.pieces.top[3]).toBe(rim.out + rim.in)
    expect(rim.pieces.left[2]).toBe(rim.out + rim.in)
    // Where meeting pieces share their offset (the browser snaps them alike).
    const p = rim.pieces
    expect(p.top[1]).toBe(p.tl[1]); expect(p.tr[1]).toBe(p.tl[1])
    expect(p.left[0]).toBe(p.tl[0]); expect(p.bl[0]).toBe(p.tl[0])
    expect(p.right[0] + p.right[2]).toBe(p.tr[0] + p.tr[2]); expect(p.br[0] + p.br[2]).toBe(p.tr[0] + p.tr[2])
    expect(p.bottom[1] + p.bottom[3]).toBe(p.bl[1] + p.bl[3]); expect(p.br[1] + p.br[3]).toBe(p.bl[1] + p.bl[3])
    // The streams' pieces run `above` over the contour and `below` under it.
    expect(p.in[3]).toBe(rim.above + rim.in)
    expect(p.out[3]).toBe(rim.below + rim.in)
    // The corner is redrawn to the card's radius at the page's scale (0.4).
    expect(rim.radius * 0.4).toBe(16)
    // The flare widens toward the rim, from the incoming stream's width.
    const widths = [...rim.flare].sort((a, b) => b[0] - a[0]).map(([, w]) => w)
    expect(widths.length).toBeGreaterThan(10)
    widths.slice(1).forEach((w, i) => expect(w).toBeGreaterThanOrEqual(widths[i] - 1))
    expect(widths[0]).toBeGreaterThan(12)
    expect(widths[0]).toBeLessThan(30)
    expect(media.cards.after).toBeUndefined()
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
    for (const clip of ['card-splash', 'card-rim']) files.push(`${clip}.webm`, `${clip}.mp4`)
    // The stream below the hero, in both renditions: its clip and its still.
    for (const r of ['16x9', '9x16']) files.push(...['webm', 'mp4', 'avif', 'webp'].map(e => `day-stream-${r}.${e}`))
    // The pool, in both renditions: its clip, and its poster ready to serve as the footer's background.
    for (const name of ['footer-pool', 'footer-pool-narrow']) files.push(`${name}.webm`, `${name}.mp4`, `${name}.avif`, `${name}.webp`)
    for (let i = 1; i <= media.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= media.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    // The BEFORE card's old full-frame clip was replaced by the splash strip.
    for (const f of ['card-before.webm', 'card-before.mp4']) expect(existsSync(here(f)), f).toBe(false)
    // The stacked card-stream clip, and the AFTER card's slab clip, were
    // replaced by the stream clip and the rim.
    for (const f of ['card-stream.webm', 'card-stream.mp4', 'card-after.webm', 'card-after.mp4']) expect(existsSync(here(f)), f).toBe(false)
    expect(readFileSync(here('media.json'), 'utf8')).toContain('build-media.mjs')
  })
})
