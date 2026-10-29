/* ═══════════════════════════════════════════════════════════════════════════
   THE MANIFEST — everything that makes this site *this* business, in one file.

   Edit this and the whole repository follows: page titles, the footer, the
   canonical URLs, the legal pages, the sitemap, the OG image, every "Book a
   call" button and the web manifest all read from here. Nothing else
   hardcodes a name, a domain or an address.

   It is its own workspace package, so every file that reads it — an Astro
   page, a bare-Node build script, a test — writes the same line:

       import forge from '@forge/manifest'
       forge.brand.name
       forge.absoluteUrl('/contact')

   The shape is validated at import time by @forge/config, which throws with
   the offending path named. See packages/config/src/index.js for what each
   field accepts and what is derived from what.
   ═══════════════════════════════════════════════════════════════════════════ */

import { defineForge } from '@forge/config'

export default defineForge({
  brand: {
    /** Full name — page titles, OG tags, legal copy, the nav brand mark. */
    name: 'Levaia',
    /** Compact name for tight spots (tab titles, the web manifest). */
    shortName: 'Levaia',
    /** One line, under ~60 chars, English. The OG image subtitle. Page copy lives in @forge/i18n. */
    tagline: 'Custom AI agents for business operations',
    /** ~150 chars, English. The fallback meta description. */
    description:
      'We design, build and run custom AI agents that take over repetitive work in finance, revenue and operations, inside the tools you already use.',

    /* The bare host. Everything else about identity derives from it:
       url        → https://levaia.ai
       email      → hello@ / sales@ / privacy@ / legal@ levaia.ai
       bookingUrl → mailto:hello@levaia.ai
       Override any of them below. Calls are booked by email on purpose, so
       bookingUrl stays derived. */
    domain: 'levaia.ai',

    legal: {
      entity: 'Levaia',
      /** Where the entity is registered. Shown on the contact and legal pages once set. */
      jurisdiction: '',
      /** Year the business started — the footer renders "© {since}–{now}". */
      since: 2026,
    },

    /** Optional. Empty handles are skipped by the footer and the schema.org node. */
    social: { x: '', linkedin: '', github: '' },
  },

  /** Languages the site is published in. */
  locales: { default: 'en', published: ['en', 'es', 'it'] },
})
