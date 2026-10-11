/* The crash's particles, precomputed from the crystal cutout's alpha with a
   seeded PRNG. Pure, so the same crystal always shatters the same way and the
   tests can check every particle starts inside the crystal.

   Coordinates are fractions of the cutout (0–1, y down). Motion is analytic
   in the shaders (burst.js): p = p0 + v·t + ½g·t² + noise. */

/** mulberry32: a small, fast, seeded PRNG returning [0, 1). */
export function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Points inside the alpha mask (alpha > threshold), as [x, y] fractions. */
function sampler(alpha, w, h, threshold, rand) {
  const inside = []
  for (let i = 0; i < w * h; i++) if (alpha[i] > threshold) inside.push(i)
  return () => {
    const i = inside[Math.floor(rand() * inside.length)]
    return [((i % w) + rand()) / w, (Math.floor(i / w) + rand()) / h]
  }
}

/**
 * @param {{ alpha: Uint8Array|Uint8ClampedArray, w: number, h: number, shards: number, dust: number, seed?: number, aspect?: number }} o
 *   alpha — one byte per pixel; aspect — cutout width / height in px
 * @returns {{ shards: Float32Array, dust: Float32Array, impact: [number, number] }}
 *   shards: 3 vertices × 8 floats (pos.xy, centre.xy, vel.xy, spin, seed)
 *   dust:   6 floats (pos.xy, vel.xy, seed, size)
 */
export function generateParticles({ alpha, w, h, shards, dust, seed = 7, aspect = 1 }) {
  const rand = prng(seed)
  // The impact point: the crystal's crown, the top-centre of its alpha.
  let top = h, sumX = 0, n = 0
  for (let y = 0; y < h && n === 0; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > 128) { top = y; sumX += x; n++ }
  const impact = [n ? (sumX / n + 0.5) / w : 0.5, (top + 0.5) / h]

  const inShard = sampler(alpha, w, h, 128, rand)
  const shardData = new Float32Array(shards * 3 * 8)
  for (let s = 0; s < shards; s++) {
    const [cx, cy] = inShard()
    const r = 0.012 + rand() * 0.035, a0 = rand() * Math.PI * 2
    let dx = cx - impact[0], dy = (cy - impact[1]) / aspect
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len
    const speed = 0.35 + rand() * 0.9
    const vx = dx * speed, vy = dy * speed * aspect - 0.25 - rand() * 0.25
    const spin = (rand() - 0.5) * 12, sd = rand()
    for (let k = 0; k < 3; k++) {
      const ang = a0 + k * (Math.PI * 2 / 3) + (rand() - 0.5) * 0.9, rr = r * (0.6 + rand() * 0.7)
      const o = (s * 3 + k) * 8
      shardData.set([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * aspect, cx, cy, vx, vy, spin, sd], o)
    }
  }

  const inDust = sampler(alpha, w, h, 64, rand)
  const dustData = new Float32Array(dust * 6)
  for (let d = 0; d < dust; d++) {
    const [x, y] = inDust()
    let dx = x - impact[0], dy = y - impact[1]
    const len = Math.hypot(dx, dy) || 1
    // Drift away down and to the right, with a little of the burst in it.
    const vx = 0.12 + rand() * 0.3 + (dx / len) * 0.12, vy = 0.05 + rand() * 0.25 + (dy / len) * 0.08
    dustData.set([x, y, vx, vy, rand(), 1 + rand() * 2], d * 6)
  }
  return { shards: shardData, dust: dustData, impact }
}
