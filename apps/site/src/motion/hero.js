/* The hero: constant rain, then the crash.

   Two independent clocks. TIME drives the water: the BEFORE and AFTER clips
   loop at normal speed forever, and the crash is a clip that plays once at
   normal speed. SCROLL only fires one trigger (hero-state.js) and scrolls the
   page; it never scrubs a video.

   Layers (marketing.css), bottom to top: the AFTER poster and loop, the
   transition clip (the raw rock shatters and the polished crystal is left with
   one stream), then the BEFORE layer (poster and loop). The transition's first
   frame is the BEFORE rock and its last is the AFTER crystal, so each swap is
   invisible. The server HTML is the AFTER state; this module boots into the
   state for the current scroll position and plays from there.

   iOS Safari ignores `preload` (above all on cellular) and decodes nothing
   until play() is called, so the crash never waits for a clip to be "ready":
   it calls play() and keeps the BEFORE layer up (`is-arming`) until the clip
   presents its first frame, then cuts. If that takes longer than START_MS, or
   play() is refused (Low Power Mode), the posters crossfade instead. Right
   after load, the media tier primes the crash clip (play, then pause at 0) so
   its first frames are decoded before the trigger. */

import { next, settledState } from './hero-state.js'

const PORTRAIT = '(max-aspect-ratio: 1/1)'
const FADE_MS = 400      // BEFORE fading back in; the poster-only crash
const START_MS = 700     // the crash clip must be presenting frames by then
const AFTER_LEAD_MS = 250 // the AFTER loop starts this long before the crash ends

function makeVideo(sources, className, loop = true) {
  const v = document.createElement('video')
  v.className = `mk-hero-layer mk-hero-video ${className}`
  Object.assign(v, { muted: true, loop, playsInline: true, disablePictureInPicture: true, disableRemotePlayback: true, preload: 'auto' })
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1
  for (const [type, src] of [['video/webm; codecs="av01.0.05M.08"', sources.webm], ['video/mp4', sources.mp4]]) {
    const s = document.createElement('source'); s.src = src; s.type = type; v.append(s)
  }
  // Show a clip only once a frame is decoded; if play() is refused (iOS Low
  // Power Mode, in-app webviews), the posters stay.
  onFrame(v, () => v.classList.add('is-ready'))
  return v
}

/** Call `fn` once `v` presents a frame (where there is no frame callback: once
    it has data and its clock moves, or it is paused on decoded data). */
function onFrame(v, fn) {
  if ('requestVideoFrameCallback' in v) { v.requestVideoFrameCallback(() => fn()); return }
  const check = () => {
    if (v.readyState < 2 || (!v.paused && v.currentTime === 0)) return
    v.removeEventListener('timeupdate', check); v.removeEventListener('loadeddata', check); fn()
  }
  v.addEventListener('timeupdate', check); v.addEventListener('loadeddata', check)
}

