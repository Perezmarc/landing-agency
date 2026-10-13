#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   build-media — turns the generated clips and stills into the landing page's
   web media. Offline and deliberate: it is NOT part of `npm run build`, and its
   outputs are committed under apps/site/src/media/, so a deploy never depends
   on a generation service or on ffmpeg.

       node scripts/media/build-media.mjs            # everything
       node scripts/media/build-media.mjs --check    # only the checks
       node scripts/media/build-media.mjs --only card-before,card-after
                                                     # some clips (patches media.json)

   Needs ffmpeg (libsvtav1, libx264) on PATH; sharp comes from the workspace.
   Sources are listed in sources.json by permanent URL and cached in .cache/.
   Generating NEW sources costs Higgsfield credits: the owner approves the
   total first (see docs/LANDING-DESIGN.md).

   What it does, per clip:
     1. Grade to white. The void estimate is the per-pixel 90th percentile over
        all frames (frame 0 would bake the rain in), low-passed and iterated
        so objects drop out of it. Gain = 255 / field, applied only to the void
        (object weight = smoothstep(|frame − field|, OBJECT.lo, OBJECT.hi),
        blurred), so the stone and the water keep their tones. Near-white is
        soft-snapped to pure white; exposure is normalised per frame
        (generated video flickers). Every hero clip keeps part of the soft
        overhead light around the stone (keepMap), so the rain falling
        through it stays visible; a portrait clip's top, under the copy, goes
        to white.
     2. Loop. The last second is cross-faded into the first, then cut (a
        source that already ends on its first frame just wraps: `seamless`).
     3. Encode AV1 WebM + H.264 MP4 (+faststart, BT.709, closed GOP, no audio),
        and write the first frame as the poster source.
   The hero transition (the crash) is graded and encoded the same way but not
   looped: it plays once, minus its still head (CRASH_HEAD). All three portrait
   hero clips are composed here from the landscape ones (composePortrait), so
   the pebble sits in the same place in each and the cuts stay invisible.
   The card clips (the calendar's water) are cropped to their slab and graded
   against a clean plate of it (cardPlate): the slab goes to white and only
   the water is left. No posters: they only ever play over the finished card.
   The footer's pool (water seen from the side) is cropped to a wide band
   from its waterline down and graded against its own median frame
   (poolGrader): the white above the line goes to pure white, and every
   column takes the same row profile, so the waterline is one flat line and
   only the moving water is kept, made clear and neutral. It is encoded in
   two renditions, the full band and its centre for phones (buildPool), each
   as 10-bit AV1, H.264, and a poster as AVIF and WebP for the footer's CSS
   background.
   Then: the stones, and media.json (the crash's duration, each card clip's
   fit box, the pool's aspect and waterline, the stone counts). The checks also measure the crash's
   two cuts (PSNR of the frames either side of each).
   ═══════════════════════════════════════════════════════════════════════════ */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, writeFileSync, statSync, createWriteStream, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const CACHE = join(HERE, '.cache')
const OUT = join(ROOT, 'apps', 'site', 'src', 'media')
const SOURCES = JSON.parse(readFileSync(join(HERE, 'sources.json'), 'utf8'))

const FPS = 24
const LOOP_FADE = FPS            // one second
/* The crash source holds the unchanged rock for its first 7 frames (0.29 s):
   the burst starts on frame 7. Dropping the first 6 frames starts the clip
   one frame before it, still on the BEFORE rock, so the cut from the BEFORE
   loop stays invisible and the shatter is immediate. */
const CRASH_HEAD = 6
const CHECK_ONLY = process.argv.includes('--check')
const ONLY_AT = process.argv.indexOf('--only')
const ONLY = ONLY_AT > 0 ? new Set(process.argv[ONLY_AT + 1].split(',')) : null

/* The calendar's card clips, in their 1280×720 sources (pixels): `slab` is
   the pale slab's box, measured on the per-pixel median frame (the plate is
   built around it), `crop` what is kept of the frame, and `fit` the box the
   page fits to the card's edges (media.json → marketing.css).
   BEFORE: cropped to the slab's own width, so the slab spans the card; the
   crop keeps the streams above its top edge and the drips a short way down
   its face, and `fit` is the slab (its top edge on the card's top border).
   AFTER: the water runs down the slab's face just inside its left and right
   edges and leaves below as one stream. `fit` is the inner edges of those
   two sheets (measured on the graded clip) and the slab's top and bottom, so
   the card hides the face and the sheets run just outside its sides. Its
   first 48 frames build the flow up from a dry slab, so the loop starts
   after them (they still feed the plate: that is where the edges are dry). */
const CARD = {
  before: {
    slab: { x0: 131, y0: 284, x1: 1157, y1: 720 }, crop: { x: 131, y: 114, w: 1026, h: 430 },
    fit: { x0: 131, y0: 284, x1: 1157, y1: 720 },
  },
  after: {
    slab: { x0: 345, y0: 173, x1: 935, y1: 577 }, crop: { x: 285, y: 40, w: 710, h: 680 },
    fit: { x0: 377, y0: 173, x1: 897, y1: 577 },
  },
}

/* The footer's pool, in its 1920×1080 source (pixels): a filled container
   seen exactly from the side, white above, the body of water below. The
   waterline is flat to a pixel across the frame (its first row, y 525, on
   the per-pixel median frame); the 15 rows above it (y 510–524) are a grey
   strip of the surface seen from just above. `crop` starts 8 rows above the
   line, inside that strip, which the grade turns to pure white (8 rows, so
   the posters' lossy edge never reaches the first row: AVIF's first row is
   254 and up), and runs to the bottom: a band wide and short like the
   footer, with the line at its top. Below the line, the meniscus
   (y 525–558: the line itself, moving up and down a few pixels as the
   surface rocks, and the surface's underside reflected in it) is 34 rows
   deep, a thick glassy band at the footer's edge; `meniscus` squeezes it
   into 12 rows (poolRows), so it reads as one thin line and the body of
   water starts right under it. `wall` is a patch of the white
   above the line (the centre third, where it is brightest, luma 236): the
   white the grade maps to 255. The frame is vignetted (the white falls to
   luma 212 at the edges) and the meniscus is drawn harder at the edges
   (near-black there, mid-grey in the middle), so the grade gives every
   column the centre third's row profile and keeps only what moves (see
   poolGrader). The footer's copy sits on the water, so its darkest tones (a
   drop's outline, a bubble) are lifted onto a soft floor: below `knee`,
   v → floor + (knee − floor) × √(v / knee).
   Then the water is made clear: its distance from white is scaled by
   `clear` (v → 255 − clear × (255 − v): lighter, with the caustics' shape
   kept), and it is given one colour, a whisper of cool grey: each channel's
   distance from white is scaled by `tint` (normalised to keep the luma),
   which lands at Lab a* 0, b* −2 at the water's mean (no green: the source's
   water is cyan, a* −4.5). The grade is kept in floating point to the
   encode (a 16-bit intermediate), so the smooth gradients reach the 10-bit
   AV1 without 8-bit steps, and the posters are dithered to 8 bits.
   `narrow`: the phone rendition's width, the band's centre at full
   resolution (the footer is 568px tall on a phone and the band 532 rows,
   so it is drawn at about its own scale). */
const POOL = {
  crop: { x: 0, y: 517, w: 1920, h: 554 }, waterline: 525, meniscus: { end: 559, rows: 12 },
  wall: { x: 640, y: 420, w: 640, h: 72 }, floor: 160, knee: 200,
  clear: 0.65, tint: [1.0688, 0.9942, 0.855], narrow: 1080,
}

/* The clips: output name (also the source key) and output size. Landscape is
   encoded at 1600 wide: the media box is max(100vw, 177.78svh), 1600 on a 1440×900 screen. */
const CLIPS = [
  { name: 'hero-before-16x9', w: 1600, h: 900 },
  { name: 'hero-transition-16x9', w: 1600, h: 900, once: true, head: CRASH_HEAD },
  { name: 'hero-after-16x9', w: 1600, h: 900 },
  // Portrait: all three composed from the landscape clips, so the pebble has
  // exactly the same place and size in each and every cut stays invisible.
  { name: 'hero-before-9x16', w: 720, h: 1280, compose: 'hero-before-16x9' },
  { name: 'hero-transition-9x16', w: 720, h: 1280, once: true, compose: 'hero-transition-16x9', head: CRASH_HEAD },
  { name: 'hero-after-9x16', w: 720, h: 1280, compose: 'hero-after-16x9' },
  // The calendar's water: at most 960 wide (they show at about 600).
  { name: 'card-before', w: 960, h: 402, card: CARD.before },
  { name: 'card-after', w: 710, h: 680, card: CARD.after, head: 48 },
  // The footer's pool: a wide band, from the waterline down, at the source's
  // full width and its own row scale (532 rows: the crop less the squeezed
  // meniscus). Its source ends on its first frame, so it loops as it is,
  // with no cross-fade; frame 0, its poster, is one of its calmest (no drop
  // in the water under the copy). It is shown full-bleed (2880 device
  // pixels at 1440 on a 2× screen), so it is encoded for quality: 10-bit
  // AV1, and x264 with its adaptive quantiser biased to the flat water.
  { name: 'footer-pool', w: 1920, h: 532, pool: POOL, seamless: true, crf: { av1: 16, h264: 20 } },
]

/* ── Portrait composition ────────────────────────────────────────────────────
   The 9:16 hero frames are composed from the 16:9 clips, not outpainted
   (outpainting recomposed the scene). The landscape frame is scaled so the
   pebble is PORTRAIT.W of the portrait width, centred, with its centre at
   PORTRAIT.Y of the height: below the hero copy and buttons on a phone. At
   that scale the landscape frame covers the portrait frame's whole width and
   runs past its bottom, so nothing around or below the pebble is invented;
   above it, the frame feathers into plain white, where the copy sits.
   CX, CY, CW: the pebble in the 16:9 frame (centre and width, as fractions of
   the frame), measured on the AFTER poster; the BEFORE rock sits on it. */
export const PORTRAIT = { CX: 0.667, CY: 0.485, CW: 0.398, X: 0.5, Y: 0.8, W: 0.64 }

function portraitPlacement(w, h) {
  const sw = Math.round(PORTRAIT.W * w / PORTRAIT.CW), sh = Math.round(sw * 9 / 16)
  const left = Math.round(PORTRAIT.X * w - PORTRAIT.CX * sw), top = Math.round(PORTRAIT.Y * h - PORTRAIT.CY * sh)
  if (left > 0 || left + sw < w || top < 0 || top + sh < h) throw new Error(`portrait placement leaves the frame uncovered: ${JSON.stringify({ sw, sh, left, top })}`)
  return { sw, sh, left, top, feather: Math.round(sh * 0.3) }
}

/* How far a pixel must stand out from the void field to count as an object
   (stone, water, rain) and keep its tone: the weight ramps from lo to hi. */
const OBJECT = { lo: 8, hi: 56 }

/* How much of the soft overhead light each pixel keeps (the rest is graded to
   white), in the top 65% of the frame. The rain is white streaks in that
   light: graded to white with it, it would vanish, so the cone of light over
   the stone (LIGHT.cone either side of its centre, fading out by LIGHT.edge)
   keeps most of it, and the wall either side, where the copy sits, keeps
   less. Portrait: the same, measured inside the placed landscape frame, and
   none above it, so the hero copy sits on white. */
const LIGHT = { cone: 0.85, wall: 0.4, half: 0.14, edge: 0.24 }

function keepMap(clip) {
  const { w, h } = clip, keep = new Float32Array(w * h)
  const pl = clip.compose ? portraitPlacement(w, h) : { left: 0, top: 0, sw: w, sh: h, feather: 0 }
  for (let y = 0; y < h; y++) {
    const ly = (y - pl.top) / pl.sh
    const row = ly < 0 ? 0 : (pl.feather ? smoothstep(0, pl.feather / pl.sh, ly) : 1) * (1 - smoothstep(0.45, 0.65, ly))
    for (let x = 0; x < w; x++) {
      const cone = 1 - smoothstep(LIGHT.half, LIGHT.edge, Math.abs((x - pl.left) / pl.sw - PORTRAIT.CX))
      keep[y * w + x] = row * (LIGHT.wall + (LIGHT.cone - LIGHT.wall) * cone)
    }
  }
  return keep
}

/* ── small helpers ───────────────────────────────────────────────────────── */

/** Run a command; returns stdout and stderr together (ffmpeg reports on stderr). */
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 2 ** 28 })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr}`)
  return r.stdout.toString() + r.stderr.toString()
}

async function fetchTo(url, path) {
  if (existsSync(path)) return path
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  return path
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const LUMA = [0.2126, 0.7152, 0.0722]        // BT.709

/** Separable box blur (3 passes ≈ gaussian) of a single-channel Float32Array. */
function blur(src, w, h, r) {
  if (r < 1) return src
  let a = Float32Array.from(src), b = new Float32Array(src.length)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {           // horizontal
      let acc = 0; const row = y * w
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * r + 1)
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]
      }
    }
    for (let x = 0; x < w; x++) {           // vertical
      let acc = 0
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1)
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]
      }
    }
  }
  return a
}

/** Every frame of a clip as raw RGB at (w, h), less the first `head` frames,
    optionally cropped first ({ x, y, w, h } in source pixels). */
function decodeAll(path, w, h, head = 0, crop = null) {
  const cut = crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : ''
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', `trim=start_frame=${head},setpts=PTS-STARTPTS,${cut}scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 2 ** 31 })
  if (raw.status !== 0) throw new Error(raw.stderr.toString())
  const size = w * h * 3, frames = []
  for (let i = 0; i + size <= raw.stdout.length; i += size) frames.push(raw.stdout.subarray(i, i + size))
  return frames
}

