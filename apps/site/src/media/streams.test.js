import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import streams from './streams.json' with { type: 'json' }

/* The pipeline's contract (scripts/media/build-media.mjs): the stream is one
   line down the page, so every clip must hand it on at the rail's position
   and width. A regenerated clip that breaks this fails here, not on the page. */

const here = name => fileURLToPath(new URL(name, import.meta.url))
const frac = v => typeof v === 'number' && v > 0 && v < 1

describe('streams.json', () => {
  it('has the shape the page reads', () => {
    expect(frac(streams.rail.streamWidth)).toBe(true)
    expect(streams.rail.w).toBeGreaterThan(0)
    expect(streams.rail.h).toBeGreaterThan(0)
    for (const r of ['16x9', '9x16']) {
      const { exit, transition } = streams.hero[r]
      expect(frac(exit.x) && frac(exit.width), r).toBe(true)
      // The crash plays once: a few seconds, not a loop.
      expect(transition, `${r} transition seconds`).toBeGreaterThan(1)
      expect(transition, `${r} transition seconds`).toBeLessThan(8)
    }
  })

  it('moments carry the stream through their centre: entry ≈ exit ≈ 0.5', () => {
    const { pebble, end } = streams.moments
    expect(pebble.entry.x).toBeCloseTo(0.5, 1)
    expect(pebble.exit.x).toBeCloseTo(pebble.entry.x, 1)
    expect(Math.abs(pebble.exit.width - pebble.entry.width) / pebble.entry.width).toBeLessThan(0.25)
    expect(end.entry.x).toBeCloseTo(0.5, 1)
  })

  it('the hero AFTER clips leave the stream where the rail runs: ≈68% landscape, the right gutter on portrait', () => {
    expect(streams.hero['16x9'].exit.x).toBeGreaterThan(0.64)
    expect(streams.hero['16x9'].exit.x).toBeLessThan(0.72)
    expect(streams.hero['9x16'].exit.x).toBeGreaterThan(0.72)
    expect(streams.hero['9x16'].exit.x).toBeLessThan(0.8)
  })

  it('references only files that exist', () => {
    const files = ['rail-strip.webp']
    for (const clip of ['hero-before-16x9', 'hero-after-16x9', 'hero-before-9x16', 'hero-after-9x16', 'pebble', 'end']) {
      files.push(`${clip}.webm`, `${clip}.mp4`, `${clip}.jpg`)
    }
    for (const r of ['16x9', '9x16']) files.push(`hero-transition-${r}.webm`, `hero-transition-${r}.mp4`)
    for (let i = 1; i <= streams.stones.raw; i++) files.push(`stones/raw-${i}.webp`)
    for (let i = 1; i <= streams.stones.pebble; i++) files.push(`stones/pebble-${i}.webp`)
    files.forEach(f => expect(existsSync(here(f)), f).toBe(true))
    expect(readFileSync(here('streams.json'), 'utf8')).toContain('build-media.mjs')
  })
})
