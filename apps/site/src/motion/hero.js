/* The hero: constant rain, then the crash.

   Two independent clocks. TIME drives the water: both clips loop at normal
   speed forever. SCROLL only fires one trigger (hero-state.js) and scrolls the
   page; it never scrubs a video.

   Layers (marketing.css): AFTER poster + AFTER video, then the BEFORE layer
   (poster + video) that a radial wipe opens from the crystal, then the burst
   canvas. The server HTML is the AFTER state; this module boots into the state
   for the current scroll position and animates from there. */

import { next, settledState } from './hero-state.js'
import { boxRect } from './geometry.js'

const PORTRAIT = '(max-aspect-ratio: 1/1)'
const ms = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0

function makeVideo(sources, className) {
  const v = document.createElement('video')
  v.className = `mk-hero-layer mk-hero-video ${className}`
  Object.assign(v, { muted: true, loop: true, playsInline: true, disablePictureInPicture: true, disableRemotePlayback: true, preload: 'auto' })
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1
  for (const [type, src] of [['video/webm; codecs="av01.0.05M.08"', sources.webm], ['video/mp4', sources.mp4]]) {
    const s = document.createElement('source'); s.src = src; s.type = type; v.append(s)
  }
  // Fade in only once a frame is on screen; if play() is refused (iOS Low
  // Power Mode, in-app webviews), stay on the posters.
  const ready = () => v.classList.add('is-ready')
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(ready)
  else v.addEventListener('loadeddata', ready, { once: true })
  return v
}

/** @param {HTMLElement} hero @param {{ media: boolean, particles: number, dpr: number }} tier */
export function initHero(hero, tier) {
  const data = JSON.parse(hero.dataset.media)
  const media = hero.querySelector('.mk-hero-media')
  const beforeLayer = hero.querySelector('[data-hero-before]')
  const rail = document.querySelector('[data-rail]')
  const portrait = matchMedia(PORTRAIT)
  const pinned = () => window.innerHeight * 0.5

  let state = settledState(window.scrollY)
  if (location.hash) state = 'after'
  let videos = null, burst = null, timers = []

  const setState = (s) => { state = s; hero.dataset.heroState = s }
  const later = (fn, delay) => timers.push(setTimeout(fn, delay))
  const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }
  // The pour only exists with motion; reduced motion keeps a still, visible stream.
  const dry = (on) => tier.motion && rail?.classList.toggle('is-dry', on)
  setState(state)
  dry(state !== 'after')

  /* ── videos ── */
  function loadVideos() {
    if (!tier.media || videos) return
    const r = portrait.matches ? 'p' : 'l'
    const before = makeVideo(data.before[r], 'mk-hero-video--before')
    const after = makeVideo(data.after[r], 'mk-hero-video--after')
    beforeLayer.append(before)
    media.querySelector('.mk-hero-poster--after').after(after)
    videos = { before, after }
    play(state === 'after' ? after : before)
  }
  function play(v) {
    v?.play().catch(() => { v.remove(); if (videos) videos[v === videos.before ? 'before' : 'after'] = null })
  }
  function pauseAll() { videos?.before?.pause(); videos?.after?.pause() }
  function resync() {
    clearTimers(); burst?.stop()
    hero.classList.remove('is-wiping'); rail?.classList.remove('is-pouring')
    setState(settledState(window.scrollY)); dry(state !== 'after')
    pauseAll()
    if (visible) play(state === 'after' ? videos?.after : videos?.before)
  }

  /* ── the burst (only on tiers with particles) ── */
  async function loadBurst() {
    if (!tier.particles || burst) return
    try {
      const { createBurst } = await import('./burst.js')
      const canvas = document.createElement('canvas')
      canvas.className = 'mk-hero-layer mk-hero-canvas'; canvas.hidden = true; canvas.setAttribute('aria-hidden', 'true')
      media.parentElement.insertBefore(canvas, media.nextSibling)
      burst = await createBurst({ canvas, image: data.crystal[portrait.matches ? 'p' : 'l'], particles: tier.particles, dpr: tier.dpr })
    } catch { burst = null }
  }
  function sizeBurst() {
    if (!burst) return
    const stage = hero.querySelector('.mk-hero-stage').getBoundingClientRect()
    const frac = data.burst[portrait.matches ? 'p' : 'l']
    burst.size(stage, boxRect(stage.width, stage.height, frac))
  }

  /* ── the crash, and its reversal ── */
  function crash() {
    clearTimers()
    videos?.before?.pause()
    sizeBurst()
    burst?.play(() => {})
    later(() => play(videos?.after), 120)
    hero.classList.add('is-wiping')
    later(() => { rail?.classList.add('is-pouring'); dry(false) }, 600)
    later(() => { rail?.classList.remove('is-pouring'); apply(next(state, { type: 'done' })) }, ms('--dur-burst'))
  }
  function reverse() {
    clearTimers()
    hero.classList.add('is-wiping')
    dry(true)
    sizeBurst()
    burst?.reverse(() => {})
    later(() => { play(videos?.before); videos?.after?.pause() }, 450)
    later(() => apply(next(state, { type: 'done' })), 900)
  }
  function apply({ state: s, effect }) {
    if (effect === 'crash') { setState(s); crash() }
    else if (effect === 'reverse') { setState(s); reverse() }
    else if (effect === 'snap') { setState(s); resync() }
    else if (s !== state) setState(s)
  }

  /* ── scroll: one trigger, read once per frame ── */
  let queued = false
  addEventListener('scroll', () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; apply(next(state, { type: 'scroll', y: window.scrollY, pinned: pinned() })) })
  }, { passive: true })
  addEventListener('hashchange', () => apply(next(state, { type: 'snap', y: window.scrollY })))

  /* ── lifecycle: pause when hidden or off screen, resync when back ── */
  let visible = true
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (!visible) pauseAll(); else play(state === 'after' || state === 'crashing' ? videos?.after : videos?.before)
  }).observe(hero)
  document.addEventListener('visibilitychange', () => document.hidden ? pauseAll() : resync())
  addEventListener('pagehide', pauseAll)
  addEventListener('pageshow', (e) => { if (e.persisted) resync() })
  addEventListener('resize', sizeBurst)

  // Media only after the page has loaded, so it never competes with the poster.
  const start = () => { loadVideos(); (window.requestIdleCallback || setTimeout)(loadBurst) }
  if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true })
}