/* ── 1. the void field ──────────────────────────────────────────────────── */

/** Per-frame exposure: the median luma, normalised to the clip's median. */
function exposures(frames) {
  const luma = f => { const s = []; for (let i = 0; i < f.length; i += 3 * 17) s.push(0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2]); s.sort((a, b) => a - b); return s[s.length >> 1] }
  const med = frames.map(luma)
  const clipMed = [...med].sort((a, b) => a - b)[med.length >> 1]
  return med.map(m => Math.min(1.06, Math.max(0.94, clipMed / m)))
}

function voidField(frames, w, h) {
  const exposure = exposures(frames)

  // Per-pixel, per-channel 90th percentile over all frames.
  const n = w * h, k = Math.floor(frames.length * 0.9), field = [new Float32Array(n), new Float32Array(n), new Float32Array(n)]
  const col = new Float32Array(frames.length)
  for (let c = 0; c < 3; c++) {
    for (let p = 0; p < n; p++) {
      for (let f = 0; f < frames.length; f++) col[f] = frames[f][p * 3 + c] * exposure[f]
      col.sort(); field[c][p] = col[k]
    }
  }
  // Low-pass (≈48px at full scale), then iterate: pixels that stand out from
  // the smooth field are objects, so they are replaced and the field re-blurred.
  const r = Math.max(2, Math.round(48 * w / 1920 / 2))
  for (let c = 0; c < 3; c++) {
    let smooth = blur(field[c], w, h, r)
    for (let it = 0; it < 3; it++) {
      const fixed = new Float32Array(n)
      for (let p = 0; p < n; p++) fixed[p] = Math.abs(field[c][p] - smooth[p]) > 6 ? smooth[p] : field[c][p]
      smooth = blur(fixed, w, h, r)
    }
    field[c] = smooth
  }
  return { field, exposure }
}

