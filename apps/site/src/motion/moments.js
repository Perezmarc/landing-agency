/* The moments on the rail (the pebble, the last drops): short looping clips
   over their poster images. They load and play only when near the screen and
   pause when they leave it, so with the hero paused off screen no more than
   two clips ever decode at once. */

const MAX_PLAYING = 2
const playing = new Set()

function video(sources) {
  const v = document.createElement('video')
  Object.assign(v, { muted: true, loop: true, playsInline: true, disablePictureInPicture: true, preload: 'auto' })
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1
  for (const [type, src] of [['video/webm; codecs="av01.0.05M.08"', sources.webm], ['video/mp4', sources.mp4]]) {
    const s = document.createElement('source'); s.src = src; s.type = type; v.append(s)
  }
  const ready = () => v.classList.add('is-ready')
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(ready)
  else v.addEventListener('loadeddata', ready, { once: true })
  return v
}

export function initMoments(nodes) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const host = e.target
      if (e.isIntersecting) {
        if (playing.size >= MAX_PLAYING) continue
        host.video ??= host.appendChild(video(JSON.parse(host.dataset.moment)))
        host.video.play().then(() => playing.add(host.video)).catch(() => host.video.remove())
      } else if (host.video) {
        host.video.pause(); playing.delete(host.video)
      }
    }
  }, { rootMargin: '25% 0px' })
  nodes.forEach(n => io.observe(n))
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) playing.forEach(v => v.pause())
    else playing.forEach(v => v.play().catch(() => {}))
  })
}
