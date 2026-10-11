import { describe, it, expect } from 'vitest'
import { boxWidth, railX, boxRect } from './geometry.js'

describe('the stream geometry', () => {
  it('covers the stage with the 16:9 box on landscape and the 9:16 box on portrait', () => {
    expect(boxWidth(1440, 900)).toBeCloseTo(1600)
    expect(boxWidth(1920, 900)).toBe(1920)
    expect(boxWidth(375, 812)).toBeCloseTo(456.75)
    expect(boxWidth(768, 1024)).toBe(768)
  })

  it('puts the rail at the hero exit: ≈68% on desktop, a right gutter on portrait', () => {
    expect(railX(1440, 900, 0.6713) / 1440).toBeCloseTo(0.69, 2)
    expect(railX(1280, 800, 0.6713) / 1280).toBeCloseTo(0.69, 2)
    const phone = railX(375, 812, 0.7604) / 375
    expect(phone).toBeGreaterThan(0.76)
    expect(phone).toBeLessThan(0.9)
    expect(railX(768, 1024, 0.7604) / 768).toBeCloseTo(0.7604, 3)
  })

  it('maps a rect inside the media box to stage pixels', () => {
    expect(boxRect(1440, 900, { x: 0.5, y: 0.5, w: 0.1, h: 0.1 })).toEqual({ x: 720, y: 450, w: 160, h: 90 })
  })
})
