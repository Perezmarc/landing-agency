# Agency

The website of an AI consulting agency that designs, builds and runs custom AI
agents for finance, revenue and operations teams. A landing page, a blog,
contact and legal pages, in English, Spanish and Italian.

It was generated from the factory and stripped down to the marketing site: a
static Astro build with no backend, no JavaScript on the landing page, and
every string in a translated catalog.

> **Placeholder identity.** The name (`Agency`) and domain (`example.com`) are
> placeholders. Set the real ones in `packages/manifest/forge.config.js` and
> every page, address and canonical URL follows.

---

## Quick start

```bash
npm install
npm run dev        # → http://localhost:4321
npm test           # unit tests, every workspace
npm run test:e2e   # builds the site and runs Playwright against it
npm run build      # static output in apps/site/dist
```

## Where things live

| What | Where |
|---|---|
| Name, domain, legal entity, socials, languages, booking link | `packages/manifest/forge.config.js` |
| Every line of copy, in each language | `packages/i18n/src/locales/{en,es,it}.json` |
| Pages and their translated URLs | `packages/seo/src/routes.js` |
| The landing page markup | `apps/site/src/pages-content/Home.astro` |
| Blog articles (markdown, one folder per language) | `apps/site/src/content/blog/<locale>/` — see `docs/BLOG.md` |
| Privacy and terms (templates, not legal advice) | `apps/site/src/content/legal/<locale>/` |
| Colours, radii, fonts | `packages/tokens/tokens.css` |
| Buttons, inputs and the rest of the UI kit | `packages/ui` |
| Marketing positioning the copy is written from | `.agents/product-marketing.md` |

## Writing copy

`.claude/skills/` vendors Corey Haines'
[marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT).
Every skill reads `.agents/product-marketing.md` first, so keep that file
current. Start with `product-marketing`, then `copywriting` and `cro`;
`copy-editing` for a polish pass, `content-strategy` and `seo-audit` for the
blog.

English is written first; `es.json` and `it.json` follow in the same change or
`locales.test.js` fails.

## Before launch

1. **Identity** — real `name`, `domain` and `legal` in the manifest.
2. **Booking link** — set `brand.bookingUrl` to a Cal.com/Calendly link. Until
   then every "Book a call" button opens an email to `hello@<domain>`.
3. **Claims** — the FAQ quotes 6–12 weeks to production and about 20 hours of
   client time. Confirm them or change them.
4. **Legal** — fill the bracketed values in the privacy and terms templates and
   have them reviewed.
5. **Brand** — palette in `tokens.css`, mark in `apps/site/public/favicon.svg`
   and the nav, then `npm run gen:og` for the social card.
6. **Proof** — add case studies, logos or testimonials only once they are real.

## Deploying

`.github/workflows/deploy.yml` deploys `apps/site` to Vercel on every push to
`main`, after the full test suite passes. It is **off** until you set the
repository variable `DEPLOY_ENABLED` to `true` and add the secrets
`VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (set the Vercel
project's Root Directory to `apps/site`). Pull requests run `ci.yml` either way.
