import { describe, it, expect } from 'vitest'
import { next, settledState, TRIGGER, REST } from './hero-state.js'

const scroll = (y, pinned = 450) => ({ type: 'scroll', y, pinned })

describe('the hero state machine', () => {
  it('boots into the state for the scroll position', () => {
    expect(settledState(0)).toBe('before')
    expect(settledState(-30)).toBe('before')
    expect(settledState(TRIGGER + 1)).toBe('after')
  })

  it('crashes once, on the first scroll past the trigger', () => {
    expect(next('before', scroll(TRIGGER))).toEqual({ state: 'before', effect: null })
    expect(next('before', scroll(TRIGGER + 1))).toEqual({ state: 'crashing', effect: 'crash' })
    expect(next('crashing', scroll(200))).toEqual({ state: 'crashing', effect: null })
    expect(next('crashing', { type: 'done' })).toEqual({ state: 'after', effect: null })
  })

  it('reassembles only back at the very top (hysteresis), clamping rubber-band scroll', () => {
    expect(next('after', scroll(REST + 1))).toEqual({ state: 'after', effect: null })
    expect(next('after', scroll(REST))).toEqual({ state: 'reassembling', effect: 'reverse' })
    expect(next('after', scroll(-60))).toEqual({ state: 'reassembling', effect: 'reverse' })
    expect(next('reassembling', { type: 'done' })).toEqual({ state: 'before', effect: null })
  })

  it('goes back mid-crash, and crashes again on a new trigger', () => {
    expect(next('crashing', scroll(0))).toEqual({ state: 'reassembling', effect: 'reverse' })
    expect(next('reassembling', scroll(100))).toEqual({ state: 'crashing', effect: 'crash' })
  })

  it('snaps straight to after, with no crash, when a jump skips the pinned stretch', () => {
    expect(next('before', scroll(2000))).toEqual({ state: 'after', effect: 'snap' })
    expect(next('before', { type: 'snap', y: 900 })).toEqual({ state: 'after', effect: 'snap' })
    expect(next('after', { type: 'snap', y: 0 })).toEqual({ state: 'before', effect: 'snap' })
    expect(next('after', { type: 'snap', y: 900 })).toEqual({ state: 'after', effect: null })
  })

  // Regression: a hash link scrolls through the trigger, then far past the
  // pin. The crash it started went on, off screen, for the whole 3.75 s clip
  // before the state reached after.
  it('ends a crash at once when the scroll leaves the pinned stretch', () => {
    expect(next('crashing', scroll(450))).toEqual({ state: 'crashing', effect: null })
    expect(next('crashing', scroll(451))).toEqual({ state: 'after', effect: 'snap' })
  })
})
