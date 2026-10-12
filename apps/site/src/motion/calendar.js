/* "A day, before and after": the AFTER calendar re-arranges itself from the
   BEFORE day. FLIP, with transforms and opacity only.

     0–350 ms    waiting blocks evaporate
     200–900 ms  repetitive blocks slide into the Agent lane and condense into
                 thin bars, 60 ms apart (only .blk-fill scales; labels fade)
     700–1100 ms decisions fade in

   Plays the first time a panel comes into view, and when a tab is chosen.
   If the section is already on screen at boot it shows the final state: a
   final → first → final flash is worse than no animation. Never touches an
   ancestor of the glass card (that would break its backdrop-filter). */

import { invert } from './flip.js'

const EASE = 'cubic-bezier(0.22, 0.61, 0.2, 1)'

function play(card) {
  card.getAnimations({ subtree: true }).forEach(a => a.cancel())
  const blocks = [...card.querySelectorAll('.blk')]
  const box = el => el.getBoundingClientRect()
  card.classList.add('is-first')
  const first = blocks.map(b => ({ b: box(b), f: box(b.querySelector('.blk-fill')) }))
  card.classList.remove('is-first')
  const last = blocks.map(b => ({ b: box(b), f: box(b.querySelector('.blk-fill')) }))

  let agent = 0
  blocks.forEach((el, i) => {
    const fill = el.querySelector('.blk-fill'), label = el.querySelector('.blk-label')
    if (el.classList.contains('blk--gone')) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: EASE, fill: 'backwards' })
      fill.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }], { duration: 350, easing: EASE })
    } else if (el.classList.contains('blk--agent')) {
      const delay = 200 + agent++ * 60
      const move = invert(first[i].b, last[i].b), size = invert(first[i].f, last[i].f)
      el.animate([{ transform: `translate(${move.dx}px, ${move.dy}px)` }, { transform: 'none' }], { duration: 700, delay, easing: EASE, fill: 'backwards' })
      fill.animate([{ transform: `scale(${size.sx}, ${size.sy})`, background: 'var(--blk-work)' }, { transform: 'none' }], { duration: 700, delay, easing: EASE, fill: 'backwards' })
      label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay, easing: EASE, fill: 'backwards' })
    } else if (el.classList.contains('blk--person')) {
      el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 700, easing: EASE, fill: 'backwards' })
    }
  })
}

/** @param {HTMLElement} root the [data-day] wrapper */
export function initCalendar(root) {
  const tabs = root.querySelector('[data-ui-tabs]')
  const cardOf = value => root.querySelector(`.ui-tabs-panel[data-value="${value}"] [data-day-after]`)
  // Browsers restore form state: read the checked radio, not the default.
  const checked = () => tabs.querySelector('.ui-tabs-input:checked')?.value

  const played = new Set()
  const top = root.getBoundingClientRect().top
  if (top < window.innerHeight && top > -root.offsetHeight) played.add(checked())

  const io = new IntersectionObserver(([e]) => {
    const value = checked()
    if (e.isIntersecting && !played.has(value)) { played.add(value); play(cardOf(value)) }
  }, { threshold: 0.35 })
  io.observe(root)

  tabs.addEventListener('change', () => {
    const value = checked(), card = cardOf(value)
    played.add(value)
    if (card) play(card)
  })
}
