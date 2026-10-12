/* "A week, before and after": the AFTER calendar empties itself.

   The server HTML is already the final AFTER (the kept tasks only). On play,
   the eliminated tasks are copied from the BEFORE card into the same slots
   of the AFTER card, so for a moment it looks like BEFORE; then they fade and
   collapse out, top of the day first, and are removed. The kept tasks never
   move. Opacity and transform only.

     0–250 ms     the AFTER card shows the full week
     250–1400 ms  the eliminated tasks fade out, earliest slot first

   Plays the first time a panel comes into view, and when a tab is chosen.
   If the section is already on screen at boot it shows the final state: a
   final → first → final flash is worse than no animation. index.js only
   loads this on tiers with motion. */

const EASE = 'cubic-bezier(0.22, 0.61, 0.2, 1)'
const HOLD = 250, SWEEP = 700, DAY_STEP = 40, FADE = 420

function clear(card) {
  card.getAnimations({ subtree: true }).forEach(a => a.cancel())
  card.querySelectorAll('.mk-task--ghost').forEach(el => el.remove())
}

function play(panel) {
  const before = panel.querySelector('[data-cal="before"]'), after = panel.querySelector('[data-cal="after"]')
  if (!before || !after) return
  clear(after)
  const tracks = after.querySelectorAll('.mk-cal-track')
  const ghosts = []
  before.querySelectorAll('.mk-cal-track').forEach((track, day) => {
    for (const task of track.querySelectorAll('.mk-task[data-kept="false"]')) {
      const ghost = task.cloneNode(true)
      ghost.classList.add('mk-task--ghost')
      ghost.setAttribute('aria-hidden', 'true')
      tracks[day].append(ghost)
      ghosts.push({ ghost, day, start: parseFloat(task.style.getPropertyValue('--start')) || 0 })
    }
  })
  const last = Math.max(1, ...ghosts.map(g => g.start))
  const done = ghosts.map(({ ghost, day, start }) => ghost.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96, 0.6)' }],
    { duration: FADE, delay: HOLD + (start / last) * SWEEP + day * DAY_STEP, easing: EASE, fill: 'forwards' },
  ).finished)
  Promise.all(done).then(() => ghosts.forEach(({ ghost }) => ghost.remove()), () => {})
}

/** @param {HTMLElement} root the [data-day] wrapper */
export function initCalendar(root) {
  const tabs = root.querySelector('[data-ui-tabs]')
  const panelOf = value => root.querySelector(`.ui-tabs-panel[data-value="${value}"]`)
  // Browsers restore form state: read the checked radio, not the default.
  const checked = () => tabs.querySelector('.ui-tabs-input:checked')?.value

  const played = new Set()
  const top = root.getBoundingClientRect().top
  if (top < window.innerHeight && top > -root.offsetHeight) played.add(checked())

  const io = new IntersectionObserver(([e]) => {
    const value = checked()
    if (e.isIntersecting && !played.has(value)) { played.add(value); play(panelOf(value)) }
  }, { threshold: 0.25 })
  io.observe(root)

  tabs.addEventListener('change', () => {
    const value = checked(), panel = panelOf(value)
    played.add(value)
    if (panel) play(panel)
  })
}
