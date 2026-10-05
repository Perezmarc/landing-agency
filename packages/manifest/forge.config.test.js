import { describe, it, expect } from 'vitest'
import forge from './forge.config.js'
import { LOCALES } from '@forge/i18n'

/* This site's own manifest, checked against the schema and against itself.
   @forge/config already tests the schema in the abstract; these are the
   assertions that only make sense about a REAL manifest.

   Importing the file is half the test: defineForge validates on import, so a
   malformed manifest fails here rather than three minutes later in a build. */

describe('the manifest', () => {
  it('loads and validates', () => {
    expect(forge.brand.name).toBeTruthy()
    expect(forge.brand.url).toBe(`https://${forge.brand.domain}`)
  })

  it('builds absolute links on the site origin', () => {
    expect(forge.absoluteUrl('/contact')).toBe(`${forge.brand.url}/contact`)
  })

  it('has somewhere for "Book a call" to go', () => {
    expect(forge.brand.bookingUrl).toMatch(/^(mailto:|https:\/\/)/)
  })

  it('publishes the default locale', () => {
    expect(forge.locales.published).toContain(forge.locales.default)
  })

  it('publishes only languages that have a string catalog', () => {
    // A published locale with no catalog renders every page in English under
    // a translated URL, which is worse than not publishing it.
    forge.locales.published.forEach(locale => expect(LOCALES).toContain(locale))
  })
})
