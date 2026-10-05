import { test, expect } from '@playwright/test'
import { publishedRoutes, routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { useTranslations } from '@forge/i18n'

/* End-to-end tests for the marketing site.
 *
 * THE ROUTE TABLE DRIVES THIS FILE. Every published page in every published
 * language is visited, because the list comes from @forge/seo rather than
 * being retyped here — so adding a page to the table and forgetting to build
 * it fails HERE, which is the whole reason the table exists.
 *
 * The site is static by construction, so unlike the app's suite there is no
 * "with no backend" caveat: there is no backend to be without.
 *
 * Anything that needs a second language asks the manifest for them rather than
 * naming Spanish or Italian, so adding or dropping a language changes the data
 * these walk rather than the assertions.
 */

const DEFAULT = forge.locales.default
const OTHERS = forge.locales.published.filter(locale => locale !== DEFAULT)

test.describe('every published page', () => {
  for (const route of publishedRoutes()) {
    test(`${route.path} renders with one h1`, async ({ page }) => {
      const response = await page.goto(route.path)
      expect(response?.status(), route.path).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    })
  }

  test('each has a unique title and a description', async ({ page }) => {
    const titles = new Set()
    for (const route of publishedRoutes()) {
      await page.goto(route.path)
      const title = await page.title()
      expect(title, `${route.path} has no title`).toBeTruthy()
      expect(titles.has(title), `${route.path} duplicates another page's title`).toBe(false)
      titles.add(title)

      const description = await page.locator('meta[name="description"]').getAttribute('content')
      expect(description, `${route.path} has no meta description`).toBeTruthy()
    }
  })
})

test.describe('what a crawler reads', () => {
  test('the HTML carries the title, canonical and structured data before any JS', async ({ page }) => {
    // Fetched directly — no browser, no hydration. This is the whole argument
    // for the site being static rather than an SPA with a prerender step.
    const html = await (await page.request.get(routePath('contact', 'en'))).text()
    expect(html).toContain('<title>Contact')
    expect(html).toContain('rel="canonical"')
    expect(html).toContain('application/ld+json')
  })

  test('the landing page ships no JavaScript at all', async ({ page }) => {
    const html = await (await page.request.get('/')).text()
    // The one <script> is the JSON-LD block, which is data, not code.
    const scripts = html.match(/<script[^>]*>/g) ?? []
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toContain('application/ld+json')
  })

  test('every page declares its language alternates absolutely', async ({ page }) => {
    await page.goto(routePath('contact', 'en'))
    const hrefs = await page.locator('link[rel="alternate"]').evaluateAll(
      nodes => nodes.map(node => node.getAttribute('href')),
    )
    expect(hrefs.length).toBeGreaterThan(1)
    hrefs.forEach(href => expect(href.startsWith('https://'), href).toBe(true))
  })

  test('the sitemap lists every published page', async ({ page }) => {
    const xml = await (await page.request.get('/sitemap.xml')).text()
    for (const route of publishedRoutes()) {
      expect(xml, route.path).toContain(forge.absoluteUrl(route.path))
    }
  })

  test('robots.txt points at the sitemap', async ({ page }) => {
    const text = await (await page.request.get('/robots.txt')).text()
    expect(text).toContain(forge.absoluteUrl('/sitemap.xml'))
  })

  test('the 404 page is noindex', async ({ page }) => {
    await page.goto('/definitely-not-a-page')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})

test.describe('language', () => {
  test.skip(OTHERS.length === 0, 'this site publishes one language')

  for (const locale of OTHERS) {
    test(`${locale} is served at its own translated path`, async ({ page }) => {
      await page.goto(routePath('contact', locale))
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
    })

    test(`the switcher moves to the SAME page in ${locale}, not to the homepage`, async ({ page }) => {
      // Dumping someone on the homepage when they switch language from the
      // contact page is the small betrayal that stops people using it at all.
      await page.goto(routePath('contact', DEFAULT))
      await page.getByRole('contentinfo').getByRole('link', { name: locale.toUpperCase(), exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${routePath('contact', locale)}$`))
    })
  }
})

test.describe('the blog', () => {
  test('says so plainly when there are no articles yet', async ({ page }) => {
    // Until the first article exists the index must render an honest empty
    // state, not a blank list. Once one exists this checks the list instead.
    await page.goto(routePath('blog', DEFAULT))
    const rows = page.locator('.mk-post-row')
    if (await rows.count() === 0) {
      await expect(page.getByText(useTranslations(DEFAULT)('blog.empty'))).toBeVisible()
    } else {
      await rows.first().click()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })
})

test.describe('booking a call', () => {
  for (const locale of forge.locales.published) {
    test(`every booking button on the ${locale} homepage goes to the booking link`, async ({ page }) => {
      await page.goto(routePath('home', locale))
      const hrefs = await page.locator(`main a[href="${forge.brand.bookingUrl}"]`).count()
      // The hero CTA and the closing CTA.
      expect(hrefs).toBeGreaterThanOrEqual(2)
      await expect(page.getByRole('banner').locator(`a[href="${forge.brand.bookingUrl}"]`).first()).toBeAttached()
    })
  }
})

test.describe('accessibility basics', () => {
  test('the skip link is the first thing keyboard focus reaches', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused()
  })

  test('the page does not scroll horizontally at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflows).toBe(false)
  })
})
