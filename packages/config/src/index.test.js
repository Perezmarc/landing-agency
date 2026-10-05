import { describe, it, expect } from 'vitest'
import { defineForge, ForgeConfigError } from './index.js'

/* The smallest manifest that validates. Every test starts from this and
   changes one thing, so a failure names exactly what broke. */
const minimal = () => ({ brand: { name: 'Stark Industries', domain: 'stark.com' } })

describe('brand', () => {
  it('derives the origin and the four standard addresses from the domain', () => {
    const forge = defineForge(minimal())

    expect(forge.brand.url).toBe('https://stark.com')
    expect(forge.brand.email).toEqual({
      support: 'hello@stark.com',
      sales:   'sales@stark.com',
      privacy: 'privacy@stark.com',
      legal:   'legal@stark.com',
    })
  })

  it('lets any derived value be overridden explicitly', () => {
    const forge = defineForge({
      brand: {
        name: 'Stark Industries',
        domain: 'stark.com',
        email: { support: 'tony@stark.com' },
      },
    })

    expect(forge.brand.email.support).toBe('tony@stark.com')
    // Overriding one address leaves the other three derived.
    expect(forge.brand.email.legal).toBe('legal@stark.com')
  })

  it('books calls by email until a scheduling link is set', () => {
    expect(defineForge(minimal()).brand.bookingUrl).toBe('mailto:hello@stark.com')

    const forge = defineForge({
      brand: { name: 'Stark Industries', domain: 'stark.com', bookingUrl: 'https://cal.com/stark' },
    })
    expect(forge.brand.bookingUrl).toBe('https://cal.com/stark')
  })

  it('follows an overridden support address into the booking link', () => {
    const forge = defineForge({
      brand: { name: 'Stark Industries', domain: 'stark.com', email: { support: 'pepper@stark.com' } },
    })
    expect(forge.brand.bookingUrl).toBe('mailto:pepper@stark.com')
  })

  it('falls back to the full name for the short name and the legal entity', () => {
    const forge = defineForge(minimal())
    expect(forge.brand.shortName).toBe('Stark Industries')
    expect(forge.brand.legal.entity).toBe('Stark Industries')
  })

  it.each([
    ['https://stark.com', 'with no scheme'],
    ['stark.com/',        'must not end with a slash'],
  ])('rejects the domain %s', (domain) => {
    expect(() => defineForge({ brand: { name: 'Stark Industries', domain } }))
      .toThrow(ForgeConfigError)
  })

  it('rejects a url with a trailing slash, which would double every path separator', () => {
    expect(() => defineForge({
      brand: { name: 'Stark Industries', domain: 'stark.com', url: 'https://stark.com/' },
    })).toThrow(/brand\.url/)
  })

  it.each(['name', 'domain'])('requires brand.%s', (field) => {
    const manifest = minimal()
    delete manifest.brand[field]
    expect(() => defineForge(manifest)).toThrow(new RegExp(`brand\\.${field}`))
  })
})

describe('absoluteUrl', () => {
  const forge = defineForge(minimal())

  it('builds URLs on the site origin', () => {
    expect(forge.absoluteUrl('/contact')).toBe('https://stark.com/contact')
  })

  it('tolerates a path written without its leading slash', () => {
    expect(forge.absoluteUrl('contact')).toBe('https://stark.com/contact')
  })

  it('returns the bare origin for the root path', () => {
    expect(forge.absoluteUrl()).toBe('https://stark.com/')
    expect(forge.absoluteUrl('/')).toBe('https://stark.com/')
  })
})

describe('locales', () => {
  it('defaults to a single English locale', () => {
    expect(defineForge(minimal()).locales).toEqual({ default: 'en', published: ['en'] })
  })

  it('defaults to the first published locale when no default is named', () => {
    const forge = defineForge({ ...minimal(), locales: { published: ['es', 'en'] } })
    expect(forge.locales.default).toBe('es')
  })

  it('rejects a default that is not published, which would render an unreachable language', () => {
    expect(() => defineForge({ ...minimal(), locales: { default: 'fr', published: ['en'] } }))
      .toThrow(/locales\.default/)
  })

  it('rejects a duplicated locale, which would emit two hreflang tags for one language', () => {
    expect(() => defineForge({ ...minimal(), locales: { published: ['en', 'en'] } }))
      .toThrow(/locales\.published/)
  })

  it('rejects an empty published list', () => {
    expect(() => defineForge({ ...minimal(), locales: { published: [] } }))
      .toThrow(/locales\.published/)
  })
})

describe('the returned manifest', () => {
  it('is frozen, so no importer can reconfigure the product for everyone else', () => {
    const forge = defineForge({ ...minimal(), locales: { published: ['en', 'it'] } })

    expect(Object.isFrozen(forge)).toBe(true)
    expect(Object.isFrozen(forge.brand)).toBe(true)
    expect(Object.isFrozen(forge.brand.email)).toBe(true)
    expect(Object.isFrozen(forge.locales.published)).toBe(true)
  })

  it('rejects anything that is not an object', () => {
    expect(() => defineForge(null)).toThrow(ForgeConfigError)
    expect(() => defineForge([])).toThrow(ForgeConfigError)
  })

  it('names the offending path in every error message', () => {
    try {
      defineForge({ ...minimal(), locales: { default: 'fr', published: ['en'] } })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ForgeConfigError)
      expect(error.path).toBe('locales.default')
      expect(error.message).toContain('forge.config.js:')
    }
  })
})
