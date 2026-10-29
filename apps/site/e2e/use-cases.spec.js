import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The use cases page reads one thing at a time: each industry's name stays
   pinned while its use cases scroll past, and scroll-driven CSS dims what is
   away from the middle of the screen, draws each use case's glyph, fills a
   rail beside each worked example and draws a reading bar. It ships no script, so the only things
   to hold are that the effect follows the scroll where it applies, and that
   with reduced motion the page is the plain, fully visible HTML. */

const PATH = routePath('useCases', forge.locales.default)

const opacity = locator => locator.evaluate(el => Number(getComputedStyle(el).opacity))

/** Scroll, at once (the page scrolls smoothly), by `top` pixels. */
const scrollBy = (page, top) => page.evaluate(top => window.scrollBy({ top, behavior: 'instant' }), top)

/** Scroll so the element's middle is at the middle of the viewport. */
const centre = locator => locator.evaluate(el => {
  const box = el.getBoundingClientRect()
  window.scrollBy({ top: box.top + box.height / 2 - innerHeight / 2, behavior: 'instant' })
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

  test("an industry's name stays pinned while its use cases scroll past", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').first()
    const head = industry.locator('.mk-uc-head')
    const top = () => head.evaluate(el => Math.round(el.getBoundingClientRect().top))
    await centre(industry.locator('.mk-uc-cases > li').last())
    const before = await top()
    await scrollBy(page, 200)
    expect(await top()).toBe(before)
  })

  test("a use case's glyph draws itself as the use case comes into focus", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(PATH)
    const item = page.locator('.mk-uc-industry').nth(1).locator('.mk-uc-cases > li').first()
    const stroke = item.locator('.mk-uc-glyph .g-draw').first()
    const offset = () => stroke.evaluate(el => Number.parseFloat(getComputedStyle(el).strokeDashoffset))
    // Below the fold it is not drawn yet; in the middle of the screen it is.
    expect(await offset()).toBeGreaterThan(0.9)
    await centre(item)
    await expect.poll(offset).toBeLessThan(0.05)
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

  test('everything is fully visible and drawn, and there is no reading bar', async ({ page }) => {
    await page.goto(PATH)
    const all = await page.locator('.mk-uc-focus').evaluateAll(els => els.map(el => Number(getComputedStyle(el).opacity)))
    expect(all.length).toBeGreaterThan(0)
    all.forEach(value => expect(value).toBe(1))
    const offsets = await page.locator('.mk-uc-glyph .g-draw').evaluateAll(els => els.map(el => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    offsets.forEach(value => expect(value).toBe(0))
    await expect(page.locator('.mk-uc-progress')).toBeHidden()
  })
})
