/* The footer's pool, on every page: the one script outside the home page,
   loaded by a bare <script> in Footer.astro. It only lays the looping clip
   over the poster the footer already shows (pool.js), on the media tier,
   once the footer is near; everywhere else the poster stays. */

import { deviceTier } from './device.js'
import { initPool } from './pool.js'

const footer = document.querySelector('[data-pool]')
const tier = deviceTier()
if (footer && tier.motion && tier.media) initPool(footer)
