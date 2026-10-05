/* ═══════════════════════════════════════════════════════════════════════════
   @forge/config — the manifest schema.

   `forge.config.js` calls `defineForge()` with one object describing the
   business: its brand and the languages the site is published in. Everything
   else in the repo reads that object and nothing else. No page, script or
   workflow hardcodes a name, a domain or an email address.

   This module is the schema for it. It validates at import time and throws
   with the offending path named, because a manifest typo that fails silently
   surfaces later as a wrong canonical URL in production, which is expensive
   to notice.

   ── PLAIN JAVASCRIPT, ON PURPOSE ───────────────────────────────────────────
   The manifest is imported by Node build scripts under bare `node` (the OG
   image), by Astro at build time and by the test runner. A .ts file would need a loader in at least two of those, so
   this is ESM JavaScript with JSDoc types and a .d.ts beside it. The type
   checker still sees the shape; nothing needs compiling to read it.

   ── HOW THE APPS IMPORT IT ─────────────────────────────────────────────────
   Not by relative path — `../../../../forge.config.js` from a page is exactly
   the kind of line that breaks when a file moves. The manifest is its own
   workspace package, so every file everywhere writes the same line:

       import forge from '@forge/manifest'

   One spelling in components, in bare-Node build scripts, in the test runner
   and in the Astro pages.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Thrown when the manifest is malformed. Names the path that's wrong. */
export class ForgeConfigError extends Error {
  constructor(path, problem) {
    super(`forge.config.js: ${path} ${problem}`)
    this.name = 'ForgeConfigError'
    this.path = path
  }
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ForgeConfigError(path, 'is required and must be a non-empty string')
  }
  return value
}

/* Deep-freeze so a page can't mutate the manifest for everyone else in the
   bundle. Shared mutable global config is how one component's "just normalise
   the domain here" becomes another component's missing trailing slash. */
function deepFreeze(value) {
  if (isPlainObject(value) || Array.isArray(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/* ── brand ─────────────────────────────────────────────────────────────────
   `domain` is the only identity input that is truly required. The origin, the
   four standard addresses and the booking link are DERIVED from it, so
   renaming the business means changing one line rather than remembering the
   places an old domain is still spelled out. Every derived value can still be
   overridden explicitly. */
function normaliseBrand(brand) {
  if (!isPlainObject(brand)) throw new ForgeConfigError('brand', 'is required')

  const name   = requireString(brand.name, 'brand.name')
  const domain = requireString(brand.domain, 'brand.domain')

  if (/^https?:\/\//.test(domain)) {
    throw new ForgeConfigError('brand.domain', 'must be a bare host like "example.com", with no scheme')
  }
  if (domain.endsWith('/')) {
    throw new ForgeConfigError('brand.domain', 'must not end with a slash')
  }

  const email = {
    support: `hello@${domain}`,
    sales:   `sales@${domain}`,
    privacy: `privacy@${domain}`,
    legal:   `legal@${domain}`,
    ...(brand.email ?? {}),
  }

  const url = brand.url ?? `https://${domain}`
  if (url.endsWith('/')) {
    throw new ForgeConfigError('brand.url', 'must not end with a trailing slash')
  }

  return {
    name,
    shortName:   brand.shortName ?? name,
    tagline:     brand.tagline ?? '',
    description: brand.description ?? '',
    domain,
    url,
    email,
    // Where every "Book a call" button goes. A plain mailto until a scheduling
    // link (Cal.com, Calendly…) exists; then it is this one field.
    bookingUrl:  brand.bookingUrl ?? `mailto:${email.support}`,
    legal: {
      entity:       brand.legal?.entity ?? name,
      jurisdiction: brand.legal?.jurisdiction ?? '',
      since:        brand.legal?.since ?? new Date().getUTCFullYear(),
    },
    social: { x: '', linkedin: '', github: '', ...(brand.social ?? {}) },
  }
}

/* ── locales ───────────────────────────────────────────────────────────────
   A single-language product still declares one, so that every surface that
   needs a language tag (the <html lang>, the hreflang pairs, the OG locale)
   reads it from the same place instead of assuming English. */
function normaliseLocales(locales) {
  const published = locales?.published ?? ['en']
  const fallback  = locales?.default ?? published[0]

  if (!Array.isArray(published) || published.length === 0) {
    throw new ForgeConfigError('locales.published', 'must list at least one locale')
  }
  if (new Set(published).size !== published.length) {
    throw new ForgeConfigError('locales.published', 'lists the same locale twice')
  }
  if (!published.includes(fallback)) {
    throw new ForgeConfigError('locales.default', `is "${fallback}", which is not in locales.published`)
  }
  return { default: fallback, published: [...published] }
}

/**
 * Validate a manifest and return it frozen, with the derived values filled in.
 *
 * @param {object} manifest the literal written in forge.config.js
 * @returns {object} the frozen manifest every surface reads
 */
export function defineForge(manifest) {
  if (!isPlainObject(manifest)) {
    throw new ForgeConfigError('the export', 'must be an object')
  }

  const brand = normaliseBrand(manifest.brand)

  return deepFreeze({
    brand,
    locales:  normaliseLocales(manifest.locales),

    /**
     * Absolute URL on the site's origin: absoluteUrl('/contact').
     * Canonical tags, OG tags, the sitemap and the legal pages all build their
     * links with this rather than concatenating a base by hand.
     */
    absoluteUrl(path = '/') {
      return `${brand.url}${path.startsWith('/') ? path : `/${path}`}`
    },
  })
}

export default defineForge
