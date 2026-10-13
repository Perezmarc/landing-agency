/* The calendar's water: an accent on the chosen team's two cards' borders,
   and the hero's stream carried down to the AFTER card.

     BEFORE ("Today")        small splashes sitting on the card's top border:
                             a thin strip clip (card-splash, the slab's top
                             edge where the rain lands), drawn small, ON the
                             card, multiplied (its white disappears), its
                             edge row on the border, repeated along it: 1–4
                             copies (by the card's width), each at its own
                             time, cross-faded into each other.
     AFTER ("With an agent") a thin edge of water runs down just outside both
                             sides and leaves below: the clip sits BEHIND the
                             card, whose white surface hides the rest.
     STREAM                  the hero's own stream (card-stream, cut from its
                             AFTER loop), from the hero's bottom edge down to
                             the AFTER card's top border, on the x where the
                             hero's stream leaves the hero, at its scale: one
                             clip is short, so copies are stacked, each at
                             its own time, behind the text and the cards.

   Media tier only (index.js), and only once the calendar is near the
   viewport: nothing is requested before. The server HTML has no video and
   the CSS default is the finished calendar without water, so a refused
   play() just leaves the page as it is. Placement is CSS (marketing.css):
   this only hands each card clip what media.json says about it (the AFTER
   clip's `fit` box, the strip's source `width` and `edge` row) as custom
   properties, and each strip and stream copy its measured place (align).
   The clips follow the chosen tab, and each plays only while it is on
   screen, in a visible tab. */

import { makeVideo, play } from './video.js'

const NEAR = '100% 0px'   // create the clips a screen before the calendar (the stream starts above it)
const SIGHT = '50% 0px'   // and play each one from half a screen before it is in view
const PORTRAIT = '(max-aspect-ratio: 1/1)'   // the hero's 9:16 rendition (marketing.css)
const EDGE = 24          // the stream lands at least this far inside the card
const TUCK = 24          // and runs this far under its top border
/* Each stream copy shows its rows below HIDE (the clip narrows down the
   column: its lower rows have the width the stream has at the hero's edge),
   fading in from HIDE to SOLID over the copy above; copies are STEP apart,
   so each one's fade lies on the solid rows of the one above. */
const HIDE = 0.4, SOLID = 0.55, STEP = 1 - SOLID
const GOLDEN = 0.618     // copies of one clip start this far apart in its loop, so they never repeat

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

