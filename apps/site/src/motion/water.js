/* The calendar's water: two looping clips on the chosen team's cards.

     BEFORE ("Today")        water splashes over the card's top border and
                             drips a short way down it: the clip sits ON the
                             card, multiplied (its white disappears).
     AFTER ("With an agent") the water runs down just outside both sides
                             and leaves below as one stream: the clip sits
                             BEHIND the card, whose white surface hides the
                             slab it was filmed on.
     STREAM                  the stream falling onto the AFTER card: the
                             hero's own stream (cut from its AFTER loop),
                             also behind the card, on the x where the hero's
                             stream leaves the hero, at the hero's scale.

   Media tier only (index.js), and only once the calendar is near the
   viewport: nothing is requested before. The server HTML has no video and
   the CSS default is the finished calendar without water, so a refused
   play() just leaves the card as it is. Placement is CSS (marketing.css):
   this only hands each clip the box it fits to its card (media.json `fit`),
   as custom properties, and the stream its measured place (align). The
   clips follow the chosen tab, and pause off screen and in a hidden tab. */

import { makeVideo, play } from './video.js'

const NEAR = '50% 0px'   // create the clips half a screen before the calendar
const PORTRAIT = '(max-aspect-ratio: 1/1)'   // the hero's 9:16 rendition (marketing.css)
const EDGE = 24          // the stream lands at least this far inside the card

/** @param {HTMLElement} root the [data-day] wrapper, carrying data-water */
export function initWater(root) {
  const data = JSON.parse(root.dataset.water)
  const tabs = root.querySelector('[data-ui-tabs]')
  const panel = () => root.querySelector(`.ui-tabs-panel[data-value="${tabs.querySelector('.ui-tabs-input:checked')?.value}"]`)
  let clips = null, onScreen = false

  function create() {
    clips = {}
    for (const which of ['before', 'after']) {
      const { webm, mp4, aspect, fit } = data[which]
      const v = makeVideo({ webm, mp4 }, `mk-cal-water mk-cal-water--${which}`)
      for (const [k, value] of Object.entries({ ar: aspect, l: fit.left, t: fit.top, r: fit.right, b: fit.bottom })) v.style.setProperty(`--water-${k}`, value)
      clips[which] = v
    }
    const { webm, mp4, aspect } = data.stream
    clips.stream = makeVideo({ webm, mp4 }, 'mk-cal-water mk-cal-water--stream')
    clips.stream.style.setProperty('--stream-ar', aspect)
    place()
  }
  /* The stream lands where the hero's stream leaves the hero: its x on
     screen (where it crosses the hero frame's bottom, media.json
     hero.*.stream.x), at the hero's scale (one card-stream pixel is `unit`
     of the hero frame's width), held EDGE inside the card. Both are layout
     measurements, so they are set inline and redone on resize. */
  function align() {
    const v = clips?.stream, card = v?.parentNode, hero = document.querySelector('.mk-hero-media')
    if (!v || !card || !hero) return
    const s = data.hero[matchMedia(PORTRAIT).matches ? 'p' : 'l']
    const h = hero.getBoundingClientRect(), c = card.getBoundingClientRect()
    const width = data.stream.width * s.unit * h.width
    const x = Math.min(c.right - EDGE, Math.max(c.left + EDGE, h.left + s.x * h.width))
    v.style.setProperty('--stream-w', `${width.toFixed(2)}px`)
    v.style.setProperty('--stream-left', `${(x - c.left - card.clientLeft - data.stream.x * width).toFixed(2)}px`)
  }
  // Into the chosen team's two cards (a move, so nothing is fetched again).
  function place() {
    const p = panel()
    if (!clips || !p) return
    for (const [which, v] of Object.entries(clips)) {
      const card = p.querySelector(`[data-cal="${which === 'stream' ? 'after' : which}"]`)
      if (v && card && v.parentNode !== card) card.append(v)
    }
    align()
    resume()
  }
  function resume() {
    if (!clips || !onScreen || document.hidden) return
    for (const [which, v] of Object.entries(clips)) if (v?.paused) play(v, () => { v.remove(); clips[which] = null })
  }
  function pause() { if (clips) Object.values(clips).forEach(v => v?.pause()) }

  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    near.disconnect()
    create()
  }, { rootMargin: NEAR })
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting
    onScreen ? resume() : pause()
  }).observe(root)
  tabs.addEventListener('change', place)
  addEventListener('resize', align, { passive: true })
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume())
  addEventListener('pagehide', pause)
  addEventListener('pageshow', (e) => { if (e.persisted) resume() })

  // After load, like the hero's clips, so they never compete with the page.
  const start = () => near.observe(root)
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
