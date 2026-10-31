/* The footer's pool: the water that has fallen down the page, as one looping
   clip over the footer's poster.

   Every page has the poster, as the footer's CSS background (marketing.css),
   and every page loads this, through footer.js. Media tier only, and only once
   the footer is within half a screen of the viewport, after `load`: nothing
   is requested before. The clip is the poster's own source, cropped and
   placed the same way (object-fit and object-position match the background),
   and it starts on the poster's frame, so it covers it with no visible swap;
   a refused play() removes it and leaves the poster. It pauses off screen,
   in a hidden tab and on `pagehide`.

   Two renditions, like the poster: the full band, and its centre for phones.
   The stylesheet decides which the footer shows (`--pool-clip`, set beside
   the poster's own media query), so the clip always matches the poster
   under it; a resize across that query swaps the clip. */

import { makeVideo, play } from './video.js'

const NEAR = '50% 0px'   // create the clip half a screen before the footer

/** @param {HTMLElement} footer the footer, carrying data-pool */
export function initPool(footer) {
  const sources = JSON.parse(footer.dataset.pool)
  const which = () => getComputedStyle(footer).getPropertyValue('--pool-clip').trim()
  let clip = null, shown = null, near = false, onScreen = false

  function resume() {
    const v = clip
    if (v?.paused && onScreen && !document.hidden) play(v, () => { v.remove(); if (clip === v) clip = null })
  }
  function pause() { clip?.pause() }
  function place() {
    if (!near || which() === shown) return
    clip?.remove()
    shown = which()
    clip = makeVideo(sources[shown], 'mk-footer-pool')
    footer.prepend(clip)
    resume()
  }

  const nearby = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    nearby.disconnect()
    near = true
    place()
  }, { rootMargin: NEAR })
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting
    onScreen ? resume() : pause()
  }).observe(footer)
  addEventListener('resize', place)
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume())
  addEventListener('pagehide', pause)
  addEventListener('pageshow', (e) => { if (e.persisted) resume() })

  // After load, like the other clips, so it never competes with the page.
  const start = () => nearby.observe(footer)
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
