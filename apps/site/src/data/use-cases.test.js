import { describe, it, expect } from 'vitest'
import { CATALOGS, DEFAULT_LOCALE } from '@forge/i18n'
import { GLYPHS, GLYPH_NAMES } from './use-case-glyphs.js'

/* The use cases page (pages-content/UseCases.astro) is all catalog copy. Each
   use case carries a short "how the agent does it", an illustration of the
   method, so these tests guard that the copy and the page stay in step:
   every step's tag is a real bucket, every language sorts each step into
   the same bucket, the anchors work as URL fragments, and no result-shaped
   number sneaks in. */

const SOURCE = CATALOGS[DEFAULT_LOCALE]

/** Every string inside a value, however deeply nested. */
const strings = value => typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []

/** Each use case's steps as bucket positions (1 Delete … 4 A person), by industry. */
const positions = catalog => {
  const titles = catalog.home.buckets.map(b => b.title)
  return catalog.useCases.industries.map(industry =>
    industry.cases.map(item => item.how.map(s => titles.indexOf(s.bucket) + 1)))
}

describe('the use cases', () => {
  it('tag every step with one of the four buckets, in every language', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      positions(catalog).flat(2).forEach(position => expect(position, locale).toBeGreaterThan(0))
    }
  })

  it('sort every step into the same bucket in every language', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      expect(positions(catalog), locale).toEqual(positions(SOURCE))
    }
  })

  it('leave a decision with a person in every use case, and delete a step somewhere in every industry', () => {
    positions(SOURCE).forEach((industry, i) => {
      industry.forEach((steps, j) => expect(steps, `industry ${i} case ${j}`).toContain(4))
      expect(industry.flat(), `industry ${i}`).toContain(1)
    })
  })

  it('give each industry a unique anchor that works as a URL fragment', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const anchors = catalog.useCases.industries.map(industry => industry.anchor)
      anchors.forEach(anchor => expect(anchor, locale).toMatch(/^[a-z]+(-[a-z]+)*$/))
      expect(new Set(anchors).size, locale).toBe(anchors.length)
    }
  })

  it('carry no figures in any language', () => {
    // The steps are illustrations, not results. A number here would read as a claim.
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const text of strings(catalog.useCases)) {
        expect(text, `${locale}: "${text}"`).not.toMatch(/\d/)
      }
    }
  })

  it('list eight industries, the number of side menu timelines the stylesheet names', () => {
    expect(SOURCE.useCases.industries).toHaveLength(8)
  })

  it('give every industry four use cases, the number of panel timelines the stylesheet names', () => {
    SOURCE.useCases.industries.forEach(industry => expect(industry.cases).toHaveLength(4))
  })

  it('give every use case a glyph the page knows how to draw', () => {
    const shape = SOURCE.useCases.industries.map(industry => industry.cases.length)
    expect(GLYPHS.map(list => list.length)).toEqual(shape)
    GLYPHS.flat().forEach(name => expect(GLYPH_NAMES).toContain(name))
  })
})
