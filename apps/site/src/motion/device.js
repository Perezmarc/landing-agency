/* This device's tier (tier.js), from what the browser reports. Shared by the
   two entries, index.js (the home page's motion) and footer.js (every page's
   pool), so they always agree on what this device gets. */

import { selectTier } from './tier.js'

export function deviceTier() {
  const conn = navigator.connection || {}
  return selectTier({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(conn.saveData),
    effectiveType: conn.effectiveType,
    memory: navigator.deviceMemory,
  })
}
