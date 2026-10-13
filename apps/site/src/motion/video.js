/* The landing page's looping clips, shared by the hero and the calendar's
   water. Every clip is created here, never in the server HTML: muted,
   inline, hidden from assistive tech, AV1 first and H.264 for the rest. */

/** A muted inline <video> with both renditions. It gets `is-ready` once it
    presents a frame, so CSS shows it only then and a refused play() leaves
    whatever is under it. `sources.av1` is the WebM's codec string when it
    is not the default 8-bit one (the footer's pool is 10-bit). */
export function makeVideo(sources, className, loop = true) {
  const v = document.createElement('video')
  v.className = className
  Object.assign(v, { muted: true, loop, playsInline: true, disablePictureInPicture: true, disableRemotePlayback: true, preload: 'auto' })
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1
  for (const [type, src] of [[`video/webm; codecs="${sources.av1 ?? 'av01.0.05M.08'}"`, sources.webm], ['video/mp4', sources.mp4]]) {
    const s = document.createElement('source'); s.src = src; s.type = type; v.append(s)
  }
  onFrame(v, () => v.classList.add('is-ready'))
  return v
}

/** Call `fn` once `v` presents a frame (where there is no frame callback: once
    it has data and its clock moves, or it is paused on decoded data). */
export function onFrame(v, fn) {
  if ('requestVideoFrameCallback' in v) { v.requestVideoFrameCallback(() => fn()); return }
  const check = () => {
    if (v.readyState < 2 || (!v.paused && v.currentTime === 0)) return
    v.removeEventListener('timeupdate', check); v.removeEventListener('loadeddata', check); fn()
  }
  v.addEventListener('timeupdate', check); v.addEventListener('loadeddata', check)
}

/** play(), and `refused()` if the browser says no (Low Power Mode, a
    webview). An AbortError is not a refusal: a pause() cut a pending play()
    short, and the clip must stay for the next time it is needed. */
export function play(v, refused) {
  v.play().catch((e) => { if (e?.name !== 'AbortError') refused() })
}
