/* How much motion this device gets. Pure, so it is unit-tested; index.js
   gathers the inputs from the browser.

   reduced motion  → no burst, no videos, no rail/reveal/calendar animation
   Save-Data, 2g   → motion, but posters only: no media requests, no particles
   no WebGL2       → videos, no particles (the wipe still runs)
   fine pointer + 8 cores → 8k particles, DPR cap 2
   4+ cores, 4+ GB → 3k particles, DPR cap 1.5
   anything weaker → posters only, no particles */

export function selectTier({ reducedMotion = false, saveData = false, effectiveType = '4g', webgl2 = false, finePointer = false, cores = 4, memory = 4 } = {}) {
  if (reducedMotion) return { motion: false, media: false, particles: 0, dpr: 1 }
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') return { motion: true, media: false, particles: 0, dpr: 1 }
  if (finePointer && cores >= 8) return { motion: true, media: true, particles: webgl2 ? 8000 : 0, dpr: 2 }
  if (cores >= 4 && memory >= 4) return { motion: true, media: true, particles: webgl2 ? 3000 : 0, dpr: 1.5 }
  return { motion: true, media: false, particles: 0, dpr: 1 }
}
