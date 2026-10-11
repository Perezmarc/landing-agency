/* The landing page's motion. The ONE script on the site, loaded by a single
   bare <script> in Home.astro; blog, contact and legal ship none.

   The server HTML is already the final, no-JS state. This only adds motion on
   top, by data attributes and classes the CSS already knows. No strings live
   here: everything readable is in the HTML.

   What runs depends on the device (tier.js): reduced motion gets a still page
   with a soft poster crossfade in the hero; Save-Data and weak devices get the
   motion but no video. */

import { selectTier } from './tier.js'
import { initHero } from './hero.js'
import { initCalendar } from './calendar.js'
import { initReveal } from './reveal.js'
import { initMoments } from './moments.js'

const conn = navigator.connection || {}
const tier = selectTier({
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  saveData: Boolean(conn.saveData),
  effectiveType: conn.effectiveType,
  finePointer: matchMedia('(pointer: fine)').matches,
  cores: navigator.hardwareConcurrency || 4,
  memory: navigator.deviceMemory || 4,
})

const hero = document.querySelector('[data-hero]')
if (hero) initHero(hero, tier)

if (tier.motion) {
  const day = document.querySelector('[data-day]')
  if (day) initCalendar(day)
  initReveal(document.querySelectorAll('[data-reveal]'))
  if (tier.media) initMoments(document.querySelectorAll('[data-moment]'))
}