function upsample(src, sw, sh, w, h) {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, (y + 0.5) * sh / h - 0.5), y0 = Math.max(0, Math.floor(fy)), ty = Math.max(0, fy - y0)
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, (x + 0.5) * sw / w - 0.5), x0 = Math.max(0, Math.floor(fx)), tx = Math.max(0, fx - x0)
      const i = y0 * sw + x0
      out[y * w + x] = (src[i] * (1 - tx) + src[i + 1] * tx) * (1 - ty) + (src[i + sw] * (1 - tx) + src[i + sw + 1] * tx) * ty
    }
  }
  return out
}

/* ── 2. grade one frame ─────────────────────────────────────────────────── */

function gradeFrame(frame, w, h, gain, exposure, keep) {
  const n = w * h, weight = new Float32Array(n)
  for (let p = 0; p < n; p++) {
    let dev = 0
    for (let c = 0; c < 3; c++) dev = Math.max(dev, Math.abs(frame[p * 3 + c] * exposure - 255 / gain[c][p]))
    weight[p] = smoothstep(OBJECT.lo, OBJECT.hi, dev)
  }
  const wb = blur(weight, w, h, Math.max(1, Math.round(5 * w / 1920)))
  const out = Buffer.alloc(n * 3)
  for (let p = 0; p < n; p++) {
    const voidness = (1 - wb[p]) * (1 - keep[p])
    for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.min(255, Math.max(0, Math.round(frame[p * 3 + c] * exposure * (1 + (gain[c][p] - 1) * voidness))))
    snapWhite(out, p)
  }
  return out
}

/** Soft-snap a near-white pixel to pure white (deviation 7–20 ramps). */
function snapWhite(out, p) {
  const d = 255 - Math.min(out[p * 3], out[p * 3 + 1], out[p * 3 + 2])
  if (d >= 20) return
  const t = d <= 7 ? 1 : 1 - (d - 7) / 13
  for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.round(out[p * 3 + c] + (255 - out[p * 3 + c]) * t)
}

