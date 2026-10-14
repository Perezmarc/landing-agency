/* The calendar's water: the stream below the hero set flowing, and an
   accent on the chosen team's two cards' borders.

     STREAM                  the hero's stream, from the hero's bottom edge
                             down to the AFTER card: a clip of one falling
                             stream (day-stream), placed by CSS
                             (.mk-day-stream). The server HTML has its first
                             frame as a still; this lays the playing clip
                             over it (the rendition the layout uses), and
                             plays it while it is near the viewport.
     BEFORE ("Today")        small splashes sitting on the card's top border:
                             a thin strip clip (card-splash, the slab's top
                             edge where the rain lands), drawn small, ON the
                             card, multiplied (its white disappears), its
                             edge row on the border, repeated along it: 1–4
                             copies (by the card's width), each at its own
                             time, cross-faded into each other.
     AFTER ("With an agent") a line of water on the card's border, the
                             stream landing on its top and leaving its
                             bottom: one atlas clip (card-rim) laid round the
                             card by CSS like a 9-slice (.mk-rim), twelve
                             views of it played as one: four corners, two
                             sides, and three of each of the top and bottom
                             pieces (the junction where the stream meets the
                             rim, and a stretch either side of it).

   Media tier only (index.js). The stream's clip is created once the stream
   is in view (its still is already there), the cards' clips once the
   calendar is near: nothing is requested before, and nothing before
   `load`. The CSS default is the
   finished calendar without water and the stream's still, so a refused
   play() just leaves the page as it is. Placement is CSS (marketing.css):
   this only hands each clip what media.json says about it as custom
   properties, and measures what CSS cannot know: where each splash strip
   goes along its border, and where the page stream meets the AFTER card
   (its x, and the row over the border where the rim's own stream, widening
   into the rim, is as wide as it: there the page stream fades out and the
   rim's fades in). The card clips follow the chosen tab, and every clip
   plays only near the viewport, in a visible tab. */

import { makeVideo, onFrame, play } from './video.js'

const NEAR = '100% 0px'   // create the clips a screen before they are in view
const SIGHT = '50% 0px'   // and play each one from half a screen before
const GOLDEN = 0.618     // copies of one clip start this far apart in its loop, so they never repeat
const PORTRAIT = '(max-aspect-ratio: 1/1)'
const DRIFT = 0.08       // s: how far a rim piece may drift from the first before it is put back

/* The BEFORE strip's copies along a border `span` px long, each `copy` px
   wide (its CSS scale): as few as cover it with neighbours overlapping by at
   least OVERLAP of a copy, one if a copy nearly spans it. `places` is each
   copy's left edge as a share of the room left over (0 at the left, 1 at
   the right, 0.5 alone); `overlap` is how much of a copy its neighbour
   covers, the width of the linear cross-fade between them, so the two
   always add up to one strip and no seam shows. */
const OVERLAP = 0.15, ALONE = 0.1
export function stripPlaces(span, copy) {
  if (!(copy > 0) || span - copy <= ALONE * copy) return { places: [0.5], overlap: 0 }
  const n = 1 + Math.ceil((span - copy) / (copy * (1 - OVERLAP)))
  return { places: Array.from({ length: n }, (_, i) => i / (n - 1)), overlap: 1 - (span - copy) / (n - 1) / copy }
}

/* Where the page stream hands over to the rim's: the incoming stream's
   width (source px) on rows `up` source px over the rim's contour
   (`flare`, from the top down, widening as it meets the rim). The row, from
   the top, where it is first at least `width` source px wide; the lowest
   measured row if it never is. */
export function landingRow(flare, width) {
  const rows = [...flare].sort((a, b) => b[0] - a[0])
  return (rows.find(([, w]) => w >= width) ?? rows.at(-1))[0]
}

/* The rim's views of its atlas (media.json `cards.rim`): each corner and
   side piece as it is, and the top and bottom pieces three times each, as
   their left stretch (`-l`), their junction (`-c`) and their right stretch
   (`-r`): [x, y, width, height] in the atlas. */
export function rimViews({ pieces, stretch, junction }) {
  const views = {}
  for (const [k, [x, y, w, h]] of Object.entries(pieces)) {
    if (!(k in junction)) { views[k] = [x, y, w, h]; continue }
    const j = junction[k]
    Object.assign(views, { [`${k}-l`]: [x, y, stretch, h], [`${k}-c`]: [x + stretch, y, j, h], [`${k}-r`]: [x + stretch + j, y, stretch, h] })
  }
  return views
}