/** @param {HTMLElement} root the [data-day] wrapper, carrying data-water */
export function initWater(root) {
  const data = JSON.parse(root.dataset.water)
  const tabs = root.querySelector('[data-ui-tabs]')
  const panel = () => root.querySelector(`.ui-tabs-panel[data-value="${tabs.querySelector('.ui-tabs-input:checked')?.value}"]`)
  const seen = new WeakSet()
  const refused = new Set()
  let clips = null

  // Each clip plays from a little before it scrolls into view, so a stream
  // copy has its first frame up before it is seen.
  const sight = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { seen.add(e.target); resume(e.target) } else { seen.delete(e.target); e.target.pause() }
    }
  }, { rootMargin: SIGHT })
  function clip(which) {
    const { webm, mp4 } = data[which]
    const v = makeVideo({ webm, mp4 }, `mk-cal-water mk-cal-water--${which}`)
    v.dataset.water = which
    sight.observe(v)
    return v
  }
  function drop(v) { sight.unobserve(v); seen.delete(v); v.pause(); v.remove() }
  // A copy that starts `i` golden steps into the loop.
  function offset(v, i) {
    v.addEventListener('loadedmetadata', () => { v.currentTime = (i * GOLDEN % 1) * v.duration }, { once: true })
  }

  function create() {
    clips = { before: [], after: null, stream: [] }
    const { aspect, fit } = data.after
    const v = clip('after')
    for (const [k, value] of Object.entries({ ar: aspect, l: fit.left, t: fit.top, r: fit.right, b: fit.bottom })) v.style.setProperty(`--water-${k}`, value)
    clips.after = v
    place()
  }

  /* The BEFORE strip's copies along the card's top border: as many as its
     width needs at the strip's CSS scale (stripPlaces), each handed its
     place. The strip's size and its edge row on the border are CSS. */
  function strips(card) {
    if (!card || refused.has('before')) return
    const add = () => {
      const i = clips.before.length, v = clip('before')
      for (const [k, value] of Object.entries({ ar: data.before.aspect, src: data.before.width, edge: data.before.edge })) v.style.setProperty(`--water-${k}`, value)
      offset(v, i)
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
      v.style.setProperty('--water-at', places[i])
      v.style.setProperty('--water-overlap', `${(overlap * 100).toFixed(2)}%`)
    })
  }

  /* The stream starts where the hero's stream leaves the hero: its x on
     screen (where it crosses the hero frame's bottom, media.json
     hero.*.stream.x), at the hero's scale (one card-stream pixel is `unit`
     of the hero frame's width), held EDGE inside the card, from the hero's
     bottom edge to TUCK under the AFTER card's top border. A copy wholly
     behind the BEFORE card (stacked layouts) is left out. All of it is layout
     measurement, so it is set inline and redone when the layout changes. */
  function align() {
    if (!clips) return
    strips(panel()?.querySelector('[data-cal="before"]'))
    const card = clips.after?.parentNode ?? panel()?.querySelector('[data-cal="after"]')
    const hero = document.querySelector('.mk-hero'), media = document.querySelector('.mk-hero-media')
    if (!card || !hero || !media || refused.has('stream')) return
    const s = data.hero[matchMedia(PORTRAIT).matches ? 'p' : 'l']
    const m = media.getBoundingClientRect(), c = card.getBoundingClientRect()
    const before = card.parentNode.querySelector('[data-cal="before"]')?.getBoundingClientRect()
    const width = data.stream.width * s.unit * m.width
    const height = width / data.stream.aspect
    const x = Math.min(c.right - EDGE, Math.max(c.left + EDGE, m.left + s.x * m.width))
    const origin = c.top + card.clientTop   // the card's padding box: what the copies are placed from
    const start = hero.getBoundingClientRect().bottom, end = c.top + TUCK
    const hidden = (top, bottom) => before && x > before.left && x < before.right && top >= before.top && bottom <= before.bottom
    const wanted = []
    for (let top = start - SOLID * height; top + SOLID * height < end; top += STEP * height) {
      if (!hidden(top + HIDE * height, top + height)) wanted.push(top)
    }
    while (clips.stream.length > wanted.length) drop(clips.stream.pop())
    wanted.forEach((top, i) => {
      let v = clips.stream[i]
      if (!v) {
        v = clips.stream[i] = clip('stream')
        v.style.setProperty('--stream-ar', data.stream.aspect)
        v.style.setProperty('--stream-hide', `${HIDE * 100}%`)
        v.style.setProperty('--stream-solid', `${SOLID * 100}%`)
        offset(v, i)   // each copy at its own time, so the stacked copies never repeat
      }
      if (v.parentNode !== card) card.append(v)   // in order, so each copy paints over the one above
      v.style.setProperty('--stream-w', `${width.toFixed(2)}px`)
      v.style.setProperty('--stream-left', `${(x - c.left - card.clientLeft - data.stream.x * width).toFixed(2)}px`)
      v.style.setProperty('--stream-top', `${(top - origin).toFixed(2)}px`)
    })
  }
  // Into the chosen team's two cards (a move, so nothing is fetched again);
  // align() moves the strips and the stream copies.
  function place() {
    const p = panel()
    if (!clips || !p) return
    const after = p.querySelector('[data-cal="after"]')
    if (clips.after && after && clips.after.parentNode !== after) after.append(clips.after)
    align()
  }
  function resume(v) {
    if (!v.isConnected || !seen.has(v) || document.hidden || !v.paused) return
    play(v, () => {
      const which = v.dataset.water
      refused.add(which)
      if (which === 'after') { drop(v); clips.after = null } else { clips[which].forEach(drop); clips[which] = [] }
    })
  }
  const all = () => clips ? [...clips.before, clips.after, ...clips.stream].filter(Boolean) : []

  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    near.disconnect()
    create()
  }, { rootMargin: NEAR })
  tabs.addEventListener('change', place)
  // Redone whenever the page's box changes (a resize, fonts, images, anything
  // above the card changing height), and again each time the calendar comes
  // near, so a shift that left the page's size alone cannot leave it behind.
  new ResizeObserver(() => align()).observe(document.body)
  new IntersectionObserver(([e]) => { if (e.isIntersecting) align() }, { rootMargin: NEAR }).observe(root)
  document.addEventListener('visibilitychange', () => all().forEach(v => document.hidden ? v.pause() : resume(v)))
  addEventListener('pagehide', () => all().forEach(v => v.pause()))
  addEventListener('pageshow', (e) => { if (e.persisted) all().forEach(resume) })

  // After load, like the hero's clips, so they never compete with the page.
  const start = () => near.observe(root)
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
