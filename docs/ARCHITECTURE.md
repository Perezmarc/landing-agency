# Architecture

The decisions that shape this repository, and why. Short on purpose.

## A static site, in one Astro app

`apps/site` builds one HTML file per route per language, with the title,
canonical URL, `hreflang` pairs, Open Graph tags and structured data already in
it. The consumers that matter — crawlers, AI answer engines, rich-result
parsers — read the raw HTTP response, so nothing they need is injected later.
The landing page ships zero JavaScript; its only `<script>` is the JSON-LD
block, and the e2e suite fails if that changes.

There is no backend. "Book a call" is a link (`brand.bookingUrl` in the
manifest), which is why the site's Content-Security-Policy has no `connect-src`
beyond itself.

## Everything brand-shaped is in one manifest

`packages/manifest/forge.config.js` — name, domain, legal entity, socials and
published languages. Nothing else hardcodes a name, a domain or an address;
the origin, the four standard addresses and the booking link are derived from
`brand.domain` rather than written out.

`@forge/config` is the schema. It validates on import and throws with the
offending path named, so a malformed manifest fails at the first import rather
than as a wrong canonical URL in production.

## Copy lives in the catalogs, one per language

Every user-facing string is in `packages/i18n/src/locales/{en,es,it}.json`,
including page titles. `locales.test.js` fails a language that is missing a
key, has an extra one, drops a `{{placeholder}}`, changes a list's length or
leaves a long sentence in English. Legal pages and articles are prose, so they
are markdown files per language instead.

## One route table

`packages/seo/src/routes.js` lists every page and its translated path in each
language. The sitemap, the `hreflang` pairs, the nav, the footer, the language
switcher and the e2e suite all read it, so they cannot disagree.

## One token scope

Every design token is on `:root` in `@forge/tokens`. A parallel scoped set
means every component change has to be checked against "which scope did this
land in", and the answer is wrong often enough to matter.