/** @param {HTMLElement} root the [data-day] wrapper, carrying data-water */
export function initWater(root) {
  const data = JSON.parse(root.dataset.water)
  const tabs = root.querySelector('[data-ui-tabs]')
  const panel = () => root.querySelector(`.ui-tabs-panel[data-value="${tabs.querySelector('.ui-tabs-input:checked')?.value}"]`)
  const stream = document.querySelector('[data-stream]')
  const portrait = matchMedia(PORTRAIT)
  const seen = new WeakSet()
  const refused = new Set()
  let clips = null, flow = null, rim = null

  // Each clip plays from a little before it scrolls into view, so it has
  // its first frame up before it is seen. The rim's pieces play as one, so
  // the rim itself is watched.
  const sight = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { seen.add(e.target); resume(e.target) } else { seen.delete(e.target); videos(e.target).forEach(v => v.pause()) }
    }
  }, { rootMargin: SIGHT })
  const videos = el => el.tagName === 'VIDEO' ? [el] : [...el.querySelectorAll('video')]
  function clip(which, sources, className) {
    const v = makeVideo(sources, className)
    v.dataset.water = which
    return v
  }
  function drop(el) { sight.unobserve(el); seen.delete(el); videos(el).forEach(v => v.pause()); el.remove() }
  // A copy that starts `i` golden steps into the loop.
  function offset(v, i) {
    v.addEventListener('loadedmetadata', () => { v.currentTime = (i * GOLDEN % 1) * v.duration }, { once: true })
  }
  const vars = (el, values) => { for (const [k, v] of Object.entries(values)) el.style.setProperty(k, v) }

  /* The stream: the clip for the rendition the layout uses, over its still;
     a layout change across the query swaps it. */
  function flowing() {
    const r = portrait.matches ? 'p' : 'l'
    if (refused.has('stream') || flow?.dataset.rendition === r) return
    if (flow) drop(flow)
    flow = clip('stream', data.stream[r], 'mk-day-stream-video')
    flow.dataset.rendition = r
    stream.append(flow)
    sight.observe(flow)
  }

  /* The rim: a <video> of the whole atlas for each view of it (rimViews),
     each showing its rect; shown once every one has a frame. */
  function makeRim() {
    const { webm, mp4, size: [aw, ah], junction } = data.rim
    const el = document.createElement('div')
    el.className = 'mk-rim'
    el.dataset.water = 'rim'
    vars(el, {
      '--aw': aw, '--ah': ah, '--rim-out': data.rim.out, '--rim-in': data.rim.in, '--rim-corner': data.rim.corner,
      '--rim-above': data.rim.above, '--rim-below': data.rim.below, '--jt': junction.top, '--jb': junction.bottom, '--jf': data.rim.fade,
    })
    let waiting = 0
    for (const [k, [px, py, pw, ph]] of Object.entries(rimViews(data.rim))) {
      const piece = document.createElement('div')
      piece.className = 'mk-rim-piece'
      piece.dataset.piece = k
      vars(piece, { '--px': px, '--py': py, '--pw': pw, '--ph': ph })
      const v = clip('rim', { webm, mp4 }, 'mk-rim-video')
      waiting++
      onFrame(v, () => { if (--waiting === 0) el.classList.add('is-ready') })
      piece.append(v)
      el.append(piece)
    }
    // Played as one: every piece follows the first.
    const [lead, ...rest] = videos(el)
    lead.addEventListener('timeupdate', () => {
      for (const v of rest) {
        const d = Math.abs(v.currentTime - lead.currentTime)
        if (!v.paused && Math.min(d, lead.duration - d) > DRIFT) v.currentTime = lead.currentTime
      }
    })
    return el
  }

  function create() {
    clips = { before: [] }
    if (!refused.has('rim')) { rim = makeRim(); sight.observe(rim) }
    place()
  }

  /* The BEFORE strip's copies along the card's top border: as many as its
     width needs at the strip's CSS scale (stripPlaces), each handed its
     place. The strip's size and its edge row on the border are CSS. */
  function strips(card) {
    if (!card || refused.has('before')) return
    const add = () => {
      const i = clips.before.length, v = clip('before', data.before, 'mk-cal-water mk-cal-water--before')
      vars(v, { '--water-ar': data.before.aspect, '--water-src': data.before.width, '--water-edge': data.before.edge })
      offset(v, i)
      sight.observe(v)
      clips.before.push(v)
    }
    if (!clips.before.length) add()
    // The first copy is measured where it is drawn (after a tab change it is
    // still in the hidden panel's card), the rest follow it in order.
    if (clips.before[0].parentNode !== card) card.append(clips.before[0])
    const { places, overlap } = stripPlaces(card.getBoundingClientRect().width, clips.before[0].getBoundingClientRect().width)
    while (clips.before.length > places.length) drop(clips.before.pop())
    while (clips.before.length < places.length) add()
    // In order, so the CSS can tell the first and last copies (their outer
    // ends fade at the card's corners, the others over their overlap).
    clips.before.forEach((v, i) => {
      if (v.parentNode !== card) card.append(v)
      vars(v, { '--water-at': places[i], '--water-overlap': `${(overlap * 100).toFixed(2)}%` })
    })
  }

  /* Where the page stream meets the AFTER card: the rim's streams on its x,
     and the hand-over row, where the page stream fades out. */
  function landing(card) {
    if (!rim || !card) return
    const s = stream.getBoundingClientRect(), c = card.getBoundingClientRect()
    const k = parseFloat(getComputedStyle(rim).getPropertyValue('--rim-k'))
    const x = s.left + data.stream.x * s.width, width = data.stream.width * s.width
    const land = landingRow(data.rim.flare, width / k)
    vars(rim, { '--rim-x': `${(x - c.left).toFixed(2)}px`, '--rim-land': land })
    // The row the rim's stream fades in from, in the stream's own box; the
    // page stream has faded out by the end of the same --rim-fade.
    const fade = parseFloat(getComputedStyle(rim).getPropertyValue('--rim-fade'))
    stream.style.setProperty('--stream-end', `${(c.top + 0.5 - land * k - s.top + fade).toFixed(2)}px`)
  }

  // The strips and the landing are laid out for the layout, so they are
  // redone when it changes.
  function align() {
    if (!clips) return
    const p = panel()
    strips(p?.querySelector('[data-cal="before"]'))
    landing(rim?.parentNode)
  }
  // Into the chosen team's two cards (a move, so nothing is fetched again);
  // align() moves the strips.
  function place() {
    const after = panel()?.querySelector('[data-cal="after"]')
    if (rim && after && rim.parentNode !== after) after.append(rim)
    align()
  }
  function resume(el) {
    if (!el.isConnected || !seen.has(el) || document.hidden) return
    const vs = videos(el).filter(v => v.paused)
    if (!vs.length) return
    // The rim's pieces start together, from the first one's time.
    if (el === rim) vs.forEach((v) => { v.currentTime = vs[0].currentTime })
    vs.forEach(v => play(v, () => refuse(el)))
  }
  function refuse(el) {
    const which = el.dataset.water
    if (refused.has(which)) return
    refused.add(which)
    if (which === 'before') { clips.before.forEach(drop); clips.before = [] }
    if (which === 'rim') { drop(rim); rim = null; stream.style.removeProperty('--stream-end') }
    if (which === 'stream') { drop(flow); flow = null }
  }
  const all = () => [...(clips?.before ?? []), rim, flow].filter(Boolean)

  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    near.disconnect()
    create()
  }, { rootMargin: NEAR })
  // The stream's clip only once the stream is in view: its first frame is
  // already there as the still, so it can come late, and it never competes
  // with the hero's crash, which plays a screen above.
  const nearStream = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    nearStream.disconnect()
    flowing()
  })
  tabs.addEventListener('change', place)
  portrait.addEventListener('change', () => { if (flow) flowing() })
  // Redone whenever the page's box changes (a resize, fonts, a taller week).
  new ResizeObserver(() => align()).observe(document.body)
  document.addEventListener('visibilitychange', () => all().forEach(el => document.hidden ? videos(el).forEach(v => v.pause()) : resume(el)))
  addEventListener('pagehide', () => all().forEach(el => videos(el).forEach(v => v.pause())))
  addEventListener('pageshow', (e) => { if (e.persisted) all().forEach(resume) })

  // After load, like the hero's clips, so they never compete with the page.
  const start = () => { near.observe(root); if (stream) nearStream.observe(stream) }
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
