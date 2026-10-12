import { describe, it, expect } from 'vitest'
import { invert } from './flip.js'

describe('FLIP invert', () => {
  it('maps the last box back onto the first', () => {
    const first = { left: 100, top: 40, width: 300, height: 60 }
    const last = { left: 420, top: 40, width: 40, height: 60 }
    expect(invert(first, last)).toEqual({ dx: -320, dy: 0, sx: 7.5, sy: 1 })
  })
  it('is the identity when nothing moved, and safe on an empty box', () => {
    const box = { left: 5, top: 5, width: 10, height: 10 }
    expect(invert(box, box)).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1 })
    expect(invert(box, { left: 5, top: 5, width: 0, height: 0 })).toMatchObject({ sx: 1, sy: 1 })
  })
})