/* ── 2b. the card clips: a clean plate ─────────────────────────────────────
   A card clip is a still slab under moving water, so it is graded by
   division: each pixel over the clean plate (the slab and the wall with no
   water on them) gives the slab and the wall as white and keeps the water,
   in its own light and shade, for the page to multiply over its card.
   The plate is built in three parts, by the slab's signed distance:
     - the wall (outside): the per-pixel 90th percentile, low-passed with
       objects iterated out, as in voidField, but over the wall only;
     - the slab's face (inside): the per-pixel median, low-passed over the
       face only, so the drips, sheets and ripples drop out of it;
     - the slab's rim (a band either side of its edge, sharp, so a low-pass
       cannot hold it): the median of the calmest 8 frames there, the ones
       where the rim is dry. */
const PLATE = { radius: 24, tol: 6, ring: 7, window: 8 }

/** Low-pass of `v` over the pixels where `m` is 1 (normalised), with values
    that stand out from it iterated out. */
function maskedSmooth(v, m, w, h) {
  const n = w * h, den = blur(m, w, h, PLATE.radius)
  const pass = (src) => { const num = new Float32Array(n); for (let p = 0; p < n; p++) num[p] = src[p] * m[p]; const b = blur(num, w, h, PLATE.radius); for (let p = 0; p < n; p++) b[p] = den[p] > 1e-4 ? b[p] / den[p] : 255; return b }
  let smooth = pass(v)
  for (let it = 0; it < 3; it++) {
    const fixed = new Float32Array(n)
    for (let p = 0; p < n; p++) fixed[p] = Math.abs(v[p] - smooth[p]) > PLATE.tol ? smooth[p] : v[p]
    smooth = pass(fixed)
  }
  return smooth
}

/** The slab's signed distance (negative inside), a rounded box in output pixels. */
function slabDistance(s, x, y) {
  const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2, hx = (s.x1 - s.x0) / 2 - s.r, hy = (s.y1 - s.y0) / 2 - s.r
  const qx = Math.abs(x + 0.5 - cx) - hx, qy = Math.abs(y + 0.5 - cy) - hy
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r
}

function cardPlate(frames, w, h, slab) {
  const n = w * h, F = frames.length, exposure = exposures(frames)
  const dist = new Float32Array(n), inside = new Float32Array(n), outside = new Float32Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = slabDistance(slab, x, y), p = y * w + x; dist[p] = d; inside[p] = d < -PLATE.ring ? 1 : 0; outside[p] = d > PLATE.ring ? 1 : 0 }

  // The calmest window per pixel: the least luma variance over W frames, blurred so neighbours agree.
  const W = PLATE.window, starts = []
  for (let s = 0; s + W <= F; s += W / 2) starts.push(s)
  const best = new Float32Array(n).fill(Infinity), pick = new Int16Array(n)
  for (const [k, s] of starts.entries()) {
    const sd = new Float32Array(n)
    for (let p = 0; p < n; p++) {
      let a = 0, b = 0
      for (let f = s; f < s + W; f++) { const l = (0.2126 * frames[f][p * 3] + 0.7152 * frames[f][p * 3 + 1] + 0.0722 * frames[f][p * 3 + 2]) * exposure[f]; a += l; b += l * l }
      sd[p] = b / W - (a / W) ** 2
    }
    const sb = blur(sd, w, h, 3)
    for (let p = 0; p < n; p++) if (sb[p] < best[p]) { best[p] = sb[p]; pick[p] = k }
  }

  const plate = [0, 1, 2].map(() => new Float32Array(n)), col = new Float32Array(F), win = new Float32Array(W)
  for (let c = 0; c < 3; c++) {
    const med = new Float32Array(n), p90 = new Float32Array(n), calm = new Float32Array(n)
    for (let p = 0; p < n; p++) {
      for (let f = 0; f < F; f++) col[f] = frames[f][p * 3 + c] * exposure[f]
      for (let j = 0; j < W; j++) win[j] = col[starts[pick[p]] + j]
      col.sort(); win.sort()
      med[p] = col[F >> 1]; p90[p] = col[Math.floor(F * 0.9)]; calm[p] = (win[W / 2 - 1] + win[W / 2]) / 2
    }
    const wall = maskedSmooth(p90, outside, w, h), face = maskedSmooth(med, inside, w, h)
    for (let p = 0; p < n; p++) {
      const d = dist[p], rim = 1 - smoothstep(PLATE.ring - 2, PLATE.ring, Math.abs(d))
      plate[c][p] = (d < 0 ? face[p] : wall[p]) * (1 - rim) + calm[p] * rim
    }
  }
  return { plate, exposure }
}

function gradeCard(frame, w, h, plate, exposure) {
  const n = w * h, out = Buffer.alloc(n * 3)
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.min(255, Math.max(0, Math.round(frame[p * 3 + c] * exposure * 255 / Math.max(60, plate[c][p]))))
    snapWhite(out, p)
  }
  return out
}

/* ── 2c. the footer's pool ────────────────────────────────────────────────
   Water seen from the side: everything that does not move (the white, the
   meniscus, the body of water's tone, the vignette) is in the per-pixel
   median frame, and everything that moves (drops, bubbles, rings, caustics)
   is each frame's difference from it. So the still part is replaced by one
   row profile for every column, the centre third's median of the median
   frame, white-balanced on the wall above the line (`wall` → 255) and pure
   white above the waterline; and the moving part is added back on top, as
   luma (so the water keeps one colour), scaled by the same correction (bounded, so a splash over the meniscus's
   near-black edge pixels does not blow up). The waterline is then one flat,
   even line edge to edge, and the water is evenly lit. Its darkest tones
   are lifted onto the soft floor, then it is made clear and given its one
   colour (POOL). Its frames are floating-point RGB (0–255), for buildPool. */
/** The pool's rows: the output row the waterline is on, and the output frame
    from a frame decoded at the crop's own height (`h` rows from `crop.h`),
    each row the area average of the source rows it covers, the meniscus
    squeezed (POOL.meniscus) and every other row at the band's one scale. */
