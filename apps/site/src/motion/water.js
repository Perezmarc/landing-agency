/* The calendar's water: an accent on the chosen team's two cards' borders,
   and the hero's stream carried down to the AFTER card set flowing.

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
     STREAM                  the hero's stream, from the hero's bottom edge
                             down to the AFTER card, is drawn in the server
                             HTML and placed by CSS (.mk-day-stream), still;
                             this sets it flowing (`is-flowing`: glints and
                             ripples drifting down it) while it is near the
                             viewport.

   Media tier only (index.js), and only once the calendar is near the
   viewport: nothing is requested before. The server HTML has no video and
   the CSS default is the finished calendar without water, so a refused
   play() just leaves the page as it is. Placement is CSS (marketing.css):
   this only hands each card clip what media.json says about it (the AFTER
   clip's `fit` box, the strip's source `width` and `edge` row) as custom
   properties, and each strip its measured place (align). The clips follow
   the chosen tab, and each plays only while it is on screen, in a visible
   tab. */

import { makeVideo, play } from './video.js'

const NEAR = '100% 0px'   // create the clips a screen before the calendar
const SIGHT = '50% 0px'   // and play each one (and the stream flow) from half a screen before it is in view
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

  // Each clip plays from a little before it scrolls into view, so it has
  // its first frame up before it is seen.
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
    clips = { before: [], after: null }
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

  // The strips are laid out for the card's width, so they are redone when
  // the layout changes.
  function align() {
    if (clips) strips(panel()?.querySelector('[data-cal="before"]'))
  }
  // Into the chosen team's two cards (a move, so nothing is fetched again);
  // align() moves the strips.
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
      if (which === 'after') { drop(v); clips.after = null } else { clips.before.forEach(drop); clips.before = [] }
    })
  }
  const all = () => clips ? [...clips.before, clips.after].filter(Boolean) : []

  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    near.disconnect()
    create()
  }, { rootMargin: NEAR })
  tabs.addEventListener('change', place)
  // Redone whenever the page's box changes (a resize, fonts, a taller week).
  new ResizeObserver(() => align()).observe(document.body)
  // The drawn stream flows only while it is near the viewport (it is CSS
  // only, so it needs nothing loaded).
  const stream = document.querySelector('[data-stream]')
  if (stream) new IntersectionObserver(([e]) => stream.classList.toggle('is-flowing', e.isIntersecting), { rootMargin: SIGHT }).observe(stream)
  document.addEventListener('visibilitychange', () => all().forEach(v => document.hidden ? v.pause() : resume(v)))
  addEventListener('pagehide', () => all().forEach(v => v.pause()))
  addEventListener('pageshow', (e) => { if (e.persisted) all().forEach(resume) })

  // After load, like the hero's clips, so they never compete with the page.
  const start = () => near.observe(root)
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
