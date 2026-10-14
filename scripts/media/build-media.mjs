#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   build-media — turns the generated clips and stills into the landing page's
   web media. Offline and deliberate: it is NOT part of `npm run build`, and its
   outputs are committed under apps/site/src/media/, so a deploy never depends
   on a generation service or on ffmpeg.

       node scripts/media/build-media.mjs            # everything
       node scripts/media/build-media.mjs --check    # only the checks
       node scripts/media/build-media.mjs --only day-stream,card-rim
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
   the pebble sits in the same place in each and the cuts stay invisible,
   and run on below their 9:16 frame (EXTEND), so the stream reaches the
   bottom of a phone screen taller than its small viewport. Where the AFTER
   loops' stream leaves the frame (its x and width at the bottom edge) is
   measured, so the page can carry it on down to the calendar's AFTER card.
   That stream below the hero is its own clip (buildDayStream): a narrow
   column cut round one falling stream, graded to white, run on below its
   frame by advection, in two renditions with their posters.
   The BEFORE card's splashes are a thin strip along a slab's top edge,
   graded against a clean plate of it (cardPlate): the slab goes to white
   and only the water is left, and only where the page shows it (cardKeep).
   The AFTER card's rim (buildRim) is cut from a plate whose rim carries a
   line of water into pieces, packed in one small atlas: its four corners
   (redrawn to the card's radius), a strip of each straight edge, and the
   stream landing on its top and leaving its bottom. The page lays them
   round the card like a 9-slice. No posters: the card clips only ever play
   over the finished card.
   The footer's pool (water seen from the side) is cropped to a wide band
   from its waterline down and graded against its own median frame
   (poolGrader): the white above the line goes to pure white, and every
   column takes the same row profile, so the waterline is one flat line and
   only the moving water is kept, made clear and neutral. It is encoded in
   two renditions, the full band and its centre for phones (buildPool), each
   as 10-bit AV1, H.264, and a poster as AVIF and WebP for the footer's CSS
   background.
   Then: the stones, and media.json (the crash's duration, the splash
   strip's scale and edge, the rim atlas's pieces, the stream clip's x and
   width, the pool's aspect and waterline, the stone counts). The checks also measure the crash's
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
/* The AFTER loop's source spends its first 2.5 s building the flow (the
   streams start, break and settle); from frame 60 both streams run steadily
   and keep moving, so the loop is cut from there. It then plays on to the
   source's last frame (its still), and AFTER_BRIDGE motion-interpolated
   frames carry the water from that frame back to frame 60. A cross-fade there
   blended two streams in different places into one doubled, ghosted stream
   for a whole second; the bridge moves the one stream instead. */
const AFTER_HEAD = 60
const AFTER_BRIDGE = 12
const CHECK_ONLY = process.argv.includes('--check')
const ONLY_AT = process.argv.indexOf('--only')
const ONLY = ONLY_AT > 0 ? new Set(process.argv[ONLY_AT + 1].split(',')) : null

/* The BEFORE card's splash strip, in its 1280×720 source (pixels): `slab` is
   the pale slab's box, measured on the per-pixel median frame (the plate is
   built around it), and `crop` what is kept of the frame.
   SPLASH (the BEFORE card's top border, from the `card-before` source): a
   thin strip along the slab's top edge only, over its full width. The
   slab's silhouette starts on row `edge` (285; the rows under it, to 293,
   are its wet top face seen from just above, then its front face). Six
   streams fall onto that edge and burst in crowns on it, up to about 50
   rows above it. The strip keeps `above` rows over the edge (the crowns
   whole, rims included, and the last of each stream) and `below` under it
   (the top face and where the drips start), and grades everything else to
   white: the streams fade in from `above` to `solid` rows over the edge (so
   only their last few rows show, where they hit) and the face fades out
   over the last 4 of `below`. The crop is 68 rows (AV1's least height is
   64), so its top rows are white. The page draws it small (0.3 CSS px per
   source px) and repeats it along the border, its `edge` row on the card's
   top border (media.json `edge`, `width` → marketing.css, motion/water.js). */
const SPLASH = {
  slab: { x0: 131, y0: 285, x1: 1157, y1: 720 }, crop: { x: 131, y: 229, w: 1026, h: 68 },
  edge: 285, keep: { above: 52, solid: 26, below: 10 },
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
  { name: 'hero-after-16x9', w: 1600, h: 900, head: AFTER_HEAD, bridge: AFTER_BRIDGE },
  // Portrait: all three composed from the landscape clips, so the pebble has
  // exactly the same place and size in each and every cut stays invisible.
  // Each is extended below its 9:16 frame (EXTEND), so the stream runs on to
  // the bottom of the tallest viewport; the crash's extension starts from
  // the BEFORE loop's (`history`), so it is built after it.
  { name: 'hero-before-9x16', w: 720, h: 1280, compose: 'hero-before-16x9', extend: true },
  { name: 'hero-transition-9x16', w: 720, h: 1280, once: true, compose: 'hero-transition-16x9', head: CRASH_HEAD, extend: true, history: 'hero-before-9x16' },
  { name: 'hero-after-9x16', w: 720, h: 1280, compose: 'hero-after-16x9', head: AFTER_HEAD, bridge: AFTER_BRIDGE, extend: true },
  // The calendar's water. The BEFORE card's splash strip is cut from the
  // card-before source (its own output name: `source`), and shows at about
  // 300 CSS px (2–4 copies along the border). The AFTER card's rim is an
  // atlas of pieces (RIM, buildRim), sized by its pieces.
  { name: 'card-splash', source: 'card-before', w: 960, h: 64, card: SPLASH },
  { name: 'card-rim', rim: true },
  // The stream from the hero down to the AFTER card: a column round one
  // falling stream, run on below its frame (DAY_STREAM, buildDayStream), in
  // a landscape and a portrait rendition like the hero's.
  { name: 'day-stream', dayStream: true },
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

/* ── The portrait stream, extended ─────────────────────────────────────────
   On a phone the visible screen can be taller than the small viewport the
   pebble is placed in (100svh: the browser's bars collapse as the page
   scrolls, and the hero's stage is 100lvh), so every portrait clip runs on
   EXTEND.rows below its 9:16 frame (0.4 of its height: 720×1792; Safari's
   bars take about a fifth of an iPhone's screen, so the large viewport is
   up to about 1.3 small ones, and 0.4 leaves room). The
   landscape source ends at the frame's bottom, so those rows are made, not
   cropped: by advection, the way falling water moves. Row r below the frame
   at frame t is the frame's own bottom row at frame t − d(r) (interpolated
   between frames), where d(r) is how long water takes to fall r + 1 px from
   the edge, leaving it at `speed` px a frame (the BEFORE loop's drops near
   the bottom, measured at 720 wide) and gaining `gravity` px a frame, every
   frame. So whatever crosses the bottom edge (the stream, a drop, a drip)
   keeps falling, faster; and the crash's new stream, which reaches the edge
   at about its frame 66 of 90, fills all the rows in 21 frames, before the
   cut to the AFTER loop. A loop takes its past from itself, wrapping, so its
   seam is untouched; the crash takes the past before its first frame from
   the BEFORE loop it cuts in from (the drips already falling keep falling).
   The burst's fragments are not water: in the crash's first `clean` frames
   (until the last fragment has crossed the edge) what crosses it fades to
   white within `fragments` rows, so a fragment is not drawn out into a
   streak. Nothing is tiled: every row is a different moment of the same
   edge. The last `fade` of the rows eases to white, so if a screen ever
   shows past them the stream fades rather than stops. */
const EXTEND = { rows: 512, speed: 9, gravity: 1.5, fade: 0.12, clean: 56, fragments: 48 }

/* The stream under the pebble, where it leaves the AFTER loop's frame: on
   the frame's bottom row, its two edges are the first and last columns
   darker than `water` (luma) within `reach` px of the row's darkest one
   (one of the stream's dark refractive edges; the rest of the row is
   white). The page carries the stream on below the hero from there (the
   day-stream clip, scaled so its stream has this width: marketing.css
   .mk-day-stream), so both edges matter, not just its darkest line. */
const STREAM = { reach: 24, water: 240 }

/* The stream from the hero down to the AFTER card (`day-stream`, a 1080×1920
   source: one thin stream falling straight down a white void, centred; it
   starts and ends on the same still, so it loops as it is, `seamless`).
   `crop` is a column round the stream at the source's scale: its top rows
   are left out (the stream is wider there, about 64 px at row 0 against 30
   from row 600 down, measured edge to edge), so the stream has one width
   from the clip's top, where it meets the hero's, down. The page scales the
   column so its stream is exactly the hero stream's width (media.json
   `stream`), which is 0.26–0.33 CSS px per source px on a phone and up to
   0.8 on a desktop, so the clip must run a long way: from the hero's
   bottom to the AFTER card is 630–1500 CSS px. The source's 1320 rows are
   run on below the frame by advection, as the portrait hero clips are
   (EXTEND): row r under the frame is its bottom row (r + 1) / `speed`
   frames earlier, interpolated between frames, wrapping round the loop, so
   the extension is as seamless as the loop and nothing is tiled. The
   stream's ripples move too fast to track from frame to frame (they shift
   80–160 px a frame), so `speed` (96 px a frame, 2300 px/s) is chosen to
   read as fast water. Two renditions, like the hero: `16x9` the first
   `rows` of the column at the source's scale, and `9x16` all of it at half
   scale (a phone draws it at 0.26–0.33 CSS px per source px, so half scale
   is still 0.8–1 device px per pixel at 3x, and its height stays under
   4096, the most a hardware decoder is sure to take). The source's stream
   is drawn harder than the hero's (its edge lines graded near-black, the
   hero's about luma 110 where its stream leaves the frame), so its
   distance from white is scaled by `clear` (0.62, measured on the page:
   the two streams' darkest line and their summed darkness across the
   join), and the two meet in the same tone. */
const DAY_STREAM = {
  crop: { x: 477, y: 600, w: 128, h: 1320 }, speed: 96, clear: 0.62,
  renditions: { '16x9': { rows: 3200, scale: 1 }, '9x16': { rows: 7200, scale: 0.5 } },
  join: 240,     // the rows at the clip's top where its stream width is measured (where it meets the hero's)
  crf: { av1: 34, h264: 24 },
}

/* The AFTER card's rim (`card-rim`, a 1920×1080 source: a pale plate seen
   face-on, about 2:1, with rounded corners; a thin stream lands on the
   middle of its top edge, a line of water runs round its contour, and one
   stream leaves the middle of its bottom edge). In its first 2.6 s the
   water also runs over the face and drips off the corners; from frame 90
   (`head`, 3.75 s) to the end it is calm, so only those 54 frames are
   used, looped with an 18-frame cross-fade (`fade`).
   The page lays the rim round the card's border at a fixed scale (0.4 CSS
   px per source px: marketing.css --rim-k), crisp at 2x (0.8 device px a
   pixel) and at 3x (1.2). The card's aspect changes with the layout and
   the plate's does not, so the rim is cut into pieces the page places like
   a 9-slice, all at that one scale: the four corners, one strip of each
   straight edge (stretched along its length only), and the stream coming
   in at the top and the one leaving the bottom, each in a piece of its
   own. Every piece is resampled so that the plate's outer contour (the
   centre of its dark outer line, measured on the median frame) is a
   straight line at a known offset in it: `out` px of the outside kept
   beyond it, `in` px of the inside (the line of water is the 26 px band
   from the outer line to an inner one; the face beyond it goes to white).
   The edges are fitted as lines (the plate is 5 px out of level across
   its width) and each corner as a circle tangent to its two edges (radius
   about 100 px, or 40 CSS px at the page's scale, where the card's corner
   is 16): each corner is redrawn to `radius` (40 px, so 16 CSS px) by
   moving every point of its band in along the radius by the same amount,
   so the band keeps its width and only the arc tightens. The stream pieces
   are centred on their stream (measured) and run `above` px over the top
   contour and `below` under the bottom one. The incoming stream widens as
   it meets the rim; its width on each row above the contour (`flare`) lets
   the page hand the stream over from its own at the row where the two are
   as wide. Pieces are packed into one atlas with `margin` px of their own
   content round them (so the codec's bleed never reaches a piece's edge)
   and `gutter` px of white between them. */
const RIM = {
  head: 90, fade: 18,
  out: 10, in: 32, radius: 40, corner: 64, strip: 32, margin: 2, gutter: 4,
  above: 120, below: 176, streamWidth: 160,
  guess: { top: 329, bottom: 898, left: 404, right: 1523, r: 100, inX: 965, outX: 961 },
  crf: { av1: 30, h264: 20 },
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
function decodeAll(path, w, h, head = 0, crop = null, bridge = 0) {
  const cut = crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : ''
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', `trim=start_frame=${head},setpts=PTS-STARTPTS,${cut}scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 2 ** 31 })
  if (raw.status !== 0) throw new Error(raw.stderr.toString())
  const frames = splitFrames(raw.stdout, w * h * 3)
  return bridge ? frames.concat(bridgeFrames(frames.at(-1), frames[0], w, h, bridge)) : frames
}

function splitFrames(buf, size) {
  const frames = []
  for (let i = 0; i + size <= buf.length; i += size) frames.push(buf.subarray(i, i + size))
  return frames
}

/** `n` motion-interpolated frames from frame `a` to frame `b` (both left
    out), so a loop that ends on `a` wraps to `b` with the water moved rather
    than cross-faded. minterpolate needs a frame after `b` to settle, so `b`
    goes in twice. */
function bridgeFrames(a, b, w, h, n) {
  const out = spawnSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', '1', '-i', '-',
    '-vf', `minterpolate=fps=${n + 1}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { input: Buffer.concat([a, b, b]), maxBuffer: 2 ** 31 })
  if (out.status !== 0) throw new Error(out.stderr.toString())
  return splitFrames(out.stdout, w * h * 3).slice(1, n + 1)
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

/** How much of the splash strip's water is kept on each output row (1 all,
    0 graded to white), in its source's pixels (SPLASH): the rows around the
    edge (`keep`). */
function cardKeep({ w, h, card: { crop, edge, keep } }) {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = crop.y + (y + 0.5) * crop.h / h
    out.fill(smoothstep(edge - keep.above, edge - keep.solid, sy) * (1 - smoothstep(edge + keep.below - 4, edge + keep.below, sy)), y * w, (y + 1) * w)
  }
  return out
}

function gradeCard(frame, w, h, plate, exposure, keep, crisp) {
  const n = w * h, out = Buffer.alloc(n * 3)
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.min(255, Math.max(0, Math.round(255 - (255 - frame[p * 3 + c] * exposure * 255 / Math.max(60, plate[c][p])) * keep[p])))
    if (!crisp) snapWhite(out, p)
  }
  return crisp ? crispen(out, w, h, crisp) : out
}

/* The splash strip is drawn at about 0.4 of its scale, where a crown's
   translucent sheet (the grey of the slab seen through it) reads as a flat
   grey patch. So its water is kept by its edges: each pixel's distance from
   white less `flat` of its neighbourhood's (a blur of radius `r`), times
   `gain`, so a drop's outline, a crown's rim and a stream stay crisp and
   their flat insides go pale. In luma, applied to every channel alike. */
function crispen(img, w, h, { r, flat, gain }) {
  const n = w * h, d = new Float32Array(n)
  for (let p = 0; p < n; p++) d[p] = 255 - (LUMA[0] * img[p * 3] + LUMA[1] * img[p * 3 + 1] + LUMA[2] * img[p * 3 + 2])
  const s = blur(d, w, h, r), out = Buffer.alloc(n * 3)
  for (let p = 0; p < n; p++) {
    const k = d[p] > 0.5 ? Math.max(0, Math.min(255, (d[p] - flat * s[p]) * gain)) / d[p] : 0
    for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.round(255 - (255 - img[p * 3 + c]) * k)
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
async function composePortrait(src, out, { w, h, head = 0, bridge = 0 }) {
  const { sw, sh, left, top, feather } = portraitPlacement(w, h)
  const frames = decodeAll(src, sw, sh, head, null, bridge)
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
    const { plate, exposure } = cardPlate(all, w, h, slabOut(clip)), keep = cardKeep(clip)
    return { count: all.length - head, graded: i => gradeCard(all[head + i], w, h, plate, exposure[head + i], keep, clip.card.crisp) }
  }
  // A composed source is already trimmed and bridged (composePortrait drops
  // the head and adds the bridge).
  const lw = Math.round(w / 4), lh = Math.round(h / 4), head = clip.compose ? 0 : clip.head ?? 0, bridge = clip.compose ? 0 : clip.bridge ?? 0
  const { field: low, exposure } = voidField(decodeAll(src, lw, lh, head, null, bridge), lw, lh)
  const gain = low.map(ch => { const up = upsample(ch, lw, lh, w, h); for (let i = 0; i < up.length; i++) up[i] = 255 / Math.max(120, up[i]); return up })
  const frames = decodeAll(src, w, h, head, null, bridge), keep = keepMap(clip)
  return { count: frames.length, graded: i => gradeFrame(frames[i], w, h, gain, exposure[Math.min(i, exposure.length - 1)], keep) }
}

/** The stream's two edges on row `y` of a frame, in px from the frame's
    left edge, sub-pixel: where the luma crosses STREAM.water between the
    pixel centres either side of each edge, within `reach` px of the row's
    darkest pixel. */
function streamEdges(frame, w, y, reach = STREAM.reach) {
  const luma = x => { const p = (y * w + x) * 3; return LUMA[0] * frame[p] + LUMA[1] * frame[p + 1] + LUMA[2] * frame[p + 2] }
  const row = Float32Array.from({ length: w }, (_, x) => luma(x))
  let peak = 0
  for (let x = 1; x < w; x++) if (row[x] < row[peak]) peak = x
  let l = -1, r = -1
  for (let x = Math.max(0, peak - reach); x <= Math.min(w - 1, peak + reach); x++) if (row[x] < STREAM.water) { if (l < 0) l = x; r = x }
  return {
    left: l > 0 ? l - 0.5 + (row[l - 1] - STREAM.water) / (row[l - 1] - row[l]) : l,
    right: r < w - 1 ? r + 0.5 + (STREAM.water - row[r]) / (row[r + 1] - row[r]) : r + 1,
  }
}

/** Where a loop's stream leaves its frame: the median of each frame's two
    edges over the whole loop (the water wobbles a few px), as the stream's
    centre and width, fractions of the frame's width. */
function streamExit(edges, w) {
  const median = a => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
  const left = median(edges.map(e => e.left)), right = median(edges.map(e => e.right))
  return { x: (left + right) / 2 / w, width: (right - left) / w }
}

/** The EXTEND rows under frame `k` of a sequence, from its bottom rows
    (`rows[i]`: frame i's last row). `past(i)` gives the row for a frame
    before 0 (a loop: itself, wrapped; the crash: the BEFORE loop); `clean`
    is the first frame whose edge carries only water (the crash: EXTEND.clean). */
function extension(rows, k, w, past, clean = 0) {
  const { rows: R, fade, fragments } = EXTEND, v = EXTEND.speed * w / 720, g = EXTEND.gravity * w / 720
  const ext = Buffer.alloc(R * w * 3)
  for (let r = 0; r < R; r++) {
    const d = (Math.sqrt(v * v + 2 * g * (r + 1)) - v) / g, t = k - d, i0 = Math.floor(t), f = t - i0
    const white = smoothstep(1 - fade, 1, (r + 1) / R), gone = smoothstep(0, fragments, r)
    // How much of a source frame's row shows at this depth.
    const keep = i => (1 - white) * (i >= 0 && i < clean ? 1 - gone : 1)
    const at = i => i >= 0 && i < rows.length ? rows[i] : past(i), a = at(i0), b = at(i0 + 1)
    const ka = keep(i0) * (1 - f), kb = keep(i0 + 1) * f
    for (let i = 0; i < w * 3; i++) ext[r * w * 3 + i] = Math.round(255 - (255 - a[i]) * ka - (255 - b[i]) * kb)
  }
  return ext
}

const BOTTOMS = {}   // a portrait loop's bottom rows, for the crash's past
const MEASURED = {}  // where each hero AFTER loop's stream leaves its frame

function encodeWeb(clip, mid) {
  const crf = { av1: 40, h264: 27, ...clip.crf }
  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libsvtav1', '-crf', String(crf.av1), '-preset', '5', '-g', String(FPS * 5), '-pix_fmt', 'yuv420p', ...color, join(OUT, `${clip.name}.webm`)])
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', '-c:v', 'libx264', '-crf', String(crf.h264), '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', `keyint=${FPS * 5}:open-gop=0`, '-movflags', '+faststart', ...color, join(OUT, `${clip.name}.mp4`)])
}

async function buildClip(clip, src) {
  if (clip.pool) return buildPool(clip, src)
  if (clip.rim) return buildRim(clip, src)
  if (clip.dayStream) return buildDayStream(clip, src)
  const { w, h } = clip
  const { count: N, graded } = grader(clip, src)
  const L = LOOP_FADE

  // The frames in playing order.
  function* sequence() {
    if (clip.once || clip.bridge) {
      // The transition plays once, start to end; a bridged loop already
      // ends on the way back to its first frame, so it just wraps.
      for (let i = 0; i < N; i++) yield graded(i)
    } else {
      // Order: L … N−L−1, then the cross-fade of the last second into the first.
      // That plays …, N−L−1, blend(N−L, 0) … blend(N−1, L−1), and wraps to L.
      for (let i = L; i < N - L; i++) yield graded(i)
      for (let j = 0; j < L; j++) {
        const a = graded(N - L + j), b = graded(j), t = (j + 0.5) / L, mix = Buffer.alloc(a.length)
        for (let k = 0; k < a.length; k++) mix[k] = Math.round(a[k] * (1 - t) + b[k] * t)
        yield mix
      }
    }
  }

  // Lossless intermediate, then the two web encodes from it.
  const H = h + (clip.extend ? EXTEND.rows : 0)
  const mid = join(CACHE, `${clip.name}.graded.mkv`)
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', mid])
  let first = null, count = 0
  // A hero AFTER loop's stream, where it leaves the frame (its last row,
  // above the extension), in every frame it plays.
  const exits = clip.name.startsWith('hero-after-') ? [] : null
  if (clip.extend) {
    // Every frame first (the extension reads the bottom rows around it).
    const frames = [...sequence()], rows = frames.map(f => Buffer.from(f.subarray((h - 1) * w * 3)))
    const M = rows.length, wrap = i => rows[((i % M) + M) % M]
    let past = wrap
    if (clip.history) {
      const before = BOTTOMS[clip.history]
      if (!before) throw new Error(`${clip.name} extends from ${clip.history}: build it in the same run`)
      past = i => before[((i % before.length) + before.length) % before.length]
    }
    if (!clip.once) BOTTOMS[clip.name] = rows
    for (const [k, f] of frames.entries()) {
      exits?.push(streamEdges(f, w, h - 1))
      const g = Buffer.concat([f, extension(rows, k, w, past, clip.once ? EXTEND.clean : 0)])
      if (!first) first = g
      await enc.write(g)
    }
    count = M
  } else {
    for (const g of sequence()) { if (!first) first = g; exits?.push(streamEdges(g, w, h - 1)); await enc.write(g); count++ }
  }
  await enc.close()
  if (exits) MEASURED[clip.name] = streamExit(exits, w)

  encodeWeb(clip, mid)
  // A hero loop's poster is the first frame it plays. The transition has none:
  // it only ever plays over the BEFORE clip; nor do the card clips, which only
  // ever play over the finished card.
  if (!clip.once && !clip.card) await sharp(first, { raw: { width: w, height: H, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toFile(join(OUT, `${clip.name}.jpg`))
  rmSync(mid)
  return { frames: clip.once ? N : count }
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

/* ── shared by the stream and the rim ──────────────────────────────────── */

/** The grader for a clip whose whole frame is void but its water: the
    hero's grade with none of the light kept, so everything that is not
    water (the wall, the plate's face) goes to white. Frames are decoded at
    (w, h) from `crop` (source pixels), less `head`. */
function voidGrader(src, w, h, head, crop = null) {
  const lw = Math.max(16, Math.round(w / 4)), lh = Math.max(16, Math.round(h / 4))
  const { field: low, exposure } = voidField(decodeAll(src, lw, lh, head, crop), lw, lh)
  const gain = low.map(ch => { const up = upsample(ch, lw, lh, w, h); for (let i = 0; i < up.length; i++) up[i] = 255 / Math.max(120, up[i]); return up })
  const frames = decodeAll(src, w, h, head, crop), keep = new Float32Array(w * h)
  return { count: frames.length, graded: i => gradeFrame(frames[i], w, h, gain, exposure[i], keep) }
}

/** A web encode (AV1 WebM, H.264 MP4) of a lossless intermediate, through
    an optional filter. */
function encodeTo(mid, out, { vf = null, crf }) {
  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
  const filter = vf ? ['-vf', vf] : []
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', ...filter, '-c:v', 'libsvtav1', '-crf', String(crf.av1), '-preset', '5', '-g', String(FPS * 5), '-pix_fmt', 'yuv420p', ...color, `${out}.webm`])
  run('ffmpeg', ['-v', 'error', '-y', '-i', mid, '-an', ...filter, '-c:v', 'libx264', '-crf', String(crf.h264), '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', `keyint=${FPS * 5}:open-gop=0`, '-movflags', '+faststart', ...color, `${out}.mp4`])
}

const median = (a) => { const s = Float32Array.from(a).sort(); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2 }
/** A row of luma values as one grey RGB row, for streamEdges. */
const grey = (values) => Buffer.from(values.flatMap(v => { const g = Math.round(Math.min(255, Math.max(0, v))); return [g, g, g] }))

/* ── the stream below the hero ─────────────────────────────────────────────
   The column (DAY_STREAM.crop), graded to white, every frame of the
   seamless loop but its last (its first again), run on below its frame by
   advection to the 9:16 rendition's length; then the two renditions (the
   16:9 one the top `rows`, the 9:16 one all of it at half scale) and their
   posters (the first frame, AVIF and WebP, which the page shows with no
   JavaScript and under the clip). Measured: the stream's centre and width
   at the clip's top (the `join` rows, where it meets the hero's stream),
   as fractions of the column's width, the same in both renditions. */
async function buildDayStream(clip, src) {
  const { crop, speed, renditions, join: joinRows, clear, crf } = DAY_STREAM
  const { w } = crop, R = Math.max(...Object.values(renditions).map(r => r.rows)), E = R - crop.h
  const { count, graded } = voidGrader(src, w, crop.h, 0, crop)
  const N = count - 1
  const frames = Array.from({ length: N }, (_, i) => graded(i).map(v => Math.round(255 - (255 - v) * clear)))
  const rows = frames.map(f => f.subarray((crop.h - 1) * w * 3))
  const at = i => rows[((i % N) + N) % N]

  const edges = []
  // The darkest pixel is one of its edges, and it is about 30 px across.
  for (const f of frames) for (let y = 0; y < joinRows; y += 8) edges.push(streamEdges(f, w, y, 48))
  const bottom = frames.map(f => streamEdges(f, w, crop.h - 1, 48))

  const mid = join(CACHE, `${clip.name}.graded.mkv`)
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${R}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', mid])
  let first = null
  for (const [k, f] of frames.entries()) {
    const ext = Buffer.alloc(E * w * 3)
    for (let r = 0; r < E; r++) {
      const t = k - (r + 1) / speed, i0 = Math.floor(t), a = at(i0), b = at(i0 + 1), m = t - i0
      for (let i = 0; i < w * 3; i++) ext[r * w * 3 + i] = Math.round(a[i] * (1 - m) + b[i] * m)
    }
    const g = Buffer.concat([f, ext])
    if (!first) first = g
    await enc.write(g)
  }
  await enc.close()

  const out = {}
  for (const [r, { rows: H, scale }] of Object.entries(renditions)) {
    const ow = Math.round(w * scale), oh = Math.round(H * scale), name = join(OUT, `${clip.name}-${r}`)
    const vf = `crop=${w}:${H}:0:0${scale !== 1 ? `,scale=${ow}:${oh}:flags=area` : ''}`
    encodeTo(mid, name, { vf, crf })
    const still = sharp(first, { raw: { width: w, height: R, channels: 3 } }).extract({ left: 0, top: 0, width: w, height: H }).resize(ow, oh, { kernel: 'lanczos3' })
    await still.clone().avif({ quality: 80, effort: 9, chromaSubsampling: '4:4:4' }).toFile(`${name}.avif`)
    await still.clone().webp({ quality: 92, effort: 6 }).toFile(`${name}.webp`)
    out[r] = { aspect: +(ow / oh).toFixed(5) }
  }
  rmSync(mid)
  const exit = streamExit(edges, w), foot = streamExit(bottom, w)
  console.log(`  stream: x ${(exit.x * w).toFixed(2)} px, width ${(exit.width * w).toFixed(2)} px at the top; width ${(foot.width * w).toFixed(2)} px on the source's last row`)
  return { frames: N, stream: { x: exit.x, width: exit.width, ...out } }
}

/* ── the AFTER card's rim ──────────────────────────────────────────────────
   The calm frames, graded to white; the plate's geometry, measured on
   their per-pixel median (rimGeometry); every piece resampled from each
   frame into the atlas (rimPieces, packAtlas); the loop cross-faded. */

/** Bilinear sample of a luma plane or an RGB buffer (channel c), pixel
    centres on integers, clamped to the frame. */
function sampler(buf, w, h, ch = 1) {
  return (x, y, c = 0) => {
    x = Math.min(w - 1, Math.max(0, x)); y = Math.min(h - 1, Math.max(0, y))
    const x0 = Math.min(w - 2, Math.floor(x)), y0 = Math.min(h - 2, Math.floor(y)), tx = x - x0, ty = y - y0
    const p = (xx, yy) => buf[(yy * w + xx) * ch + c]
    return (p(x0, y0) * (1 - tx) + p(x0 + 1, y0) * tx) * (1 - ty) + (p(x0, y0 + 1) * (1 - tx) + p(x0 + 1, y0 + 1) * tx) * ty
  }
}

/** Where a profile is darkest, to a fraction of a pixel (a parabola through
    the darkest sample and its neighbours): `at(t)` for t in [from, to]. */
function darkestAt(at, from, to) {
  let best = from
  for (let t = from; t <= to; t++) if (at(t) < at(best)) best = t
  const a = at(best - 1), b = at(best), c = at(best + 1), d = a - 2 * b + c
  return best + (d > 1e-6 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0)
}

/** A least-squares line v = a + b·t through points [t, v]. */
function fitLine(points) {
  const n = points.length, st = points.reduce((s, [t]) => s + t, 0), sv = points.reduce((s, [, v]) => s + v, 0)
  const stt = points.reduce((s, [t]) => s + t * t, 0), stv = points.reduce((s, [t, v]) => s + t * v, 0)
  const b = (n * stv - st * sv) / (n * stt - st * st), a = (sv - b * st) / n
  return t => a + b * t
}

/** The plate's outer contour on the median frame `L` (luma, 1920×1080): its
    four edges as lines (the centre of the dark outer line), each corner as
    the circle tangent to its two edges that runs darkest along the arc,
    and the two streams' axes. */
function rimGeometry(L, w, h) {
  const { guess: g, above } = RIM, at = sampler(L, w, h)
  const away = (x, s) => Math.abs(x - s) > 110
  const range = (a, b, step) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step)
  const xs = range(g.left + g.r + 20, g.right - g.r - 20, 4), ys = range(g.top + g.r + 20, g.bottom - g.r - 20, 4)
  const top = fitLine(xs.filter(x => away(x, g.inX)).map(x => [x, darkestAt(y => at(x, y), g.top - 12, g.top + 12)]))
  const bottom = fitLine(xs.filter(x => away(x, g.outX)).map(x => [x, darkestAt(y => at(x, y), g.bottom - 12, g.bottom + 12)]))
  const left = fitLine(ys.map(y => [y, darkestAt(x => at(x, y), g.left - 12, g.left + 12)]))
  const right = fitLine(ys.map(y => [y, darkestAt(x => at(x, y), g.right - 12, g.right + 12)]))

  // A corner: ix, iy are its inward signs; its circle touches the corner's
  // horizontal edge (hline, a function of x) and vertical edge (vline, of y).
  const corner = (ix, iy, hline, vline) => {
    const fit = (r) => {
      let cx = vline(hline(vline(0)) + iy * r) + ix * r, cy = hline(cx) + iy * r
      cx = vline(cy) + ix * r; cy = hline(cx) + iy * r
      return { cx, cy, r }
    }
    let best = null
    for (let r = 70; r <= 130; r += 0.25) {
      const c = fit(r)
      let s = 0
      for (let k = 0; k <= 30; k++) { const a = (15 + 60 * k / 30) * Math.PI / 180; s += at(c.cx - ix * r * Math.cos(a), c.cy - iy * r * Math.sin(a)) }
      if (!best || s < best.s) best = { ...c, s }
    }
    return best
  }
  const corners = {
    tl: corner(1, 1, top, left), tr: corner(-1, 1, top, right),
    bl: corner(1, -1, bottom, left), br: corner(-1, -1, bottom, right),
  }
  // The streams' axes: the median centre of their edges, over rows well
  // clear of the rim.
  const axis = (y0, y1, x) => {
    const c = []
    for (let y = y0; y <= y1; y += 2) {
      const e = streamEdges(grey(Array.from({ length: 121 }, (_, i) => at(x - 60 + i, y))), 121, 0, 40)
      if (e.left >= 0) c.push(x - 60 + (e.left + e.right) / 2 - 0.5)
    }
    return median(c)
  }
  const inX = axis(Math.round(top(g.inX)) - above, Math.round(top(g.inX)) - 40, g.inX)
  const outX = axis(Math.round(bottom(g.outX)) + 40, Math.round(bottom(g.outX)) + 150, g.outX)
  return { top, bottom, left, right, corners, inX, outX }
}

/** The pieces: each a size (inner, without its margin) and a map from a
    point in it (pixel centres) to a point of the source frame and how much
    of it is kept. Every piece's contour is at a known offset (see RIM). */
function rimPieces(G) {
  const { out: O, in: I, radius: Rt, corner: S, strip: Ls, above: A, below: B, streamWidth: Ws } = RIM
  // Kept across the band: all of it inside to `in` (the face beyond goes
  // white), to `out` outside; `d` is the distance in from the contour.
  const band = d => d >= 0 ? 1 - smoothstep(I - 5, I, d) : 1 - smoothstep(O - 4, O, -d)
  const inside = d => d >= 0 ? 1 - smoothstep(I - 5, I, d) : 1
  const P = O + S, T = O + I, pieces = {}
  // A corner, `ix`/`iy` its inward signs; in the piece, (u, v) is the
  // distance in from its two edges, and its arc's centre is (Rt, Rt).
  const corner = (c, ix, iy) => ({
    w: P, h: P,
    map(px, py) {
      const u = (ix > 0 ? px : P - px) - O, v = (iy > 0 ? py : P - py) - O
      const dx = u - Rt, dy = v - Rt, shift = c.r - Rt
      let ex, ey, d
      if (dx < 0 && dy < 0) { const rho = Math.max(1e-6, Math.hypot(dx, dy)), f = (rho + shift) / rho; ex = dx * f; ey = dy * f; d = Rt - rho }
      else if (dy < 0) { ex = dx; ey = dy - shift; d = v }
      else if (dx < 0) { ex = dx - shift; ey = dy; d = u }
      else { ex = dx; ey = dy; d = Math.min(u, v) }
      return [c.cx + ix * ex, c.cy + iy * ey, band(d)]
    },
  })
  pieces.tl = corner(G.corners.tl, 1, 1); pieces.tr = corner(G.corners.tr, -1, 1)
  pieces.bl = corner(G.corners.bl, 1, -1); pieces.br = corner(G.corners.br, -1, -1)
  // The straight edges: 160 source px of each, clear of the streams and
  // the corners, sampled into a strip `strip` long, the contour `out` in
  // from the outside.
  const x0 = Math.round(G.corners.tl.cx + 60), y0 = Math.round((G.corners.tl.cy + G.corners.bl.cy) / 2 - 80)
  // Each is averaged along its length in every frame (`along`), so it is
  // one cross-section that stretches cleanly (and a speck of dust on the
  // plate is not drawn out into a dash).
  const span = 160 / Ls
  pieces.top = { w: Ls, h: T, along: 'x', map: (px, py) => { const x = x0 + px * span, d = py - O; return [x, G.top(x) + d, band(d)] } }
  pieces.bottom = { w: Ls, h: T, along: 'x', map: (px, py) => { const x = x0 + px * span, d = T - O - py; return [x, G.bottom(x) - d, band(d)] } }
  pieces.left = { w: T, h: Ls, along: 'y', map: (px, py) => { const y = y0 + py * span, d = px - O; return [G.left(y) + d, y, band(d)] } }
  pieces.right = { w: T, h: Ls, along: 'y', map: (px, py) => { const y = y0 + py * span, d = T - O - px; return [G.right(y) - d, y, band(d)] } }
  // The streams: centred on their axis; the one coming in `above` px over
  // the top contour, the one leaving `below` px under the bottom one.
  pieces.in = { w: Ws, h: A + I, map: (px, py) => { const x = G.inX - Ws / 2 + px, d = py - A; return [x, G.top(x) + d, inside(d)] } }
  pieces.out = { w: Ws, h: I + B, map: (px, py) => { const x = G.outX - Ws / 2 + px, d = I - py; return [x, G.bottom(x) - d, inside(d)] } }
  return pieces
}

/** Lays the pieces out in the atlas (each grown by `margin`, `gutter` px
    apart) like the card they go round: the corners and strips of one side
    share their offset across that side (the top corners and the top strip
    one top row, the left corners and the left strip one left column, the
    bottom and right ones their bottom row and right column), so where two
    meet on the page their <video>s are offset by the same amount and the
    browser snaps them to the same device pixel. The streams go beside
    them. Returns each piece's inner rect and the atlas's size. */
function packAtlas(pieces) {
  const { margin: m, gutter: g } = RIM, step = 2 * m + g
  const C = pieces.tl.w, T = pieces.top.h, Ls = pieces.top.w
  const x1 = g + m, x2 = x1 + C + step, x3 = x2 + Ls + step, x4 = x3 + C + step, x5 = x4 + pieces.in.w + step
  const y1 = g + m, y2 = y1 + C + step, y3 = y2 + Ls + step, bottom = y3 + C
  const rect = (k, x, y) => ({ x, y, w: pieces[k].w, h: pieces[k].h })
  const rects = {
    tl: rect('tl', x1, y1), top: rect('top', x2, y1), tr: rect('tr', x3, y1),
    left: rect('left', x1, y2), right: rect('right', x3 + C - T, y2),
    bl: rect('bl', x1, y3), bottom: rect('bottom', x2, bottom - T), br: rect('br', x3, y3),
    in: rect('in', x4, y1), out: rect('out', x5, y1),
  }
  const w = x5 + pieces.out.w + m + g, h = Math.max(bottom, y1 + pieces.in.h, y1 + pieces.out.h) + m + g
  return { rects, w: Math.ceil(w / 8) * 8, h: Math.ceil(h / 8) * 8 }
}

async function buildRim(clip, src) {
  const { head, fade: L, margin: m, crf } = RIM, w = 1920, h = 1080
  const { count: N, graded } = voidGrader(src, w, h, head)
  const frames = Array.from({ length: N }, (_, i) => graded(i))
  // The median frame's luma, where the geometry is measured.
  const n = w * h, Lm = new Float32Array(n), col = new Float32Array(N)
  for (let p = 0; p < n; p++) {
    for (let f = 0; f < N; f++) col[f] = LUMA[0] * frames[f][p * 3] + LUMA[1] * frames[f][p * 3 + 1] + LUMA[2] * frames[f][p * 3 + 2]
    Lm[p] = median(col)
  }
  const G = rimGeometry(Lm, w, h), pieces = rimPieces(G), atlas = packAtlas(pieces)
  console.log('  rim:', JSON.stringify({ corners: Object.fromEntries(Object.entries(G.corners).map(([k, c]) => [k, { cx: +c.cx.toFixed(1), cy: +c.cy.toFixed(1), r: c.r }])), inX: +G.inX.toFixed(2), outX: +G.outX.toFixed(2) }))

  // Every piece's sampling map, computed once: (atlas index, source x, y, kept).
  const maps = []
  for (const [k, pc] of Object.entries(pieces)) {
    const r = atlas.rects[k]
    for (let py = -m; py < pc.h + m; py++) for (let px = -m; px < pc.w + m; px++) {
      const [sx, sy, keep] = pc.map(px + 0.5, py + 0.5)
      maps.push((r.y + py) * atlas.w + r.x + px, sx, sy, keep)
    }
  }
  const compose = (f) => {
    const out = Buffer.alloc(atlas.w * atlas.h * 3, 255), s = sampler(f, w, h, 3)
    for (let i = 0; i < maps.length; i += 4) {
      const [p, sx, sy, keep] = [maps[i], maps[i + 1], maps[i + 2], maps[i + 3]]
      for (let c = 0; c < 3; c++) out[p * 3 + c] = Math.round(255 - (255 - s(sx, sy, c)) * keep)
    }
    // The strips: every line across one is the mean of its length.
    for (const [k, pc] of Object.entries(pieces)) {
      if (!pc.along) continue
      const r = atlas.rects[k], X = pc.along === 'x', len = (X ? pc.w : pc.h) + 2 * m, across = (X ? pc.h : pc.w) + 2 * m
      for (let a = 0; a < across; a++) for (let c = 0; c < 3; c++) {
        const p = t => X ? ((r.y - m + a) * atlas.w + r.x - m + t) * 3 + c : ((r.y - m + t) * atlas.w + r.x - m + a) * 3 + c
        let s = 0
        for (let t = 0; t < len; t++) s += out[p(t)]
        for (let t = 0; t < len; t++) out[p(t)] = Math.round(s / len)
      }
    }
    // The corners' straight runs ease into their strips' cross-section by
    // the corner piece's inner end, so a corner meets its strips exactly
    // (the band is a px or two wider mid-edge than by the corners).
    const { out: O, in: I, radius: Rt, corner: S } = RIM, P = O + S, T = O + I
    const profile = (k, d, c) => {
      const r = atlas.rects[k], X = pieces[k].along === 'x'
      const pos = Math.min(T - 1, Math.max(0, (k === 'top' || k === 'left' ? d + O : T - O - d) - 0.5))
      const i0 = Math.floor(pos), i1 = Math.min(T - 1, i0 + 1), f = pos - i0
      const at = i => out[(X ? (r.y + i) * atlas.w + r.x : r.y * atlas.w + r.x + i) * 3 + c]
      return at(i0) * (1 - f) + at(i1) * f
    }
    for (const [k, ix, iy] of [['tl', 1, 1], ['tr', -1, 1], ['bl', 1, -1], ['br', -1, -1]]) {
      const r = atlas.rects[k], h = iy > 0 ? 'top' : 'bottom', v = ix > 0 ? 'left' : 'right'
      for (let py = -m; py < P + m; py++) for (let px = -m; px < P + m; px++) {
        const u = (ix > 0 ? px + 0.5 : P - px - 0.5) - O, w = (iy > 0 ? py + 0.5 : P - py - 0.5) - O
        let strip = null, t = 0
        if (u > Rt && w < Rt) { strip = [h, w]; t = smoothstep(Rt, S, u) } else if (w > Rt && u < Rt) { strip = [v, u]; t = smoothstep(Rt, S, w) }
        if (!strip || t <= 0) continue
        const p = ((r.y + py) * atlas.w + r.x + px) * 3
        for (let c = 0; c < 3; c++) out[p + c] = Math.round(out[p + c] * (1 - t) + profile(strip[0], strip[1], c) * t)
      }
    }
    return out
  }
  const tiles = frames.map(compose)

  // The flare: the incoming stream's width on each row above the top
  // contour, on the median frame's piece.
  const flare = [], at = sampler(Lm, w, h)
  for (let up = 2; up <= RIM.above; up += 2) {
    const e = streamEdges(grey(Array.from({ length: pieces.in.w }, (_, px) => { const [sx, sy] = pieces.in.map(px + 0.5, RIM.above - up + 0.5); return at(sx, sy) })), pieces.in.w, 0, 40)
    flare.push([up, +(e.right - e.left).toFixed(1)])
  }
  // Only the stream itself: from the top down while it widens; closer to
  // the contour the meniscus's curves are not one stream any more.
  const clean = []
  for (const [up, width] of [...flare].reverse()) {
    if (!(width > 0) || (clean.length && width < clean.at(-1)[1] - 1)) break
    clean.push([up, width])
  }
  clean.reverse()

  // Loop: L … N−L−1, then the last L frames cross-faded into the first L.
  const mid = join(CACHE, `${clip.name}.graded.mkv`)
  const enc = encoder(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${atlas.w}x${atlas.h}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-qp', '0', '-preset', 'veryfast', '-pix_fmt', 'yuv444p', mid])
  let count = 0
  for (let i = L; i < N - L; i++) { await enc.write(tiles[i]); count++ }
  for (let j = 0; j < L; j++) {
    const a = tiles[N - L + j], b = tiles[j], t = (j + 0.5) / L, mix = Buffer.alloc(a.length)
    for (let k = 0; k < a.length; k++) mix[k] = Math.round(a[k] * (1 - t) + b[k] * t)
    await enc.write(mix); count++
  }
  await enc.close()
  encodeTo(mid, join(OUT, clip.name), { crf })
  rmSync(mid)
  const rect = r => [r.x, r.y, r.w, r.h]
  return {
    frames: count,
    rim: {
      size: [atlas.w, atlas.h], out: RIM.out, in: RIM.in, radius: RIM.radius, corner: RIM.corner,
      above: RIM.above, below: RIM.below,
      pieces: Object.fromEntries(Object.keys(pieces).map(k => [k, rect(atlas.rects[k])])),
      flare: clean,
    },
  }
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
  // The stream below the hero is checked per rendition, as a seamless loop.
  const outputs = CLIPS.filter(c => !ONLY || ONLY.has(c.name)).flatMap(c => c.dayStream
    ? Object.keys(DAY_STREAM.renditions).map(r => ({ ...c, name: `${c.name}-${r}`, seamless: true }))
    : [c])
  for (const clip of outputs) {
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
    // A seamless or bridged loop (the pool, the AFTER loop) is held to the frame steps either side of
    // its seam instead.
    let psnr = null, step = null
    if (!clip.once) {
      const seam = run('ffmpeg', ['-v', 'info', '-sseof', '-0.05', '-i', mp4, '-i', mp4, '-filter_complex', '[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1[b];[a][b]psnr', '-f', 'null', '-'])
      psnr = +Number((seam.match(/average:([\d.]+|inf)/) || [])[1]).toFixed(1)
      // A seamless loop's seam is one of its own frame steps: it is held to
      // the steps either side of it (the last two frames, the first two).
      const wraps = clip.seamless || clip.bridge
      const at = wraps ? [-2, 0] : [10, 30, 50]
      const steps = at.map(k => k < 0 ? lastStep(mp4) : framePSNR(mp4, k, mp4, k + 1)).sort((a, b) => a - b)
      step = +(wraps ? steps[0] : steps[1]).toFixed(1)
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
  if (ONLY?.has('hero-transition-9x16') && !ONLY.has('hero-before-9x16')) throw new Error('the 9:16 crash extends from hero-before-9x16: rebuild both')
  for (const clip of CLIPS) {
    if (ONLY && !ONLY.has(clip.name)) continue
    console.log('·', clip.name)
    const source = clip.compose
      ? await composePortrait(await src('clips', clip.compose), join(CACHE, `${clip.name}.composed.mkv`), clip)
      : await src('clips', clip.source ?? clip.name)
    built[clip.name] = await buildClip(clip, source)
  }
  // What the page needs to place the card clips (motion/water.js,
  // marketing.css): the splash strip's source width (its scale on the page
  // is CSS px per source px) and its edge row, as a fraction of its height;
  // the rim atlas's pieces and the offsets they are cut to (buildRim).
  const f = v => +v.toFixed(4)
  const splash = () => {
    const { w, h, card: { crop, edge } } = CLIPS.find(c => c.name === 'card-splash')
    return { aspect: f(w / h), width: crop.w, edge: f((edge - crop.y) / crop.h) }
  }
  // The stream below the hero: its centre and width at the clip's top, as
  // fractions of the clip's width, and each rendition's aspect.
  const dayStream = () => { const { x, width, ...r } = built['day-stream'].stream; return { x: f(x), width: f(width), ...r } }
  // The pool's band: its aspect and its waterline as a fraction of its height
  // from the top (the footer's layout, e2e/pool.spec.js), and each
  // rendition's AV1 codec string (10-bit, so the page's <source> says so).
  const pool = () => {
    const clip = CLIPS.find(c => c.name === 'footer-pool')
    const [wide, narrow] = poolRenditions(clip).map(r => ({ aspect: f(r.w / r.h), av1: av1Codec(join(OUT, `${clip.name}${r.suffix}.webm`)) }))
    return { ...wide, waterline: f(poolRows(clip).line / clip.h), narrow }
  }
  const transition = r => +(built[`hero-transition-${r}`].frames / FPS).toFixed(2)
  // Where the AFTER loop's stream leaves the frame: its centre and width, as
  // fractions of the frame's width, so the page can draw it on below the
  // hero on the same x at the same width. The portrait frame's extension is
  // a fraction of its 9:16 height.
  const stream = r => ({ x: f(MEASURED[`hero-after-${r}`].x), width: f(MEASURED[`hero-after-${r}`].width) })
  const hero = (r, prev = {}) => ({
    transition: built[`hero-transition-${r}`] ? transition(r) : prev.transition,
    stream: MEASURED[`hero-after-${r}`] ? stream(r) : prev.stream,
    ...(r === '9x16' ? { extend: f(EXTEND.rows / 1280) } : {}),
  })
  const order = d => ({ $comment: 'Written by scripts/media/build-media.mjs. Do not edit by hand.', hero: d.hero, stream: d.stream, cards: d.cards, footer: d.footer, stones: d.stones })

  let doc
  if (ONLY) {
    // Patch what was rebuilt into the existing media.json.
    doc = JSON.parse(readFileSync(join(OUT, 'media.json'), 'utf8'))
    for (const name of Object.keys(built)) {
      if (name.startsWith('hero-')) doc.hero[name.slice(-4)] = hero(name.slice(-4), doc.hero[name.slice(-4)])
      if (name === 'card-splash') doc.cards.before = splash()
      if (name === 'card-rim') doc.cards.rim = built[name].rim
      if (name === 'day-stream') doc.stream = dayStream()
      if (name === 'footer-pool') doc.footer = { pool: pool() }
    }
    doc.cards = { before: doc.cards.before, rim: doc.cards.rim }
    doc = order(doc)
  } else {
    const raw = await stones(await src('stills', 'fragments-cutout'), 'raw', 7)
    const pebbles = await stones(await src('stills', 'pebbles-cutout'), 'pebble', 4)
    doc = order({
      hero: { '16x9': hero('16x9'), '9x16': hero('9x16') },
      stream: dayStream(),
      cards: { before: splash(), rim: built['card-rim'].rim },
      footer: { pool: pool() },
      stones: { raw, pebble: pebbles },
    })
  }
  writeFileSync(join(OUT, 'media.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(JSON.stringify(doc, null, 2))
  checks()
}

main().catch(err => { console.error(err); process.exit(1) })
