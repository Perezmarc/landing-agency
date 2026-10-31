import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import forge from '@forge/manifest'

/* The site: landing, blog, contact, legal.
 *
 * STATIC, ON THE APEX DOMAIN. Every page is HTML on disk before a request
 * arrives and nothing talks to a backend. Every page ships one script, the
 * footer's pool (src/motion/footer.js), and the landing page adds its motion
 * module (src/motion/), each as a hashed file under /_astro/.
 *
 * Two build settings keep that script and the CSS out of the HTML, because
 * the Content-Security-Policy (vercel.json) allows `script-src 'self'` only:
 *   - assetsInlineLimit: 0 — Vite would otherwise inline a small script (or
 *     asset) into the page, and an inline script is blocked by the CSP.
 *   - inlineStylesheets: 'never' — styles stay in hashed files too.
 * Don't enable Astro's experimental CSP: its hashes switch off
 * 'unsafe-inline', which the custom-property style attributes need.
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
    inlineStylesheets: 'never',
  },
  vite: { build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
})
