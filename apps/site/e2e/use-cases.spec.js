import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The use cases page reads one thing at a time. In two columns, each
   industry and its use cases stay pinned on the left while one "how the
   agent does it" panel per use case scrolls past on the right; scroll-driven
   CSS lights up the panel in the middle of the screen and its use case, and
   draws that use case's glyph. It ships no script, so the things to hold are
   that the effect follows the scroll where it applies, and that with
   reduced motion the page is the plain, fully visible HTML. */

const PATH = routePath('useCases', forge.locales.default)

const opacity = locator => locator.evaluate(el => Number(getComputedStyle(el).opacity))

/** Scroll, at once (the page scrolls smoothly), by `top` pixels. */
const scrollBy = (page, top) => page.evaluate(top => window.scrollBy({ top, behavior: 'instant' }), top)

/** Scroll so the element's middle is at the middle of the viewport. */
const centre = locator => locator.evaluate(el => {
  const box = el.getBoundingClientRect()
  window.scrollBy({ top: box.top + box.height / 2 - innerHeight / 2, behavior: 'instant' })
})

test.describe('with motion, in two columns', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the panel in the middle of the screen and its use case are lit, the next use case is dim', async ({ page }) => {
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').nth(1)
    const cases = industry.locator('.mk-uc-cases > li')
    const panel = industry.locator('.mk-uc-how').nth(1)
    await centre(panel)
    await expect.poll(() => opacity(panel)).toBeGreaterThan(0.95)
    await expect.poll(() => opacity(cases.nth(1))).toBeGreaterThan(0.95)
    await expect.poll(() => opacity(cases.nth(2))).toBeLessThan(0.5)
  })

  test("an industry's use cases stay pinned while its panels scroll past", async ({ page }) => {
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').first()
    const head = industry.locator('.mk-uc-head')
    const top = () => head.evaluate(el => Math.round(el.getBoundingClientRect().top))
    await centre(industry.locator('.mk-uc-how').nth(1))
    const before = await top()
    await scrollBy(page, 200)
    expect(await top()).toBe(before)
  })

  test("a use case's glyph draws itself as its panel reaches the middle of the screen", async ({ page }) => {
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').nth(1)
    // The second use case's glyph has strokes that draw in (not every glyph does).
    const stroke = industry.locator('.mk-uc-cases > li').nth(1).locator('.mk-uc-glyph .g-draw').first()
    const offset = () => stroke.evaluate(el => Number.parseFloat(getComputedStyle(el).strokeDashoffset))
    await centre(industry.locator('.mk-uc-how').first())
    await expect.poll(offset).toBeGreaterThan(0.9)
    await centre(industry.locator('.mk-uc-how').nth(1))
    await expect.poll(offset).toBeLessThan(0.05)
  })

  test('the reading bar grows as the page scrolls', async ({ page }) => {
    await page.goto(PATH)
    const bar = page.locator('.mk-uc-progress')
    // At the top it has no width yet, so it is laid out but not "visible".
    expect(await bar.evaluate(el => getComputedStyle(el).display)).toBe('block')
    const width = () => bar.evaluate(el => el.getBoundingClientRect().width)
    const top = await width()
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' }))
    await expect.poll(width).toBeGreaterThan(top)
  })
})

test.describe('with motion, in one column', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a panel is lit in the middle of the screen and dim below it', async ({ page }) => {
    await page.goto(PATH)
    const panels = page.locator('.mk-uc-industry').nth(1).locator('.mk-uc-how')
    await centre(panels.first())
    await expect.poll(() => opacity(panels.first())).toBeGreaterThan(0.95)
    await expect.poll(() => opacity(panels.nth(3))).toBeLessThan(0.5)
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
