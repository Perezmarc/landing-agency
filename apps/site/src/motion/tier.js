/* How much motion this device gets. Pure, so it is unit-tested; device.js
   gathers the inputs from the browser.

   reduced motion  → no videos, no reveal or calendar animation; the hero's
                     before/after is the posters' crossfade
   Save-Data, 2g   → motion, but posters only: no media requests
   a device that REPORTS under 4 GB of memory
                   → motion, posters only
   anything else   → the clips: BEFORE, the crash, AFTER

   A device is demoted only on positive evidence. Safari and Firefox expose no
   `deviceMemory` and WebKit clamps `hardwareConcurrency`, so a missing or
   low-looking core count says nothing: a modern iPhone must get the clips. */

export function selectTier({ reducedMotion = false, saveData = false, effectiveType = '4g', memory } = {}) {
  if (reducedMotion) return { motion: false, media: false }
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') return { motion: true, media: false }
  return { motion: true, media: !(typeof memory === 'number' && memory < 4) }
}
