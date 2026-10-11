import { describe, it, expect } from 'vitest'
import { prng, generateParticles } from './particles.js'

// A 40×20 mask with an opaque ellipse in the middle.
const W = 40, H = 20
const alpha = new Uint8Array(W * H)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (((x - 20) / 16) ** 2 + ((y - 10) / 8) ** 2 < 1) alpha[y * W + x] = 255
}
const at = (fx, fy) => alpha[Math.min(H - 1, Math.floor(fy * H)) * W + Math.min(W - 1, Math.floor(fx * W))]

describe('the seeded PRNG', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = prng(42), b = prng(42), c = prng(43)
    const xs = Array.from({ length: 200 }, a)
    expect(Array.from({ length: 200 }, b)).toEqual(xs)
    expect(c()).not.toBe(xs[0])
    xs.forEach(x => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) })
  })
})

describe('the crash particles', () => {
  const p = generateParticles({ alpha, w: W, h: H, shards: 50, dust: 400, seed: 3, aspect: 2 })

  it('are the requested counts', () => {
    expect(p.shards.length).toBe(50 * 3 * 8)
    expect(p.dust.length).toBe(400 * 6)
  })

  it('start inside the crystal: every shard centre and every dust point', () => {
    for (let i = 0; i < p.shards.length; i += 8) expect(at(p.shards[i + 2], p.shards[i + 3])).toBe(255)
    for (let i = 0; i < p.dust.length; i += 6) expect(at(p.dust[i], p.dust[i + 1])).toBe(255)
  })

  it('burst from the crown: the impact is at the top of the mask', () => {
    expect(p.impact[1]).toBeLessThan(0.2)
    expect(p.impact[0]).toBeGreaterThan(0.3)
    expect(p.impact[0]).toBeLessThan(0.7)
  })

  it('are the same for the same crystal and seed', () => {
    expect(generateParticles({ alpha, w: W, h: H, shards: 50, dust: 400, seed: 3, aspect: 2 }).dust).toEqual(p.dust)
  })
})
