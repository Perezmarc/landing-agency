import { describe, it, expect } from 'vitest'
import { stripPlaces, landingRow, rimViews } from './water.js'

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

/* Where the page stream hands over to the rim's own (motion/water.js): the
   row over the rim where the incoming stream, widening as it meets the rim,
   is first as wide as the page stream. */
describe('landingRow', () => {
  const flare = [[30, 60], [34, 40], [40, 28], [60, 22], [100, 20], [120, 19]]
  it('is the highest row at least that wide', () => {
    expect(landingRow(flare, 21)).toBe(60)
    expect(landingRow(flare, 26)).toBe(40)
    expect(landingRow(flare, 51)).toBe(30)
  })
  it('is the top row for a stream no wider than the incoming one', () => {
    expect(landingRow(flare, 10)).toBe(120)
  })
  it('is the lowest row for a stream wider than the flare gets', () => {
    expect(landingRow(flare, 90)).toBe(30)
  })
  it('does not depend on the order it is given', () => {
    expect(landingRow([...flare].reverse(), 26)).toBe(40)
  })
})

/* The AFTER rim's views of its atlas: the top and bottom pieces are each
   three views of one band of rows (a stretch, the junction, a stretch). */
describe('rimViews', () => {
  const rim = {
    pieces: { tl: [6, 6, 74, 74], left: [6, 88, 42, 32], top: [88, 6, 404, 112], bottom: [88, 126, 464, 172] },
    stretch: 32, junction: { top: 340, bottom: 400 },
  }
  it('keeps the corners and sides as they are', () => {
    expect(rimViews(rim).tl).toEqual([6, 6, 74, 74])
    expect(rimViews(rim).left).toEqual([6, 88, 42, 32])
  })
  it('splits each edge piece into its stretches and its junction, side by side, on the same rows', () => {
    const v = rimViews(rim)
    expect(v['top-l']).toEqual([88, 6, 32, 112])
    expect(v['top-c']).toEqual([120, 6, 340, 112])
    expect(v['top-r']).toEqual([460, 6, 32, 112])
    expect(v['bottom-c']).toEqual([120, 126, 400, 172])
    expect(v['bottom-r'][0] + v['bottom-r'][2]).toBe(88 + 464)
    expect(Object.keys(v)).toHaveLength(8)
    expect(v.top).toBeUndefined()
  })
})
