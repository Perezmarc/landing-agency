/* How much motion this device gets. Pure, so it is unit-tested; index.js
   gathers the inputs from the browser.

   reduced motion  → no videos, no reveal or calendar animation; the hero's
                     before/after is the posters' crossfade
   Save-Data, 2g   → motion, but posters only: no media requests
   a capable device (8+ cores with a fine pointer, or 4+ cores and 4+ GB)
                   → the clips: BEFORE, the crash, AFTER
   anything weaker → motion, posters only */

export function selectTier({ reducedMotion = false, saveData = false, effectiveType = '4g', finePointer = false, cores = 4, memory = 4 } = {}) {
  if (reducedMotion) return { motion: false, media: false }
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') return { motion: true, media: false }
  return { motion: true, media: (finePointer && cores >= 8) || (cores >= 4 && memory >= 4) }
}
