import { describe, it, expect } from 'vitest'
import forge from '@forge/manifest'
import { routePath } from '@forge/seo/routes'
import { preferredLocale, localeOfPath, readCookie, decide, COOKIE } from './locale.js'

const published = forge.locales.published
const fallback = forge.locales.default
const SITE = { published, fallback, homePath: locale => routePath('home', locale) }
// A second published language, asked of the manifest rather than hardcoded.
const SECOND = published.find(l => l !== fallback)
const ORIGIN = 'https://site.test'
const at = (path, rest = {}) => ({ url: ORIGIN + path, ...rest })

describe('preferredLocale', () => {
  it('takes the first published language in the order of preference', () => {
    expect(preferredLocale('fr-FR,fr;q=0.9,it;q=0.8,es;q=0.7', ['en', 'es', 'it'])).toBe('it')
  })
  it('ranks by q-value, not by position', () => {
    expect(preferredLocale('en;q=0.3,es;q=0.9', ['en', 'es'])).toBe('es')
  })
  it('keeps the sent order for equal weights', () => {
    expect(preferredLocale('it,es', ['en', 'es', 'it'])).toBe('it')
  })
  it('ignores regions, case, wildcards and q=0', () => {
    expect(preferredLocale('ES-es', ['en', 'es'])).toBe('es')
    expect(preferredLocale('*,es;q=0', ['en', 'es'])).toBeNull()
  })
  it('returns null when nothing matches or there is no header', () => {
    expect(preferredLocale('de-DE,fr', ['en', 'es'])).toBeNull()
    expect(preferredLocale(null, ['en', 'es'])).toBeNull()
    expect(preferredLocale('', ['en', 'es'])).toBeNull()
  })
})

describe('localeOfPath', () => {
  it('reads a prefixed path, and falls back for anything else', () => {
    const site = { published: ['en', 'es'], fallback: 'en' }
    expect(localeOfPath('/es/contacto', site)).toBe('es')
    expect(localeOfPath('/es', site)).toBe('es')
    expect(localeOfPath('/contact', site)).toBe('en')
    expect(localeOfPath('/', site)).toBe('en')
    expect(localeOfPath('/en/contact', site)).toBe('en')
    expect(localeOfPath('/de/kontakt', site)).toBe('en')
  })
})

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    expect(readCookie('a=1; lang=es; b=2', 'lang')).toBe('es')
    expect(readCookie('a=1', 'lang')).toBeNull()
    expect(readCookie(null, 'lang')).toBeNull()
  })
})

describe.skipIf(!SECOND)('decide', () => {
  const home = routePath('home', fallback)
  const secondHome = routePath('home', SECOND)

  it('sends a first visit to the home page in the browser\'s language, and remembers it', () => {
    const out = decide(at(home, { acceptLanguage: `${SECOND}-XX,${fallback};q=0.5` }), SITE)
    expect(out.redirect).toBe(secondHome)
    expect(out.setCookie).toMatch(new RegExp(`^${COOKIE}=${SECOND};`))
  })

  it('keeps the query string on the redirect', () => {
    expect(decide(at(`${home}?utm_source=x`, { acceptLanguage: SECOND }), SITE).redirect).toBe(`${secondHome}?utm_source=x`)
  })

  it('stays on the default home page for a default or unpublished language, or none at all', () => {
    for (const acceptLanguage of [fallback, 'xx-XX', null]) {
      const out = decide(at(home, { acceptLanguage }), SITE)
      expect(out.redirect).toBeNull()
      expect(out.setCookie).toMatch(new RegExp(`^${COOKIE}=${fallback};`))
    }
  })

  it('returns a visitor to the language they last read in, over the browser\'s', () => {
    expect(decide(at(home, { acceptLanguage: fallback, cookie: `${COOKIE}=${SECOND}` }), SITE).redirect).toBe(secondHome)
    const stay = decide(at(home, { acceptLanguage: SECOND, cookie: `${COOKIE}=${fallback}` }), SITE)
    expect(stay).toEqual({ redirect: null, setCookie: null })
  })

  it('never redirects a visitor who came to the home page from this site', () => {
    const out = decide(at(home, { acceptLanguage: SECOND, cookie: `${COOKIE}=${SECOND}`, referer: `${ORIGIN}${secondHome}` }), SITE)
    expect(out.redirect).toBeNull()
    expect(out.setCookie).toMatch(new RegExp(`^${COOKIE}=${fallback};`))
  })

  it('still picks for a visitor arriving from another site', () => {
    expect(decide(at(home, { acceptLanguage: SECOND, referer: 'https://www.google.com/' }), SITE).redirect).toBe(secondHome)
    expect(decide(at(home, { acceptLanguage: SECOND, referer: 'not a url' }), SITE).redirect).toBe(secondHome)
  })

  it('never redirects any other page, and remembers its language', () => {
    const other = routePath('contact', fallback)
    const out = decide(at(other, { acceptLanguage: SECOND }), SITE)
    expect(out).toEqual({ redirect: null, setCookie: expect.stringMatching(new RegExp(`^${COOKIE}=${fallback};`)) })
    expect(decide(at(routePath('contact', SECOND), { cookie: `${COOKIE}=${fallback}` }), SITE).setCookie).toMatch(new RegExp(`^${COOKIE}=${SECOND};`))
  })

  it('ignores a remembered language the site no longer publishes', () => {
    expect(decide(at(home, { acceptLanguage: SECOND, cookie: `${COOKIE}=xx` }), SITE).redirect).toBe(secondHome)
  })

  it('sets a year-long, site-wide, first-party cookie', () => {
    expect(decide(at(home, { acceptLanguage: SECOND }), SITE).setCookie).toBe(`${COOKIE}=${SECOND}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`)
  })
})