function poolRows({ w, h, pool: { crop, waterline, meniscus } }) {
  const a = waterline - crop.y, b = a + meniscus.rows, squeeze = (meniscus.end - waterline) / meniscus.rows
  const U = crop.h - (meniscus.end - waterline) + meniscus.rows
  const src = u => u < a ? u : u < b ? a + (u - a) * squeeze : meniscus.end - crop.y + (u - b)
  const span = Array.from({ length: h }, (_, y) => [src(y * U / h), src((y + 1) * U / h)])
  return {
    line: a * h / U,
    remap(frame) {
      const out = Buffer.alloc(w * h * 3), acc = new Float32Array(w * 3)
      for (let y = 0; y < h; y++) {
        const [s0, s1] = span[y]
        acc.fill(0)
        for (let r = Math.floor(s0); r < Math.min(crop.h, Math.ceil(s1)); r++) {
          const k = Math.min(s1, r + 1) - Math.max(s0, r), row = r * w * 3
          for (let i = 0; i < w * 3; i++) acc[i] += frame[row + i] * k
        }
        for (let i = 0; i < w * 3; i++) out[y * w * 3 + i] = Math.round(acc[i] / (s1 - s0))
      }
      return out
    },
  }
}

function poolGrader(clip, src) {
  const { w, h, pool: { crop, wall, floor, knee, clear, tint } } = clip
  const lift = v => v >= knee ? v : floor + (knee - floor) * Math.sqrt(Math.max(0, v) / knee)
  // The water's one colour: luma v → each channel's distance from white,
  // made clear and tinted.
  const k = tint.map(t => clear * t / LUMA.reduce((s, l, c) => s + l * tint[c], 0))
  const median = (a) => { a.sort(); return (a[(a.length - 1) >> 1] + a[a.length >> 1]) / 2 }

  // The white: the wall patch's median, per channel, over every frame.
  const ww = wall.w / 8, wh = wall.h / 8, patch = decodeAll(src, ww, wh, 0, wall)
  const white = [0, 1, 2].map(c => { const v = []; for (const f of patch) for (let p = 0; p < ww * wh; p++) v.push(f[p * 3 + c]); return median(Float32Array.from(v)) })

  const rows = poolRows(clip), frames = decodeAll(src, w, crop.h, 0, crop).map(rows.remap)
  const F = frames.length, n = w * h, exposure = exposures(frames)
  const still = [0, 1, 2].map(() => new Float32Array(n)), col = new Float32Array(F)
  for (let c = 0; c < 3; c++) for (let p = 0; p < n; p++) {
    for (let f = 0; f < F; f++) col[f] = frames[f][p * 3 + c] * exposure[f]
    still[c][p] = median(col)
  }
  // The row profile, in luma: the centre third's median, white-balanced on
  // the wall. Above the waterline everything is pure white, eased in over one row.
  const x0 = Math.round(w / 3), x1 = Math.round(2 * w / 3)
  const row = Float32Array.from({ length: h }, (_, y) => LUMA.reduce((t, l, c) =>
    t + l * Math.min(255, median(Float32Array.from({ length: x1 - x0 }, (_, i) => still[c][y * w + x0 + i])) * 255 / white[c]), 0))
  const water = Float32Array.from({ length: h }, (_, y) => smoothstep(rows.line - 0.5, rows.line + 0.5, y + 0.5))
  return {
    count: F,
    graded: (i) => {
      const f = frames[i], e = exposure[i], out = new Float32Array(n * 3)
      for (let y = 0; y < h; y++) {
        const t = row[y]
        for (let x = 0; x < w; x++) {
          const p = y * w + x
          // What moves, in luma only: the source's own slight tints would
          // read as blotches on the water's one colour.
          let d = 0, s = 0
          for (let c = 0; c < 3; c++) { d += LUMA[c] * (f[p * 3 + c] * e - still[c][p]); s += LUMA[c] * still[c][p] }
          d *= Math.min(1.6, Math.max(0.8, t / Math.max(1, s)))
          const depth = (255 - Math.min(255, lift(t + d))) * water[y]   // the floor, then the distance from white
          for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.max(0, 255 - depth * k[c])
        }
      }
      return out
    },
  }
}

/* ── 3. grade + loop + encode a clip ────────────────────────────────────── */

function encoder(args) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] })
  return { write: buf => new Promise(res => p.stdin.write(buf) ? res() : p.stdin.once('drain', res)), close: () => new Promise((res, rej) => { p.on('close', code => code ? rej(new Error(`ffmpeg ${code}`)) : res()); p.stdin.end() }) }
}

/* ── portrait composition ───────────────────────────────────────────────────
   A 16:9 hero clip placed in a 9:16 frame (portraitPlacement): cropped at the
   sides, running past the bottom, and feathered at its top into a still,
   smooth plate: the first frame's top rows averaged per column and blurred
   wide, so no rain streak or fragment is ever stretched. The grade then takes
   that plate to white (keepMap). Written as a lossless intermediate the grade
   then reads. */
async function composePortrait(src, out, { w, h, head = 0 }) {
  const { sw, sh, left, top, feather } = portraitPlacement(w, h)
  const frames = decodeAll(src, sw, sh, head)
  const rows = Math.round(sh * 0.04), plate = new Float32Array(sw * 3)
  for (let x = 0; x < sw; x++) for (let c = 0; c < 3; c++) {
    let acc = 0, n = 0
    for (let dx = -60; dx <= 60; dx++) { const xx = Math.min(sw - 1, Math.max(0, x + dx)); for (let y = 0; y < rows; y++) { acc += frames[0][(y * sw + xx) * 3 + c]; n++ } }
    plate[x * 3 + c] = acc / n
  }
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', out])
  for (const frame of frames) {
    const o = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++) {
      const ly = y - top, a = ly < 0 ? 0 : ly < feather ? (ly / feather) ** 1.5 : 1
      for (let x = 0; x < w; x++) {
        const sx = x - left, d = (y * w + x) * 3, s = (ly * sw + sx) * 3
        for (let c = 0; c < 3; c++) o[d + c] = Math.round(plate[sx * 3 + c] * (1 - a) + (a ? frame[s + c] * a : 0))
      }
    }
    await enc.write(o)
  }
  await enc.close()
  return out
}

