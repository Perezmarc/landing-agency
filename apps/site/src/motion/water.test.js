import { describe, it, expect } from 'vitest'
import { stripPlaces } from './water.js'

/* The BEFORE card's splash strip is repeated along the card's top border
   (motion/water.js): as few copies as cover it, overlapping, cross-faded. */

/** Where each copy lands on a border `span` long: [left, right]. */
const spans = (span, copy) => {
  const { places } = stripPlaces(span, copy)
  return places.map(at => [at * (span - copy), at * (span - copy) + copy])
}

describe('stripPlaces', () => {
  it('uses one copy, centred, when a copy nearly spans the border', () => {
    expect(stripPlaces(300, 300)).toEqual({ places: [0.5], overlap: 0 })
    expect(stripPlaces(320, 300).places).toEqual([0.5])
    expect(stripPlaces(280, 300).places).toEqual([0.5])
  })

  it('covers the border end to end, every neighbour overlapping by at least 15%', () => {
    for (const span of [335, 562, 572, 681, 984, 1140]) {
      for (const copy of [287, 308, 369, 410]) {
        const s = spans(span, copy)
        if (s.length === 1) continue
        expect(s[0][0]).toBe(0)
        expect(s.at(-1)[1]).toBeCloseTo(span, 6)
        const { overlap } = stripPlaces(span, copy)
        expect(overlap, `${span}/${copy}`).toBeGreaterThanOrEqual(0.15 - 1e-9)
        for (let i = 1; i < s.length; i++) expect(s[i - 1][1] - s[i][0]).toBeCloseTo(overlap * copy, 6)
      }
    }
  })

  it('uses as few copies as that allows', () => {
    // Side by side at 1440 (a 572px card, 308px copies), stacked at 1024
    // (984px), one day on a phone (335px card, 287px copies).
    expect(stripPlaces(572, 308).places).toHaveLength(3)
    expect(stripPlaces(984, 308).places).toHaveLength(4)
    expect(stripPlaces(335, 287).places).toHaveLength(2)
    expect(stripPlaces(572, 410).places).toHaveLength(2)
  })

  it('never divides by a copy it has not measured', () => {
    expect(stripPlaces(572, 0).places).toEqual([0.5])
  })
})
