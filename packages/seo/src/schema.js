/* Schema.org structured data builders.

   WHY IT'S BAKED INTO THE HTML, not injected by React: the consumers that care
   — search crawlers, AI answer engines, rich-result parsers — read the raw
   HTTP response. Anything added by JavaScript after hydration is, at best, a
   second-pass maybe. So these builders run at BUILD time
   (scripts/prerender.mjs) and their output is written into each route's
   index.html.

   Consequence: plain JS only. No JSX, no browser globals, no import.meta.env —
   this module is imported by a bare Node script. */

import forge from '@forge/manifest'

export const SITE_ORIGIN = forge.brand.url
export const OG_IMAGE = forge.absoluteUrl('/og-image.png')
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

/* Stable @ids let the nodes reference each other instead of repeating
   themselves, which is what makes this a graph rather than a pile of objects. */
const ORG_ID = `${SITE_ORIGIN}/#organization`
const SITE_ID = `${SITE_ORIGIN}/#website`

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: forge.brand.name,
    url: SITE_ORIGIN,
    // Points at the favicon so the reference is never broken. Google prefers a
    // raster logo: once you have real artwork, add a square PNG to public/ and
    // point this at it with explicit width/height.
    logo: {
      '@type': 'ImageObject',
      url: forge.absoluteUrl('/favicon.svg'),
    },
    description: forge.brand.description,
    email: forge.brand.email.support,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: forge.brand.email.support,
      url: forge.absoluteUrl('/contact'),
      availableLanguage: 'English',
    },
  }
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_ORIGIN,
    name: forge.brand.name,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  }
}

export function webPageSchema({ url, title, description }) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: OG_IMAGE,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    },
  }
}

/** FAQPage. Only emit this for questions that are actually ON the page —
 *  Google treats invisible FAQ markup as a violation. */
export function faqSchema(faqs = []) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }
}

export function articleSchema({ url, title, description, published, updated, author }) {
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: title,
    description,
    url,
    inLanguage: 'en',
    ...(published ? { datePublished: published } : {}),
    ...(updated ? { dateModified: updated } : {}),
    author: author ? { '@type': 'Person', name: author } : { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** Wrap nodes in the @graph envelope that goes into the <script> tag. */
export function graph(...nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
}
