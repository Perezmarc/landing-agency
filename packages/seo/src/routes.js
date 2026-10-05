/* ═══════════════════════════════════════════════════════════════════════════
   THE ROUTE TABLE — where every public page lives, in every language.

   One data structure feeds the marketing site's pages, its sitemap, its
   hreflang pairs, its navigation, its footer and its end-to-end deep-link
   suite. They cannot disagree about where a page lives, because there is
   nothing for them to disagree with.

   That is worth more than it looks. The failure it prevents is not a broken
   link — it is a sitemap advertising /contact while the nav links /talk and
   the hreflang tag points at a third URL, each correct in the file it lives
   in, and the page quietly uncrawlable.

   ── PATHS ARE TRANSLATED, NOT PREFIXED ─────────────────────────────────────
   `/es/contacto`, not `/es/contact`. A Spanish speaker searching for one
   does not search in English, and the URL is part of what a search engine
   reads. The cost is this table; the alternative is a site that is bilingual
   everywhere except its addresses.

   ── THE DEFAULT LOCALE IS UNPREFIXED ───────────────────────────────────────
   `/contact`, never `/en/contact`. Both resolving would be two URLs for one
   page — a duplicate-content problem you then have to canonicalise your way
   out of, for no benefit.

   ADDING A PAGE: add an entry here, add the matching .astro file under
   src/pages/ for each locale, and add it to the e2e suite. routes.test.js
   fails if an entry has no path for a published locale, and the site's own
   test fails if a path here has no file behind it.

   Plain data. No imports beyond the manifest, because bare-Node scripts and
   the Astro build both read it.
   ═══════════════════════════════════════════════════════════════════════════ */

import forge from '@forge/manifest'

/**
 * Every public page, keyed. `paths` holds one entry per locale the page is
 * published in — a page may be published in fewer locales than the site, and
 * the alternates below simply won't offer what isn't there.
 *
 * `changefreq` and `priority` are sitemap hints. They are advisory and search
 * engines mostly ignore them; they are here because writing them once beside
 * the route is free, and guessing them in a separate sitemap file is not.
 */
export const ROUTES = [
  { key: 'home',    paths: { en: '/',         es: '/es',             it: '/it' },            priority: 1.0, changefreq: 'weekly' },
  { key: 'blog',    paths: { en: '/blog',     es: '/es/blog',        it: '/it/blog' },       priority: 0.8, changefreq: 'weekly' },
  { key: 'contact', paths: { en: '/contact',  es: '/es/contacto',    it: '/it/contatti' },   priority: 0.5, changefreq: 'yearly' },
  { key: 'privacy', paths: { en: '/privacy',  es: '/es/privacidad',  it: '/it/privacy' },    priority: 0.3, changefreq: 'yearly' },
  { key: 'terms',   paths: { en: '/terms',    es: '/es/terminos',    it: '/it/termini' },    priority: 0.3, changefreq: 'yearly' },
]

/** The blog article route, which is dynamic and so is not in the table above. */
export const BLOG_BASE = { en: '/blog', es: '/es/blog', it: '/it/blog' }

const BY_KEY = new Map(ROUTES.map(route => [route.key, route]))

/** The path of a page in a locale, or null if it isn't published there. */
export function routePath(key, locale) {
  return BY_KEY.get(key)?.paths[locale] ?? null
}

/** The path of an article, by slug. */
export function blogPostPath(slug, locale) {
  const base = BLOG_BASE[locale] ?? BLOG_BASE[forge.locales.default]
  return `${base}/${slug}`
}

/** Which page a path belongs to, or null. Used to mark the nav's current item. */
export function routeKeyFromPath(path) {
  const clean = path.replace(/\/+$/, '') || '/'
  for (const route of ROUTES) {
    for (const localePath of Object.values(route.paths)) {
      if ((localePath.replace(/\/+$/, '') || '/') === clean) return route.key
    }
  }
  return null
}

/** The locales a page is actually published in. */
export function localesFor(key) {
  return Object.keys(BY_KEY.get(key)?.paths ?? {})
}

/**
 * The hreflang alternates for a page: one per locale it is published in, plus
 * `x-default`.
 *
 * WHY x-default POINTS AT THE DEFAULT LOCALE: it tells a search engine where
 * to send someone whose language matches none of the alternates. Omitting it
 * leaves that choice to a guess; pointing it at a language-picker page nobody
 * has built is worse.
 *
 * Every href is ABSOLUTE. A relative hreflang is ignored outright — one of
 * those rules that fails silently and shows up months later as a page indexed
 * in one language only.
 */
export function alternates(key) {
  const route = BY_KEY.get(key)
  if (!route) return []

  const list = Object.entries(route.paths).map(([locale, path]) => ({
    locale,
    path,
    href: forge.absoluteUrl(path),
  }))

  const fallback = route.paths[forge.locales.default]
  if (fallback) {
    list.push({ locale: 'x-default', path: fallback, href: forge.absoluteUrl(fallback) })
  }
  return list
}

/** The same, for an article that exists in more than one language. */
export function blogAlternates(slug, locales) {
  const list = locales.map(locale => ({
    locale,
    path: blogPostPath(slug, locale),
    href: forge.absoluteUrl(blogPostPath(slug, locale)),
  }))
  if (locales.includes(forge.locales.default)) {
    const path = blogPostPath(slug, forge.locales.default)
    list.push({ locale: 'x-default', path, href: forge.absoluteUrl(path) })
  }
  return list
}

/** Every (key, locale, path) the site publishes — what the sitemap walks. */
export function publishedRoutes() {
  return ROUTES.flatMap(route =>
    forge.locales.published
      .filter(locale => route.paths[locale])
      .map(locale => ({
        key: route.key,
        locale,
        path: route.paths[locale],
        priority: route.priority,
        changefreq: route.changefreq,
      })),
  )
}
