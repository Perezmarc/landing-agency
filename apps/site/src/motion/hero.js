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
   state for the current scroll position and plays from there. */

import { next, settledState } from './hero-state.js'

const PORTRAIT = '(max-aspect-ratio: 1/1)'
const FADE_MS = 400      // BEFORE fading back in; the poster-only crash

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
  const ready = () => v.classList.add('is-ready')
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(ready)
  else v.addEventListener('loadeddata', ready, { once: true })
  return v
}

/** @param {HTMLElement} hero @param {{ motion: boolean, media: boolean }} tier */
export function initHero(hero, tier) {
  const data = JSON.parse(hero.dataset.media)
  const media = hero.querySelector('.mk-hero-media')
  const beforeLayer = hero.querySelector('[data-hero-before]')
  const portrait = matchMedia(PORTRAIT)
  const pinned = () => window.innerHeight * 0.5

  let state = location.hash ? 'after' : settledState(window.scrollY)
  let videos = null, timers = [], visible = true

  const setState = (s) => { state = s; hero.dataset.heroState = s }
  const later = (fn, delay) => timers.push(setTimeout(fn, delay))
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
    play(state === 'after' ? videos.after : videos.before)
  }
  function play(v) {
    v?.play().catch(() => {
      v.remove()
      if (videos) for (const k of Object.keys(videos)) if (videos[k] === v) videos[k] = null
    })
  }
  function pauseAll() { if (videos) Object.values(videos).forEach(v => v?.pause()) }
  const canCrash = () => videos?.transition?.classList.contains('is-ready')

  /* ── the crash, and the way back ── */
  function crash() {
    clearTimers()
    if (canCrash()) {
      const t = videos.transition
      t.currentTime = 0
      hero.classList.add('is-transitioning')
      play(t)
      videos.before?.pause()
      videos.after?.pause()
      const ms = (t.duration || data.duration) * 1000
      // The AFTER loop starts just before the transition ends, under it.
      later(() => { if (videos.after) { videos.after.currentTime = 0; play(videos.after) } }, Math.max(0, ms - 250))
      later(finishCrash, ms + 500)      // in case `ended` never fires
    } else {
      // No clip: the BEFORE poster fades away (marketing.css).
      later(() => apply(next(state, { type: 'done' })), FADE_MS)
    }
  }
  function finishCrash() {
    if (state !== 'crashing') return
    hero.classList.remove('is-transitioning')
    videos?.transition?.pause()
    apply(next(state, { type: 'done' }))
  }
  function back() {
    clearTimers()
    hero.classList.remove('is-transitioning')
    videos?.transition?.pause()
    if (videos?.before) { videos.before.currentTime = 0; play(videos.before) }
    later(() => { videos?.after?.pause(); apply(next(state, { type: 'done' })) }, FADE_MS)
  }
  function resync() {
    clearTimers()
    hero.classList.remove('is-transitioning')
    setState(settledState(window.scrollY))
    pauseAll()
    if (visible) play(state === 'after' ? videos?.after : videos?.before)
  }
  function apply({ state: s, effect }) {
    if (effect === 'crash') { setState(s); crash() }
    else if (effect === 'reverse') { setState(s); back() }
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
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
    if (!visible) pauseAll()
    else if (state === 'after') play(videos?.after)
    else if (state === 'before') play(videos?.before)
  }).observe(hero)
  document.addEventListener('visibilitychange', () => document.hidden ? pauseAll() : resync())
  addEventListener('pagehide', pauseAll)
  addEventListener('pageshow', (e) => { if (e.persisted) resync() })

  // Media only after the page has loaded, so it never competes with the poster.
  if (document.readyState === 'complete') loadVideos(); else addEventListener('load', loadVideos, { once: true })
}
