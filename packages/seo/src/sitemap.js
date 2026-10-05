/* The sitemap, built from the route table and the article list.

   WHY GENERATED AND NOT COMMITTED: a hand-maintained sitemap.xml is wrong
   within two releases, and nothing tells you — a crawler simply stops being
   told about the page you added. Generating it from the same table the pages
   are built from means the only way to have a page missing from the sitemap is
   to have no page.

   Every URL is absolute (the spec requires it) and every alternate is emitted
   as an xhtml:link, which is how a sitemap declares a page's other languages.
   Declaring them here as well as in each page's <head> is deliberate belt and
   braces: the two are read by different parts of the pipeline. */

import forge from '@forge/manifest'
import { publishedRoutes, alternates, blogPostPath, blogAlternates } from './routes.js'

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

/** An ISO date with no time part — what <lastmod> wants. */
function isoDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function urlEntry({ loc, lastmod, changefreq, priority, links = [] }) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`]
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`)
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority !== undefined) parts.push(`    <priority>${priority.toFixed(1)}</priority>`)
  links.forEach(({ locale, href }) => {
    parts.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}" />`)
  })
  return `  <url>\n${parts.join('\n')}\n  </url>`
}

/**
 * The whole sitemap.
 *
 * @param {Array<{slug: string, locale: string, updated?: string|Date, locales?: string[]}>} posts
 */
export function sitemapXml(posts = []) {
  const pages = publishedRoutes().map(route => urlEntry({
    loc: forge.absoluteUrl(route.path),
    changefreq: route.changefreq,
    priority: route.priority,
    links: alternates(route.key),
  }))

  const articles = posts.map(post => urlEntry({
    loc: forge.absoluteUrl(blogPostPath(post.slug, post.locale)),
    lastmod: isoDate(post.updated),
    changefreq: 'yearly',
    priority: 0.6,
    links: post.locales?.length > 1 ? blogAlternates(post.slug, post.locales) : [],
  }))

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...pages,
    ...articles,
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * robots.txt.
 *
 * The app origin is disallowed wholesale rather than left to each page's
 * noindex: there is nothing behind sign-in for a crawler, and a robots rule is
 * the cheaper way to say so than a meta tag on a page a crawler has to fetch
 * to read.
 */
export function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${forge.absoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n')
}