/** @param {HTMLElement} hero @param {{ motion: boolean, media: boolean }} tier */
export function initHero(hero, tier) {
  const data = JSON.parse(hero.dataset.media)
  const media = hero.querySelector('.mk-hero-media')
  const stage = hero.querySelector('.mk-hero-stage')
  const beforeLayer = hero.querySelector('[data-hero-before]')
  const portrait = matchMedia(PORTRAIT)
  // How far the stage stays pinned: the section's height less the stage's.
  const pinned = () => hero.offsetHeight - stage.offsetHeight

  let state = location.hash ? 'after' : settledState(window.scrollY)
  let videos = null, timers = [], visible = true, run = 0, priming = false

  const setState = (s) => { state = s; hero.dataset.heroState = s }
  const later = (fn, delay) => timers.push(setTimeout(fn, Math.max(0, delay)))
  const clearTimers = () => { timers.forEach(clearTimeout); timers = [] }
  setState(state)

  /* ── videos ── */
  function loadVideos() {
    if (!tier.media || videos) return
    const r = portrait.matches ? 'p' : 'l'
    videos = {
      before: makeVideo(data.before[r], 'mk-hero-video--before'),
      transition: makeVideo(data.transition[r], 'mk-hero-transition', false),
      after: makeVideo(data.after[r], 'mk-hero-video--after'),
    }
    beforeLayer.append(videos.before)
    media.querySelector('.mk-hero-poster--after').after(videos.after, videos.transition)
    videos.transition.addEventListener('ended', finishCrash)
    settle()
    if (state === 'before') prime(videos.transition)
  }
  function prime(t) {
    priming = true
    t.play().then(() => { if (priming) { priming = false; t.pause(); t.currentTime = 0 } }, () => { priming = false })
  }
  function play(v) {
    v?.play().catch(() => {
      v.remove()
      if (videos) for (const k of Object.keys(videos)) if (videos[k] === v) videos[k] = null
    })
  }
  function pauseAll() { if (videos) Object.values(videos).forEach(v => v?.pause()) }
  // At rest (before or after), play that state's loop and pause the other.
  // Every way into a rest state ends here, the poster-only crash included.
  function settle() {
    if (!videos || (state !== 'before' && state !== 'after')) return
    const keep = !visible ? null : state === 'after' ? videos.after : videos.before
    for (const v of [videos.before, videos.after]) if (v && v !== keep) v.pause()
    if (keep?.paused) play(keep)
  }

  /* ── the crash, and the way back ── */
  function crash() {
    clearTimers()
    const id = ++run, t = videos?.transition
    let outcome = null
    // No clip, or it does not start in time: the BEFORE poster fades away
    // (marketing.css) and the AFTER loop, if any, takes over.
    const posters = () => {
      if (outcome || id !== run) return
      outcome = 'posters'
      hero.classList.remove('is-arming')
      t?.pause()
      later(() => apply(next(state, { type: 'done' })), FADE_MS)
    }
    if (!t) return posters()
    const go = () => {
      if (outcome || id !== run || state !== 'crashing') return
      outcome = 'clip'
      clearTimers()
      t.classList.add('is-ready')
      hero.classList.remove('is-arming')
      hero.classList.add('is-transitioning')
      videos.before?.pause()
      videos.after?.pause()
      const ms = ((t.duration || data.duration) - t.currentTime) * 1000
      // The AFTER loop starts just before the transition ends, under it.
      later(() => { if (videos.after) { videos.after.currentTime = 0; play(videos.after) } }, ms - AFTER_LEAD_MS)
      later(finishCrash, ms + 500)      // in case `ended` never fires
    }
    priming = false
    hero.classList.add('is-arming')
    t.currentTime = 0
    onFrame(t, go)
    // Refused after its first frame showed: end on the AFTER poster at once.
    t.play().catch(() => { if (outcome === 'clip' && id === run) { clearTimers(); finishCrash() } else posters() })
    later(posters, START_MS)
  }
  function finishCrash() {
    if (state !== 'crashing') return
    hero.classList.remove('is-transitioning')
    videos?.transition?.pause()
    apply(next(state, { type: 'done' }))
  }
  function back() {
    clearTimers()
    run++
    hero.classList.remove('is-transitioning', 'is-arming')
    videos?.transition?.pause()
    if (videos?.before) { videos.before.currentTime = 0; play(videos.before) }
    later(() => apply(next(state, { type: 'done' })), FADE_MS)
  }
  function resync() {
    clearTimers()
    run++
    hero.classList.remove('is-transitioning', 'is-arming')
    setState(settledState(window.scrollY))
    videos?.transition?.pause()
    settle()
  }
  function apply({ state: s, effect }) {
    if (effect === 'crash') { setState(s); crash() }
    else if (effect === 'reverse') { setState(s); back() }
    else if (effect === 'snap') { setState(s); resync() }
    else if (s !== state) { setState(s); settle() }
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
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (!visible) pauseAll()
    else settle()
  }).observe(hero)
  document.addEventListener('visibilitychange', () => document.hidden ? pauseAll() : resync())
  addEventListener('pagehide', pauseAll)
  addEventListener('pageshow', (e) => { if (e.persisted) resync() })

  // Media only after the page has loaded, so it never competes with the poster.
  if (document.readyState === 'complete') loadVideos(); else addEventListener('load', loadVideos, { once: true })
}
