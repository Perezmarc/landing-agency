/* The landing page's motion, loaded by a single bare <script> in Home.astro.
   The only other script on the site is the footer's pool (footer.js), which
   every page loads; use cases, blog, contact and legal ship nothing else.

   The server HTML is already the final, no-JS state. This only adds motion on
   top, by data attributes and classes the CSS already knows. No strings live
   here: everything readable is in the HTML.

   What runs depends on the device (tier.js): reduced motion gets a still page
   with a soft poster crossfade in the hero; Save-Data and weak devices get the
   motion but no video (no hero clips, no water on the calendar). */

import { deviceTier } from './device.js'
import { initHero } from './hero.js'
import { initCalendar } from './calendar.js'
import { initWater } from './water.js'
import { initReveal } from './reveal.js'

const tier = deviceTier()

const hero = document.querySelector('[data-hero]')
if (hero) initHero(hero, tier)

if (tier.motion) {
  const day = document.querySelector('[data-day]')
  if (day) initCalendar(day)
  if (day && tier.media) initWater(day)
  initReveal(document.querySelectorAll('[data-reveal]'))
}
