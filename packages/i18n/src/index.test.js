import { describe, it, expect, vi, afterEach } from 'vitest'
import { useTranslations, useList, localeFromPath, CATALOGS, DEFAULT_LOCALE, LOCALES } from './index.js'

afterEach(() => vi.restoreAllMocks())

/* A second language, whichever it is, so these tests read the catalogs rather
   than hardcoding one. What needs two languages is skipped if there is only
   one. */
const SECOND = LOCALES.find(locale => locale !== DEFAULT_LOCALE)

describe('useTranslations', () => {
  it('returns the string for a dotted key', () => {
    expect(useTranslations('en')('nav.contact')).toBe('Contact')
  })

  it('returns every published language its own string', () => {
    for (const locale of LOCALES) {
      const value = useTranslations(locale)('nav.contact')
      expect(typeof value, locale).toBe('string')
      expect(value.length, locale).toBeGreaterThan(0)
    }
  })

  it('interpolates {{placeholders}}', () => {
    const t = useTranslations('en')
    expect(t('footer.copyright', { years: '2026', entity: 'Stark Industries' }))
      .toBe('© 2026 Stark Industries')
  })

  it('leaves an unknown placeholder alone rather than printing "undefined"', () => {
    const t = useTranslations('en')
    expect(t('footer.copyright', { years: '2026' })).toContain('{{entity}}')
  })

  it.skipIf(!SECOND)('does not warn for a key the language actually has', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A page with one untranslated line is a smaller failure than a hole — but
    // a translated line must not be reported as one.
    expect(useTranslations(SECOND)('nav.contact')).toBe(CATALOGS[SECOND].nav.contact)
    expect(warn).not.toHaveBeenCalled()
  })

  it('returns the key itself when no catalog has it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(useTranslations('en')('nav.nonexistent')).toBe('nav.nonexistent')
    expect(warn).toHaveBeenCalled()
  })

  it('falls back to English for an unknown locale rather than throwing', () => {
    expect(useTranslations('kl')('nav.contact')).toBe('Contact')
  })

  it('does not return an object when a key names a branch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(useTranslations('en')('nav')).toBe('nav')
    expect(warn).toHaveBeenCalled()
  })
})

describe('useList', () => {
  it('returns array values', () => {
    const steps = useList('en')('home.steps')
    expect(steps.length).toBeGreaterThan(0)
    expect(steps[0]).toHaveProperty('title')
  })

  it('returns an empty array for a key that is not a list', () => {
    expect(useList('en')('nav.contact')).toEqual([])
    expect(useList('en')('nothing.here')).toEqual([])
  })
})

describe('localeFromPath', () => {
  it.skipIf(!SECOND)('reads a prefixed locale', () => {
    expect(localeFromPath(`/${SECOND}/contact`)).toBe(SECOND)
    expect(localeFromPath(`/${SECOND}`)).toBe(SECOND)
  })

  it('treats an unprefixed path as the default locale', () => {
    expect(localeFromPath('/contact')).toBe(DEFAULT_LOCALE)
    expect(localeFromPath('/')).toBe(DEFAULT_LOCALE)
    expect(localeFromPath()).toBe(DEFAULT_LOCALE)
  })

  it('does not treat /en/ as a locale prefix', () => {
    // The default locale is unprefixed on purpose: / and /en/ both resolving
    // would be two URLs for one page, and a duplicate-content problem you then
    // have to canonicalise your way out of.
    expect(localeFromPath('/en/contact')).toBe(DEFAULT_LOCALE)
  })

  it('is not fooled by a path segment that merely starts with a locale', () => {
    expect(localeFromPath('/essays')).toBe(DEFAULT_LOCALE)
    expect(localeFromPath('/espanol/contact')).toBe(DEFAULT_LOCALE)
  })
})

describe('the locale list', () => {
  it('includes the default', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE)
  })
})
