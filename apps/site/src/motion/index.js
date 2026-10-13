/* The landing page's motion. The ONE script on the site, loaded by a single
   bare <script> in Home.astro; blog, contact and legal ship none.

   The server HTML is already the final, no-JS state. This only adds motion on
   top, by data attributes and classes the CSS already knows. No strings live
   here: everything readable is in the HTML.

   What runs depends on the device (tier.js): reduced motion gets a still page
   with a soft poster crossfade in the hero; Save-Data and weak devices get the
   motion but no video (no hero clips, no water on the calendar, the footer's
   pool a still poster). */

import { selectTier } from './tier.js'
import { initHero } from './hero.js'
import { initCalendar } from './calendar.js'
import { initWater } from './water.js'
import { initPool } from './pool.js'
import { initReveal } from './reveal.js'

const conn = navigator.connection || {}
const tier = selectTier({
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  saveData: Boolean(conn.saveData),
  effectiveType: conn.effectiveType,
  memory: navigator.deviceMemory,
})

const hero = document.querySelector('[data-hero]')
if (hero) initHero(hero, tier)

if (tier.motion) {
  const day = document.querySelector('[data-day]')
  if (day) initCalendar(day)
  if (day && tier.media) initWater(day)
  initReveal(document.querySelectorAll('[data-reveal]'))
  const pool = document.querySelector('[data-pool]')
  if (pool && tier.media) initPool(pool)
}