/** A card clip's slab in output pixels (its corner radius measured at 28 source pixels). */
function slabOut({ w, h, card: { slab, crop } }) {
  const sx = w / crop.w, sy = h / crop.h
  return { x0: (slab.x0 - crop.x) * sx, y0: (slab.y0 - crop.y) * sy, x1: (slab.x1 - crop.x) * sx, y1: (slab.y1 - crop.y) * sy, r: 28 * sx }
}

/** The grader for one clip: frame index (after its head) → graded RGB. */
function grader(clip, src) {
  const { w, h } = clip
  if (clip.card) {
    // The plate is built from every frame, the head included: that is where the slab is dry.
    const all = decodeAll(src, w, h, 0, clip.card.crop), head = clip.head ?? 0
    const { plate, exposure } = cardPlate(all, w, h, slabOut(clip))
    return { count: all.length - head, graded: i => gradeCard(all[head + i], w, h, plate, exposure[head + i]) }
  }
  // A composed source is already trimmed (composePortrait drops the head).
  const lw = Math.round(w / 4), lh = Math.round(h / 4), head = clip.compose ? 0 : clip.head ?? 0
  const { field: low, exposure } = voidField(decodeAll(src, lw, lh, head), lw, lh)
  const gain = low.map(ch => { const up = upsample(ch, lw, lh, w, h); for (let i = 0; i < up.length; i++) up[i] = 255 / Math.max(120, up[i]); return up })
  const frames = decodeAll(src, w, h, head), keep = keepMap(clip)
  return { count: frames.length, graded: i => gradeFrame(frames[i], w, h, gain, exposure[Math.min(i, exposure.length - 1)], keep) }
}

async function buildClip(clip, src) {
  if (clip.pool) return buildPool(clip, src)
  const { w, h } = clip
  const { count: N, graded } = grader(clip, src)
  const L = LOOP_FADE

  // Lossless intermediate, then the two web encodes from it.
  const mid = join(CACHE, `${clip.name}.graded.mkv`)
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', mid])
  let first = null
  if (clip.once) {
    // The transition plays once, start to end.
    for (let i = 0; i < N; i++) await enc.write(graded(i))
  } else {
    // Order: L … N−L−1, then the cross-fade of the last second into the first.
    // That plays …, N−L−1, blend(N−L, 0) … blend(N−1, L−1), and wraps to L.
    for (let i = L; i < N - L; i++) {
      const g = graded(i); if (!first) first = g
      await enc.write(g)
    }
    for (let j = 0; j < L; j++) {
      const a = graded(N - L + j), b = graded(j), t = (j + 0.5) / L, mix = Buffer.alloc(a.length)
      for (let k = 0; k < a.length; k++) mix[k] = Math.round(a[k] * (1 - t) + b[k] * t)
      await enc.write(mix)
    }
  }
  await enc.close()

  const crf = { av1: 40, h264: 27, ...clip.crf }
  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libsvtav1', '-crf', String(crf.av1), '-preset', '5', '-g', String(FPS * 5), '-pix_fmt', 'yuv420p', ...color, join(OUT, `${clip.name}.webm`)])
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libx264', '-crf', String(crf.h264), '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', `keyint=${FPS * 5}:open-gop=0`, '-movflags', '+faststart', ...color, join(OUT, `${clip.name}.mp4`)])
  // A hero loop's poster is the first frame it plays. The transition has none:
  // it only ever plays over the BEFORE clip; nor do the card clips, which only
  // ever play over the finished card.
  if (!clip.once && !clip.card) await sharp(first, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toFile(join(OUT, `${clip.name}.jpg`))
  rmSync(mid)
  return { frames: N }
}

/* ── the footer's pool: two renditions, poster and clip ────────────────────
   The graded frames (floating point) go to a 16-bit lossless intermediate,
   RGB, so nothing is rounded before the encode. From it, two renditions:
   the full band (1920 wide), and `narrow`, its centre at the same scale,
   for phones (the footer's CSS and motion/pool.js pick it under 720px).
   Each is encoded as AV1 in 10 bits (the smooth water keeps its gradient
   with no 8-bit steps, and its blocks stay under one 8-bit level from the
   graded frames at CRF 16) and as 8-bit H.264 for the rest, with x264's
   adaptive quantiser biased to the flat areas (aq-mode 3) and a lighter
   deblock, so its gradients keep their bits. (A dither in the H.264's
   8-bit input does not survive its quantiser: tried, it only adds blocky
   texture.) The YUV conversion is BT.709, as the streams are tagged. The
   poster is the first frame, dithered to 8 bits, as AVIF (4:4:4) and
   WebP: it is a CSS background on every page, written ready to serve, not
   as a JPEG for Astro. */
const POOL_ENCODE = {
  color: ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'],
  yuv: (fmt, crop) => `${crop}scale=out_color_matrix=bt709:out_range=tv,format=${fmt}`,
}

/** An AV1 WebM's codec string (av01.profile.level+tier.depth), read from the file. */
function av1Codec(file) {
  const s = Object.fromEntries(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=level,pix_fmt', '-of', 'default=nw=1', file]).trim().split('\n').map(l => l.split('=')))
  return `av01.0.${s.level.padStart(2, '0')}M.${s.pix_fmt.includes('10') ? 10 : '08'}`
}

/** The pool's renditions: output name suffix and the crop of the band. */
function poolRenditions({ w, h, pool: { narrow } }) {
  return [{ suffix: '', w, h, x: 0 }, { suffix: '-narrow', w: narrow, h, x: (w - narrow) / 2 }]
}

/** A floating-point RGB frame (0–255) to 8 bits, with a fixed triangular
    dither (two hashes of the pixel's position), so a smooth gradient has
    no steps and the pattern does not crawl from frame to frame. */
function dither8(frame) {
  const out = Buffer.alloc(frame.length)
  const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296 }
  for (let i = 0; i < frame.length; i++) out[i] = Math.min(255, Math.max(0, Math.round(frame[i] + hash(i) - hash(i + frame.length))))
  return out
}

async function buildPool(clip, src) {
  const { w, h, name } = clip
  const { count: N, graded } = poolGrader(clip, src)
  const mid = join(CACHE, `${name}.graded.mkv`)
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb48le', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-', '-c:v', 'ffv1', '-pix_fmt', 'gbrp16le', mid])
  // The source already ends on its first frame: play 0 … N−2 and wrap to 0.
  // A cross-fade would blend two sets of ripples into one ghosted frame.
  let first = null
  for (let i = 0; i < N - 1; i++) {
    const g = graded(i), px = new Uint16Array(g.length)
    for (let k = 0; k < g.length; k++) px[k] = Math.round(g[k] * 257)
    if (!first) first = dither8(g)
    await enc.write(Buffer.from(px.buffer))
  }
  await enc.close()

  const { color, yuv } = POOL_ENCODE
  for (const r of poolRenditions(clip)) {
    const crop = r.x ? `crop=${r.w}:${r.h}:${r.x}:0,` : '', out = join(OUT, `${name}${r.suffix}`)
    run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-vf', yuv('yuv420p10le', crop), '-c:v', 'libsvtav1', '-crf', String(clip.crf.av1), '-preset', '4', '-g', String(FPS * 5),
      '-svtav1-params', 'tune=0', ...color, `${out}.webm`])
    run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-vf', yuv('yuv420p', crop), '-c:v', 'libx264', '-crf', String(clip.crf.h264), '-preset', 'slower', '-profile:v', 'high',
      '-x264-params', `keyint=${FPS * 5}:open-gop=0:aq-mode=3:deblock=-1,-1`, '-movflags', '+faststart', ...color, `${out}.mp4`])
    const still = sharp(first, { raw: { width: w, height: h, channels: 3 } }).extract({ left: r.x, top: 0, width: r.w, height: r.h })
    await still.clone().avif({ quality: 85, effort: 9, chromaSubsampling: '4:4:4' }).toFile(`${out}.avif`)
    await still.clone().webp({ quality: 92, effort: 6, smartSubsample: true }).toFile(`${out}.webp`)
  }
  rmSync(mid)
  return { frames: N }
}

