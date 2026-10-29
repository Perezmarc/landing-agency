import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The use cases page reads one thing at a time: scroll-driven CSS dims what
   is away from the middle of the screen, fills a rail beside each worked
   example and draws a reading bar. It ships no script, so the only things
   to hold are that the effect follows the scroll where it applies, and that
   with reduced motion the page is the plain, fully visible HTML. */

const PATH = routePath('useCases', forge.locales.default)

const opacity = locator => locator.evaluate(el => Number(getComputedStyle(el).opacity))

/** Scroll so the element's middle is at the middle of the viewport. */
const centre = locator => locator.evaluate(el => {
  const box = el.getBoundingClientRect()
  window.scrollBy(0, box.top + box.height / 2 - innerHeight / 2)
})

test.describe('with motion', () => {
  test('a step is dim below the middle of the screen and full strength at it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(PATH)
    const step = page.locator('.mk-uc-steps > li').nth(4)
    // The second industry's example is far below the fold at the top of the page.
    const later = page.locator('.mk-uc-industry').nth(1).locator('.mk-uc-steps > li').first()
    await centre(step)
    await expect.poll(() => opacity(step)).toBeGreaterThan(0.95)
    await expect.poll(() => opacity(later)).toBeLessThan(0.5)
  })

  test('the reading bar grows as the page scrolls', async ({ page }) => {
    await page.goto(PATH)
    const bar = page.locator('.mk-uc-progress')
    // At the top it has no width yet, so it is laid out but not "visible".
    expect(await bar.evaluate(el => getComputedStyle(el).display)).toBe('block')
    const width = () => bar.evaluate(el => el.getBoundingClientRect().width)
    const top = await width()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2))
    await expect.poll(width).toBeGreaterThan(top)
  })
})

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('everything is fully visible and there is no reading bar', async ({ page }) => {
    await page.goto(PATH)
    const all = await page.locator('.mk-uc-focus').evaluateAll(els => els.map(el => Number(getComputedStyle(el).opacity)))
    expect(all.length).toBeGreaterThan(0)
    all.forEach(value => expect(value).toBe(1))
    await expect(page.locator('.mk-uc-progress')).toBeHidden()
  })
})
