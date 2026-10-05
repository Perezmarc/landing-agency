/* The <head> of every public page: title, description, canonical, social card
   and structured data, assembled in one place.

   WHY ONE PLACE: a page's title is written three times if you let it be — in
   <title>, in og:title and in the WebPage node — and the three drift the first
   time somebody edits one. Here they are one string used three times.

   Copy lives in @forge/i18n under `seo.<key>`, not here: a title is
   user-facing text, so it belongs where every other user-facing string is, and
   the parity tests then cover it like anything else. */

import forge from '@forge/manifest'
import { useTranslations, OG_LOCALE, HTML_LANG } from '@forge/i18n'
import { alternates, routePath } from './routes.js'
import {
  graph, organizationSchema, websiteSchema, webPageSchema, faqSchema, articleSchema, OG_IMAGE, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT,
} from './schema.js'

/**
 * Everything a page's <head> needs.
 *
 * @param {string} key      a key from the route table
 * @param {string} locale
 * @param {object} [extra]  { faqs } — nodes only some pages carry
 */
export function pageMeta(key, locale, { faqs = null } = {}) {
  const t = useTranslations(locale)
  const path = routePath(key, locale) ?? '/'
  const url = forge.absoluteUrl(path)

  // Only the product NAME is interpolated. The rest of a title is copy, and
  // copy lives in the catalogs — interpolating the manifest's (English)
  // tagline is how the Spanish homepage ended up with the English title.
  const title = t(`seo.${key}.title`, { name: forge.brand.name })
  const description = t(`seo.${key}.description`, { name: forge.brand.name })

  const nodes = [
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ url, title, description }),
  ]
  // FAQ markup for questions a visitor cannot see on the page is a search
  // policy violation, so the caller passes the SAME list the page renders.
  if (faqs?.length) nodes.push(faqSchema(faqs))

  return {
    title,
    description,
    canonical: url,
    lang: HTML_LANG[locale] ?? locale,
    ogLocale: OG_LOCALE[locale] ?? locale,
    image: OG_IMAGE,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    imageAlt: `${forge.brand.name} — ${forge.brand.tagline}`,
    alternates: alternates(key),
    robots: 'index, follow',
    jsonLd: graph(...nodes),
  }
}

/** The same, for one article. Its copy comes from the file, not from a key. */
export function articleMeta(post, locale, { locales = [locale] } = {}) {
  const url = forge.absoluteUrl(post.path)

  return {
    title: `${post.title} — ${forge.brand.name}`,
    description: post.excerpt ?? forge.brand.description,
    canonical: url,
    lang: HTML_LANG[locale] ?? locale,
    ogLocale: OG_LOCALE[locale] ?? locale,
    image: post.image ? forge.absoluteUrl(post.image) : OG_IMAGE,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    imageAlt: post.title,
    alternates: locales.length > 1 ? post.alternates ?? [] : [],
    robots: 'index, follow',
    type: 'article',
    jsonLd: graph(
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ url, title: post.title, description: post.excerpt ?? '' }),
      articleSchema({
        url,
        title: post.title,
        description: post.excerpt ?? '',
        published: post.published,
        updated: post.updated,
        author: post.author,
      }),
    ),
  }
}

/** A page a crawler must not index: the 404. */
export function noindexMeta(title, description, locale) {
  return {
    title,
    description,
    canonical: null,
    lang: HTML_LANG[locale] ?? locale,
    ogLocale: OG_LOCALE[locale] ?? locale,
    image: OG_IMAGE,
    imageWidth: OG_IMAGE_WIDTH,
    imageHeight: OG_IMAGE_HEIGHT,
    imageAlt: forge.brand.name,
    alternates: [],
    // A 404 that says "index, follow" is a soft-404 waiting to be indexed.
    robots: 'noindex, follow',
    jsonLd: null,
  }
}