/* ── stones ─────────────────────────────────────────────────────────────── */

async function stones(sheet, prefix, keep) {
  // Split a cutout sheet into one image per connected alpha blob, left to right.
  const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, lab = new Int32Array(W * H), boxes = []
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] <= 24 || lab[i]) continue
    const n = boxes.length + 1, st = [i], b = { x0: W, y0: H, x1: 0, y1: 0, a: 0 }; lab[i] = n
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0; b.a++
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y)
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (q >= 0 && q < W * H && !lab[q] && data[q * 4 + 3] > 24) { lab[q] = n; st.push(q) }
    }
    boxes.push(b)
  }
  const kept = boxes.filter(b => b.a > 4000).sort((a, b) => a.x0 - b.x0).slice(0, keep)
  for (const [i, b] of kept.entries()) {
    const pad = 12, left = Math.max(0, b.x0 - pad), top = Math.max(0, b.y0 - pad)
    await sharp(sheet).extract({ left, top, width: Math.min(W, b.x1 + pad) - left, height: Math.min(H, b.y1 + pad) - top })
      .resize(320, 320, { fit: 'inside' }).webp({ quality: 80, alphaQuality: 90 }).toFile(join(OUT, 'stones', `${prefix}-${i + 1}.webp`))
  }
  return kept.length
}

/* ── checks ─────────────────────────────────────────────────────────────── */

/** PSNR between frame `a` of one clip and frame `b` of another (-1: the last). */
function framePSNR(fileA, a, fileB, b) {
  const pick = (f, i) => i < 0 ? ['-sseof', '-0.05', '-i', f] : ['-i', f]
  const sel = (i, label) => i < 0 ? `trim=end_frame=1[${label}]` : `select=eq(n\\,${i}),setpts=PTS-STARTPTS[${label}]`
  const out = run('ffmpeg', ['-v', 'info', ...pick(fileA, a), ...pick(fileB, b), '-filter_complex', `[0:v]${sel(a, 'a')};[1:v]${sel(b, 'b')};[a][b]psnr`, '-frames:v', '1', '-f', 'null', '-'])
  return Number((out.match(/average:([\d.]+|inf)/) || [])[1])
}

/** PSNR between the last two frames of a clip. */
function lastStep(file) {
  const n = Number(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).trim())
  return framePSNR(file, n - 2, file, n - 1)
}

