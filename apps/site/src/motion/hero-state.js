/* The hero's state machine. Pure: no DOM, no clock, so it is unit-tested.

     before ──scroll past TRIGGER──▶ crashing ──done──▶ after
       ▲                               │  ▲                │
       └──done── reassembling ◀──back to REST (≤ 4px)──────┘

   Scroll never scrubs anything: it only decides which way the one-shot
   runs. Going back mid-crash fades back to BEFORE (`reverse` from
   crashing); a new trigger crashes again from the start. Jumps that skip the
   pinned stretch (a fling, a hash link, a restored scroll position) snap
   straight to the end state with no crash. */

export const TRIGGER = 24
export const REST = 4

/** The state to show, with no animation, for a scroll position. */
export function settledState(y) {
  return Math.max(0, y) > TRIGGER ? 'after' : 'before'
}

/**
 * @param {'before'|'crashing'|'after'|'reassembling'} state
 * @param {{ type: 'scroll', y: number, pinned: number } | { type: 'done' } | { type: 'snap', y: number }} event
 *   pinned — how far the stage stays pinned (the hero's height less the
 *   stage's, 1.5 screens); a scroll that is already past it skipped the
 *   moment, so it snaps.
 * @returns {{ state: string, effect: null | 'crash' | 'reverse' | 'snap' }}
 */
export function next(state, event) {
  if (event.type === 'snap') {
    const target = settledState(event.y)
    return { state: target, effect: target === state ? null : 'snap' }
  }
  if (event.type === 'done') {
    if (state === 'crashing') return { state: 'after', effect: null }
    if (state === 'reassembling') return { state: 'before', effect: null }
    return { state, effect: null }
  }
  // iOS rubber-banding reports negative positions: clamp.
  const y = Math.max(0, event.y)
  if (state === 'before' || state === 'reassembling') {
    if (y > event.pinned) return { state: 'after', effect: 'snap' }
    if (y > TRIGGER) return { state: 'crashing', effect: 'crash' }
    return { state, effect: null }
  }
  // crashing or after: go back only at the very top (hysteresis).
  if (y <= REST) return { state: 'reassembling', effect: 'reverse' }
  return { state, effect: null }
}
