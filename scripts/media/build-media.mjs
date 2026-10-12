#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   build-media — turns the generated clips and stills into the landing page's
   web media. Offline and deliberate: it is NOT part of `npm run build`, and its
   outputs are committed under apps/site/src/media/, so a deploy never depends
   on a generation service or on ffmpeg.

       node scripts/media/build-media.mjs            # everything
       node scripts/media/build-media.mjs --check    # only the checks

   Needs ffmpeg (libsvtav1, libx264) on PATH; sharp comes from the workspace.
   Sources are listed in sources.json by permanent URL and cached in .cache/.
   Generating NEW sources costs Higgsfield credits: the owner approves the
   total first (see docs/LANDING-DESIGN.md).

   What it does, per clip:
     1. Grade to white. The void estimate is the per-pixel 90th percentile over
        all frames (frame 0 would bake the rain in), low-passed and iterated
        so objects drop out of it. Gain = 255 / field, applied only to the void
        (object weight = smoothstep(|frame − field|, 8, 56), blurred), so the
        crystal and the water keep their tones. Near-white is soft-snapped to
        pure white; exposure is normalised per frame (generated video flickers).
        Every clip keeps half of the soft overhead light in the top of the frame.
     2. Loop. The last second is cross-faded into the first, then cut.
     3. Encode AV1 WebM + H.264 MP4 (+faststart, BT.709, closed GOP, no audio),
        and write the first frame as the poster source.
   The hero transition (the crash) is graded and encoded the same way but not
   looped: it plays once. Portrait hero clips are composed here from the
   landscape sources (composePortrait), so the crystal and its crash match.
   Then: the stones, and media.json (the crash's duration, the stone counts).
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
const CHECK_ONLY = process.argv.includes('--check')

/* The clips: output name (also the source key) and output size. Landscape is
   encoded at 1600 wide: the media box is max(100vw, 177.78svh), 1600 on a 1440×900 screen. */
const CLIPS = [
  { name: 'hero-before-16x9', w: 1600, h: 900 },
  { name: 'hero-transition-16x9', w: 1600, h: 900, once: true },
  { name: 'hero-after-16x9', w: 1600, h: 900 },
  { name: 'hero-before-9x16', w: 720, h: 1280 },
  // Composed from the landscape sources; the transition keeps a still rain
  // band above it, so its flying fragments are never stretched.
  { name: 'hero-transition-9x16', w: 720, h: 1280, once: true, compose: 'hero-transition-16x9', staticBand: true },
  { name: 'hero-after-9x16', w: 720, h: 1280, compose: 'hero-after-16x9' },
]

/* ── Portrait composition ────────────────────────────────────────────────────
   The 9:16 hero frames were composed from the 16:9 stills, not outpainted: the
   stream leaves at RX of the width, with the crystal about 44% of the width. The portrait BEFORE clip was generated from a frame
   composed this way; the portrait transition and AFTER are composed here,
   frame by frame, from the landscape clips (composePortrait). */
export const PORTRAIT = { W: 1080, H: 1920, RX: 0.76, EXIT: 0.6716, CRYSTAL: 0.39, CW: 0.44, CY: 0.62 }

function portraitPlacement() {
  const { W, H, RX, EXIT, CRYSTAL, CW, CY } = PORTRAIT
  const sw = Math.round(CW * W / CRYSTAL)
  const sh = Math.round(sw * 9 / 16)
  return { sw, sh, left: Math.round(RX * W - EXIT * sw), top: Math.round(CY * H - 0.47 * sh) }
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

/** Every frame of a clip as raw RGB at (w, h). */
function decodeAll(path, w, h) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', `scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 2 ** 31 })
  if (raw.status !== 0) throw new Error(raw.stderr.toString())
  const size = w * h * 3, frames = []
  for (let i = 0; i + size <= raw.stdout.length; i += size) frames.push(raw.stdout.subarray(i, i + size))
  return frames
}

/* ── 1. the void field ──────────────────────────────────────────────────── */

function voidField(frames, w, h) {
  // Per-frame exposure: the median luma, normalised to the clip's median.
  const luma = f => { const s = []; for (let i = 0; i < f.length; i += 3 * 17) s.push(0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2]); s.sort((a, b) => a - b); return s[s.length >> 1] }
  const med = frames.map(luma)
  const clipMed = [...med].sort((a, b) => a - b)[med.length >> 1]
  const exposure = med.map(m => Math.min(1.06, Math.max(0.94, clipMed / m)))

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

function gradeFrame(frame, w, h, gain, exposure) {
  const n = w * h, weight = new Float32Array(n)
  for (let p = 0; p < n; p++) {
    let dev = 0
    for (let c = 0; c < 3; c++) dev = Math.max(dev, Math.abs(frame[p * 3 + c] * exposure - 255 / gain[c][p]))
    weight[p] = smoothstep(8, 56, dev)
  }
  const wb = blur(weight, w, h, Math.max(1, Math.round(5 * w / 1920)))
  const out = Buffer.alloc(n * 3)
  for (let y = 0; y < h; y++) {
    // Keep half of the overhead light in the top 65% of the frame.
    const keep = 0.5 * (1 - smoothstep(0.45, 0.65, y / h))
    for (let x = 0; x < w; x++) {
      const p = y * w + x, voidness = (1 - wb[p]) * (1 - keep)
      let lo = 255
      for (let c = 0; c < 3; c++) {
        const v = frame[p * 3 + c] * exposure * (1 + (gain[c][p] - 1) * voidness)
        out[p * 3 + c] = Math.min(255, Math.max(0, Math.round(v)))
        lo = Math.min(lo, out[p * 3 + c])
      }
      // Soft-snap near-white to pure white (deviation 7–20 ramps).
      const d = 255 - lo
      if (d < 20) {
        const t = d <= 7 ? 1 : 1 - (d - 7) / 13
        for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.round(out[p * 3 + c] + (255 - out[p * 3 + c]) * t)
      }
    }
  }
  return out
}

/* ── 3. grade + loop + encode a clip ────────────────────────────────────── */

function encoder(args) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] })
  return { write: buf => new Promise(res => p.stdin.write(buf) ? res() : p.stdin.once('drain', res)), close: () => new Promise((res, rej) => { p.on('close', code => code ? rej(new Error(`ffmpeg ${code}`)) : res()); p.stdin.end() }) }
}

