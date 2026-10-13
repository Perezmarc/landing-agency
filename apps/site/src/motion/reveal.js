/* Headings and copy blocks rise 12px and fade in the first time they enter
   view. Only blocks that start below the fold are touched, so nothing on the
   first screen ever blinks. */

export function initReveal(nodes) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('mk-reveal-in')
      e.target.classList.remove('mk-reveal-pending')
      io.unobserve(e.target)
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  for (const el of nodes) {
    if (el.getBoundingClientRect().top < window.innerHeight) continue
    el.classList.add('mk-reveal-pending')
    io.observe(el)
  }
}
