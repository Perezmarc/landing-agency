import { describe, it, expect } from 'vitest'
import forge from '@forge/manifest'
import { sitemapXml, robotsTxt } from './sitemap.js'
import { publishedRoutes, blogPostPath } from './routes.js'

/* One article per published language, read from the manifest rather than
   hardcoded, so adding or dropping a language changes the fixture with it. */
const DEFAULT = forge.locales.default
const OTHERS = forge.locales.published.filter(locale => locale !== DEFAULT)

const POSTS = [
  { slug: 'hello-world', locale: DEFAULT, updated: '2026-03-04T10:00:00Z', locales: [DEFAULT] },
  ...OTHERS.map(locale => ({ slug: `hola-mundo-${locale}`, locale, locales: [locale] })),
]

describe('sitemapXml', () => {
  const xml = sitemapXml(POSTS)

  it('is well-formed enough to declare its namespaces', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('lists every published route', () => {
    publishedRoutes().forEach((route) => {
      expect(xml, route.path).toContain(`<loc>${forge.absoluteUrl(route.path)}</loc>`)
    })
  })

  it('lists every article', () => {
    POSTS.forEach((post) => {
      const loc = forge.absoluteUrl(blogPostPath(post.slug, post.locale))
      expect(xml, post.slug).toContain(`<loc>${loc}</loc>`)
    })
  })

  it('emits hreflang alternates for pages that have them', () => {
    expect(xml).toContain('rel="alternate" hreflang="x-default"')
    OTHERS.forEach((locale) => {
      expect(xml, locale).toContain(`rel="alternate" hreflang="${locale}"`)
    })
  })

  it('emits no alternates for an article that exists in one language', () => {
    // Declaring an alternate that 404s is worse than declaring none.
    const articleBlock = xml.slice(xml.indexOf('/blog/hello-world'))
    const untilNextUrl = articleBlock.slice(0, articleBlock.indexOf('</url>'))
    expect(untilNextUrl).not.toContain('hreflang')
  })

  it('writes lastmod as a bare date, from a string or a Date alike', () => {
    expect(xml).toContain('<lastmod>2026-03-04</lastmod>')
    const fromDate = sitemapXml([
      { slug: 'dated', locale: DEFAULT, updated: new Date('2026-03-05T10:00:00Z') },
    ])
    expect(fromDate).toContain('<lastmod>2026-03-05</lastmod>')
  })

  it('omits lastmod rather than inventing one', () => {
    const noDate = sitemapXml([{ slug: 'undated', locale: DEFAULT }])
    const block = noDate.slice(noDate.indexOf('/blog/undated'))
    expect(block.slice(0, block.indexOf('</url>'))).not.toContain('<lastmod>')
  })

  it('ignores an unparseable date instead of writing "Invalid Date"', () => {
    const bad = sitemapXml([{ slug: 'whenever', locale: DEFAULT, updated: 'soon' }])
    expect(bad).not.toContain('Invalid')
    expect(bad).not.toContain('NaN')
  })

  it('escapes XML metacharacters in a slug', () => {
    const nasty = sitemapXml([{ slug: 'a&b<c>', locale: DEFAULT }])
    expect(nasty).toContain('&amp;')
    expect(nasty).not.toMatch(/<loc>[^<]*<c>/)
  })

  it('works with no articles at all', () => {
    expect(sitemapXml()).toContain('<urlset')
    expect(sitemapXml([])).toContain(forge.absoluteUrl('/'))
  })

  it('emits priority with one decimal, as the schema wants', () => {
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('<priority>0.3</priority>')
  })
})

describe('robotsTxt', () => {
  it('points at the absolute sitemap URL', () => {
    expect(robotsTxt()).toContain(`Sitemap: ${forge.absoluteUrl('/sitemap.xml')}`)
  })

  it('allows crawling of the marketing site', () => {
    expect(robotsTxt()).toContain('Allow: /')
  })
})
