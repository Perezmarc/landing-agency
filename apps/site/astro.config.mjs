import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import forge from '@forge/manifest'

/* The site: landing, blog, contact, legal.
 *
 * STATIC, ON THE APEX DOMAIN. It ships no application bundle, talks to no
 * backend, and every page is HTML on disk before a request arrives.
 *
 * `site` is read from the manifest, so canonical URLs, the sitemap and the
 * hreflang pairs all resolve against the same origin as everything else.
 *
 * i18n: the default locale is UNPREFIXED (`/contact`, never `/en/contact`).
 * Both resolving would be two URLs for one page. The paths themselves are
 * translated — see the route table in @forge/seo — so Astro's routing here is
 * only told which locales exist, not how to build the paths.
 */
export default defineConfig({
  site: forge.brand.url,
  integrations: [react()],
  i18n: {
    defaultLocale: forge.locales.default,
    locales: [...forge.locales.published],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    // A directory per route with an index.html inside, so a static host serves
    // /contact without a rewrite and the URL carries no extension.
    format: 'directory',
  },
  devToolbar: { enabled: false },
})
