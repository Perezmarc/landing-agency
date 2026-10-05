import { describe, it, expect } from 'vitest'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'
import {
  ROUTES, BLOG_BASE, routePath, blogPostPath, routeKeyFromPath,
  localesFor, alternates, blogAlternates, publishedRoutes,
} from './routes.js'

/* Written against the manifest's published locales, so dropping or adding a
   language changes the data these walk rather than the assertions. */
const DEFAULT = forge.locales.default
const OTHERS = forge.locales.published.filter(locale => locale !== DEFAULT)

describe('the route table', () => {
  it('has a path for every published locale of every page', () => {
    // A page missing a locale is not an error in itself — a page may be
    // published in fewer languages than the site. What would be an error is
    // NOT NOTICING, so this test states the current shape explicitly and fails
    // when a locale is added to the manifest and forgotten here.
    const gaps = ROUTES.flatMap(route =>
      forge.locales.published
        .filter(locale => !route.paths[locale])
        .map(locale => `${route.key}:${locale}`),
    )
    expect(gaps).toEqual([])
  })

  it('gives every page a unique path in every locale', () => {
    const paths = ROUTES.flatMap(route => Object.values(route.paths))
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('leaves the default locale unprefixed and prefixes the others', () => {
    ROUTES.forEach((route) => {
      expect(route.paths[DEFAULT].startsWith(`/${DEFAULT}`), route.key).toBe(false)
      OTHERS.forEach((locale) => {
        if (route.paths[locale]) {
          expect(route.paths[locale].startsWith(`/${locale}`), `${route.key}/${locale}`).toBe(true)
        }
      })
    })
  })

  it('translates the paths rather than prefixing the English one', () => {
    // /es/contact would be a Spanish page at an English address. The one
    // exception is a word that is the same in both languages (/it/privacy).
    expect(routePath('contact', 'es')).toBe('/es/contacto')
    expect(routePath('contact', 'it')).toBe('/it/contatti')
    expect(routePath('terms', 'it')).toBe('/it/termini')
  })

  it('has copy for every route key, in every catalog', () => {
    // The route table and the string catalogs are two files that have to agree
    // about which pages exist. This is what makes adding one without the other
    // fail at test time rather than render a page titled "seo.widgets.title".
    ROUTES.forEach((route) => {
      Object.keys(route.paths).forEach((locale) => {
        expect(CATALOGS[locale]?.seo?.[route.key]?.title, `${route.key}/${locale} title`).toBeTruthy()
        expect(CATALOGS[locale]?.seo?.[route.key]?.description, `${route.key}/${locale} description`).toBeTruthy()
      })
    })
  })

  it('starts every path with a slash and ends none with one', () => {
    ROUTES.flatMap(route => Object.values(route.paths)).forEach((path) => {
      expect(path.startsWith('/'), path).toBe(true)
      if (path !== '/') expect(path.endsWith('/'), path).toBe(false)
    })
  })
})

describe('routePath', () => {
  it('returns null for a page not published in that locale', () => {
    expect(routePath('contact', 'fr')).toBeNull()
  })

  it('returns null for an unknown key rather than throwing', () => {
    expect(routePath('nonexistent', 'en')).toBeNull()
  })
})

describe('routeKeyFromPath', () => {
  it('finds the page in every published language', () => {
    forge.locales.published.forEach((locale) => {
      const path = routePath('contact', locale)
      expect(routeKeyFromPath(path), path).toBe('contact')
    })
  })

  it('treats a trailing slash as the same page', () => {
    expect(routeKeyFromPath('/contact/')).toBe('contact')
    expect(routeKeyFromPath('/')).toBe('home')
  })

  it('returns null for a path in no table', () => {
    expect(routeKeyFromPath('/nope')).toBeNull()
  })
})

describe('blog paths', () => {
  it('nests articles under the localized blog base', () => {
    expect(blogPostPath('hello-world', DEFAULT)).toBe(`${BLOG_BASE[DEFAULT]}/hello-world`)
    OTHERS.forEach((locale) => {
      const path = blogPostPath('hola-mundo', locale)
      expect(path, locale).toBe(`${BLOG_BASE[locale]}/hola-mundo`)
      expect(path.startsWith(`/${locale}/`), locale).toBe(true)
    })
  })

  it('falls back to the default locale for an unknown one', () => {
    expect(blogPostPath('hello-world', 'fr')).toBe(`${BLOG_BASE.en}/hello-world`)
  })
})

describe('alternates', () => {
  it('emits one per published locale plus x-default', () => {
    const list = alternates('contact')
    expect(list.map(entry => entry.locale)).toEqual([...forge.locales.published, 'x-default'])
  })

  it('points x-default at the default locale', () => {
    const list = alternates('contact')
    const xDefault = list.find(entry => entry.locale === 'x-default')
    const english = list.find(entry => entry.locale === 'en')
    expect(xDefault.href).toBe(english.href)
  })

  it('emits absolute URLs', () => {
    // A relative hreflang is ignored outright — one of those rules that fails
    // silently and surfaces months later as a page indexed in one language.
    alternates('home').forEach((entry) => {
      expect(entry.href.startsWith('https://'), entry.href).toBe(true)
    })
  })

  it('returns nothing for an unknown key', () => {
    expect(alternates('nonexistent')).toEqual([])
  })

  it('offers article alternates only for the languages an article exists in', () => {
    const list = blogAlternates('hello-world', ['en'])
    expect(list.map(entry => entry.locale)).toEqual(['en', 'x-default'])
  })
})

describe('publishedRoutes', () => {
  it('yields one entry per page per published locale', () => {
    const entries = publishedRoutes()
    expect(entries.length).toBe(ROUTES.length * forge.locales.published.length)
  })

  it('carries the sitemap hints along', () => {
    const home = publishedRoutes().find(entry => entry.key === 'home' && entry.locale === 'en')
    expect(home.priority).toBe(1)
    expect(home.changefreq).toBe('weekly')
  })

  it('agrees with localesFor', () => {
    expect(localesFor('contact').sort()).toEqual([...forge.locales.published].sort())
  })
})