function checks() {
  const report = []
  for (const clip of CLIPS.filter(c => !ONLY || ONLY.has(c.name))) {
    const webm = join(OUT, `${clip.name}.webm`), mp4 = join(OUT, `${clip.name}.mp4`)
    // The crash's two cuts: BEFORE poster (the loop's first frame) → the
    // transition's first frame, and its last frame → the AFTER loop's first.
    let cutIn = null, cutOut = null
    if (clip.once) {
      const r = clip.name.slice(-4)
      cutIn = +framePSNR(join(OUT, `hero-before-${r}.mp4`), 0, mp4, 0).toFixed(1)
      cutOut = +framePSNR(mp4, -1, join(OUT, `hero-after-${r}.mp4`), 0).toFixed(1)
    }
    // Decoded void luma: signalstats' YHIGH (90th-percentile luma) of the first
    // frame, which is mostly void. Limited range, so 235 is white; ≥ 234 passes.
    // The pool's frame is water from its top: its void is the white rows
    // above the waterline, less the one the line eases in on.
    const wall = clip.pool ? `crop=iw:${Math.max(2, Math.floor(poolRows(clip).line) - 1)}:0:0,` : ''
    const stats = run('ffmpeg', ['-v', 'info', '-i', mp4, '-vf', `${wall}signalstats,metadata=print:key=lavfi.signalstats.YHIGH`, '-frames:v', '1', '-f', 'null', '-'])
    const yhigh = Number((stats.match(/YHIGH=(\d+)/) || [])[1])
    // Loop seam: PSNR between the last and first frames (loops only). It
    // passes at 30 dB, or, for water busy enough that one ordinary frame step
    // is below that (the BEFORE card's splashes), when the seam is no worse
    // than its median frame step less 1 dB: then it is just another frame.
    // A seamless loop (the pool) is held to the frame steps either side of
    // its seam instead.
    let psnr = null, step = null
    if (!clip.once) {
      const seam = run('ffmpeg', ['-v', 'info', '-sseof', '-0.05', '-i', mp4, '-i', mp4, '-filter_complex', '[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1[b];[a][b]psnr', '-f', 'null', '-'])
      psnr = +Number((seam.match(/average:([\d.]+|inf)/) || [])[1]).toFixed(1)
      // A seamless loop's seam is one of its own frame steps: it is held to
      // the steps either side of it (the last two frames, the first two).
      const at = clip.seamless ? [-2, 0] : [10, 30, 50]
      const steps = at.map(k => k < 0 ? lastStep(mp4) : framePSNR(mp4, k, mp4, k + 1)).sort((a, b) => a - b)
      step = +(clip.seamless ? steps[0] : steps[1]).toFixed(1)
    }
    report.push({ clip: clip.name, webmKB: Math.round(statSync(webm).size / 1024), mp4KB: Math.round(statSync(mp4).size / 1024), voidLuma: yhigh, seamPSNR: psnr, stepPSNR: step, cutIn, cutOut, ok: yhigh >= 234 && (clip.once || psnr >= Math.min(30, step - 1)) })
    // The pool's renditions and posters: their sizes (the frames are the same).
    if (clip.pool) for (const r of poolRenditions(clip)) {
      const kb = ext => Math.round(statSync(join(OUT, `${clip.name}${r.suffix}.${ext}`)).size / 1024)
      report.push({ clip: `${clip.name}${r.suffix} ${r.w}×${r.h}`, webmKB: kb('webm'), mp4KB: kb('mp4'), avifKB: kb('avif'), webpKB: kb('webp') })
    }
  }
  console.table(report)
  return report
}

/* ── main ───────────────────────────────────────────────────────────────── */

async function main() {
  mkdirSync(CACHE, { recursive: true }); mkdirSync(join(OUT, 'stones'), { recursive: true })
  if (CHECK_ONLY) { checks(); return }

  const src = async (kind, key) => fetchTo(SOURCES.base + SOURCES[kind][key], join(CACHE, SOURCES[kind][key]))
  const built = {}
  for (const clip of CLIPS) {
    if (ONLY && !ONLY.has(clip.name)) continue
    console.log('·', clip.name)
    const source = clip.compose
      ? await composePortrait(await src('clips', clip.compose), join(CACHE, `${clip.name}.composed.mkv`), clip)
      : await src('clips', clip.name)
    built[clip.name] = await buildClip(clip, source)
  }
  // The box in each card clip that the page fits to its card, as fractions
  // of the clip's frame (motion/water.js, marketing.css).
  const f = v => +v.toFixed(4)
  const card = (name) => {
    const { w, h, card: { fit, crop } } = CLIPS.find(c => c.name === name)
    return { aspect: f(w / h), fit: { left: f((fit.x0 - crop.x) / crop.w), top: f((fit.y0 - crop.y) / crop.h), right: f((fit.x1 - crop.x) / crop.w), bottom: f((fit.y1 - crop.y) / crop.h) } }
  }
  // The pool's band: its aspect and its waterline as a fraction of its height
  // from the top (the footer's layout, e2e/pool.spec.js), and each
  // rendition's AV1 codec string (10-bit, so the page's <source> says so).
  const pool = () => {
    const clip = CLIPS.find(c => c.name === 'footer-pool')
    const [wide, narrow] = poolRenditions(clip).map(r => ({ aspect: f(r.w / r.h), av1: av1Codec(join(OUT, `${clip.name}${r.suffix}.webm`)) }))
    return { ...wide, waterline: f(poolRows(clip).line / clip.h), narrow }
  }
  const transition = r => +(built[`hero-transition-${r}`].frames / FPS).toFixed(2)
  const order = d => ({ $comment: 'Written by scripts/media/build-media.mjs. Do not edit by hand.', hero: d.hero, cards: d.cards, footer: d.footer, stones: d.stones })

  let doc
  if (ONLY) {
    // Patch what was rebuilt into the existing media.json.
    doc = JSON.parse(readFileSync(join(OUT, 'media.json'), 'utf8'))
    for (const name of Object.keys(built)) {
      if (name.startsWith('hero-transition-')) doc.hero[name.slice(-4)] = { transition: transition(name.slice(-4)) }
      if (name.startsWith('card-')) doc.cards[name.slice(5)] = card(name)
      if (name === 'footer-pool') doc.footer = { pool: pool() }
    }
    doc = order(doc)
  } else {
    const raw = await stones(await src('stills', 'fragments-cutout'), 'raw', 7)
    const pebbles = await stones(await src('stills', 'pebbles-cutout'), 'pebble', 4)
    doc = order({
      hero: { '16x9': { transition: transition('16x9') }, '9x16': { transition: transition('9x16') } },
      cards: { before: card('card-before'), after: card('card-after') },
      footer: { pool: pool() },
      stones: { raw, pebble: pebbles },
    })
  }
  writeFileSync(join(OUT, 'media.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(JSON.stringify(doc, null, 2))
  checks()
}

main().catch(err => { console.error(err); process.exit(1) })