/* ── portrait composition ───────────────────────────────────────────────────
   A 16:9 hero clip placed in a 9:16 frame: the frame scaled so its stream
   leaves at PORTRAIT.RX, the rain band above stretched from its top rows
   (feathered into the frame), and below it the stream column repeated down a
   plain ground. Written as a lossless intermediate the grade then reads. */
async function composePortrait(src, out, { w, h, staticBand = false }) {
  const k = w / PORTRAIT.W, pl = portraitPlacement()
  const sw = Math.round(pl.sw * k), sh = Math.round(pl.sh * k), left = Math.round(pl.left * k), top = Math.round(pl.top * k)
  const frames = decodeAll(src, sw, sh)
  const x0 = Math.max(0, left), sx0 = Math.max(0, -left), vw = Math.min(sw - sx0, w - x0)
  const F = Math.round(sh * 0.3), bandH = Math.round(sh * 0.22), rows = Math.round(sh * 0.12)
  const cx = Math.round(PORTRAIT.EXIT * sw), half = Math.round(sw * 0.02)
  // The ground under the stream: the first frame's bottom rows, blurred wide.
  const ground = new Float32Array(sw * 3)
  for (let x = 0; x < sw; x++) for (let c = 0; c < 3; c++) {
    let acc = 0, n = 0
    for (let dx = -60; dx <= 60; dx++) { const xx = Math.min(sw - 1, Math.max(0, x + dx)); for (let y = sh - 4; y < sh; y++) { acc += frames[0][(y * sw + xx) * 3 + c]; n++ } }
    ground[x * 3 + c] = acc / n
  }
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', out])
  for (const frame of frames) {
    const band = staticBand ? frames[0] : frame, o = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = sx0 + (x - x0), d = (y * w + x) * 3
      if (sx < 0 || sx >= sx0 + vw) { for (let c = 0; c < 3; c++) o[d + c] = ground[Math.min(sw - 1, Math.max(0, sx)) * 3 + c]; continue }
      let rgb = [0, 0, 0]
      if (y < top + F) { const by = Math.min(bandH - 1, Math.floor(y / (top + F) * bandH)); for (let c = 0; c < 3; c++) rgb[c] = band[(by * sw + sx) * 3 + c] }
      if (y >= top && y < top + sh) {
        const a = y - top < F ? ((y - top) / F) ** 1.5 : 1
        for (let c = 0; c < 3; c++) rgb[c] = rgb[c] * (1 - a) + frame[((y - top) * sw + sx) * 3 + c] * a
      } else if (y >= top + sh) {
        const inStream = sx >= cx - half && sx < cx + half
        const ry = sh - rows + ((y - top - sh) % rows)
        for (let c = 0; c < 3; c++) rgb[c] = inStream ? frame[(ry * sw + sx) * 3 + c] : ground[sx * 3 + c]
      }
      for (let c = 0; c < 3; c++) o[d + c] = Math.round(rgb[c])
    }
    await enc.write(o)
  }
  await enc.close()
  return out
}

async function buildClip(clip, src) {
  const { w, h } = clip
  const lw = Math.round(w / 4), lh = Math.round(h / 4)
  const { field: low, exposure } = voidField(decodeAll(src, lw, lh), lw, lh)
  const gain = low.map(ch => { const up = upsample(ch, lw, lh, w, h); for (let i = 0; i < up.length; i++) up[i] = 255 / Math.max(120, up[i]); return up })

  const frames = decodeAll(src, w, h)
  const N = frames.length, L = LOOP_FADE
  const graded = i => gradeFrame(frames[i], w, h, gain, exposure[Math.min(i, exposure.length - 1)])

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

  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libsvtav1', '-crf', '40', '-preset', '5', '-g', String(FPS * 5), '-pix_fmt', 'yuv420p', ...color, join(OUT, `${clip.name}.webm`)])
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', `keyint=${FPS * 5}:open-gop=0`, '-movflags', '+faststart', ...color, join(OUT, `${clip.name}.mp4`)])
  // A loop's poster is the first frame it plays. The transition has none: it
  // only ever plays over the BEFORE clip.
  if (!clip.once) await sharp(first, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toFile(join(OUT, `${clip.name}.jpg`))
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

function checks() {
  const report = []
  for (const clip of CLIPS) {
    const webm = join(OUT, `${clip.name}.webm`), mp4 = join(OUT, `${clip.name}.mp4`)
    // Decoded void luma: signalstats' YHIGH (90th-percentile luma) of the first
    // frame, which is mostly void. Limited range, so 235 is white; ≥ 234 passes.
    const stats = run('ffmpeg', ['-v', 'info', '-i', mp4, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YHIGH', '-frames:v', '1', '-f', 'null', '-'])
    const yhigh = Number((stats.match(/YHIGH=(\d+)/) || [])[1])
    // Loop seam: PSNR between the last and first frames (loops only).
    let psnr = null
    if (!clip.once) {
      const seam = run('ffmpeg', ['-v', 'info', '-sseof', '-0.05', '-i', mp4, '-i', mp4, '-filter_complex', '[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1[b];[a][b]psnr', '-f', 'null', '-'])
      psnr = Number((seam.match(/average:([\d.]+|inf)/) || [])[1])
    }
    report.push({ clip: clip.name, webmKB: Math.round(statSync(webm).size / 1024), mp4KB: Math.round(statSync(mp4).size / 1024), voidLuma: yhigh, seamPSNR: psnr, ok: yhigh >= 234 && (clip.once || psnr >= 30) })
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
    console.log('·', clip.name)
    const source = clip.compose
      ? await composePortrait(await src('clips', clip.compose), join(CACHE, `${clip.name}.composed.mkv`), clip)
      : await src('clips', clip.name)
    built[clip.name] = await buildClip(clip, source)
  }

  const raw = await stones(await src('stills', 'fragments-cutout'), 'raw', 7)
  const pebbles = await stones(await src('stills', 'pebbles-cutout'), 'pebble', 4)

  const doc = {
    $comment: 'Written by scripts/media/build-media.mjs. Do not edit by hand.',
    hero: {
      '16x9': { transition: +(built['hero-transition-16x9'].frames / FPS).toFixed(2) },
      '9x16': { transition: +(built['hero-transition-9x16'].frames / FPS).toFixed(2) },
    },
    stones: { raw, pebble: pebbles },
  }
  writeFileSync(join(OUT, 'media.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(JSON.stringify(doc, null, 2))
  checks()
}

main().catch(err => { console.error(err); process.exit(1) })
