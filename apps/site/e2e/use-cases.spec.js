import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The use cases page reads one thing at a time. In two columns, each
   industry and its use cases stay pinned on the left and a pinned stage on
   the right swaps one "how the agent does it" card per use case as the
   industry scrolls by; scroll-driven CSS lights up the use case whose card
   is showing and draws its glyph. It ships no script, so the things to hold are
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

  /** Scroll to a fraction of the industry's pinned run (its right column's contain range). */
  const through = (industry, fraction) => industry.locator('.mk-uc-hows').evaluate((el, fraction) => {
    const box = el.getBoundingClientRect()
    window.scrollBy({ top: box.top + fraction * (box.height - innerHeight), behavior: 'instant' })
  }, fraction)

  test('both columns stay put while the cards swap, one per use case', async ({ page }) => {
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').nth(1)
    const cards = industry.locator('.mk-uc-how')
    const cases = industry.locator('.mk-uc-cases > li')
    const top = locator => locator.evaluate(el => Math.round(el.getBoundingClientRect().top))
    await through(industry, 0.1)
    await expect.poll(() => opacity(cards.first())).toBeGreaterThan(0.95)
    const stageTop = await top(industry.locator('.mk-uc-stage'))
    const headTop = await top(industry.locator('.mk-uc-head'))
    await through(industry, 0.4)
    await expect.poll(() => opacity(cards.nth(1))).toBeGreaterThan(0.95)
    expect(await opacity(cards.first())).toBeLessThan(0.05)
    expect(await opacity(cases.nth(1))).toBeGreaterThan(0.95)
    expect(await opacity(cases.nth(2))).toBeLessThan(0.5)
    expect(await top(industry.locator('.mk-uc-stage'))).toBe(stageTop)
    expect(await top(industry.locator('.mk-uc-head'))).toBe(headTop)
  })

  test("a use case's glyph draws itself when its card comes up", async ({ page }) => {
    await page.goto(PATH)
    const industry = page.locator('.mk-uc-industry').nth(1)
    // The second use case's glyph has strokes that draw in (not every glyph does).
    const stroke = industry.locator('.mk-uc-cases > li').nth(1).locator('.mk-uc-glyph .g-draw').first()
    const offset = () => stroke.evaluate(el => Number.parseFloat(getComputedStyle(el).strokeDashoffset))
    await through(industry, 0.1)
    await expect.poll(offset).toBeGreaterThan(0.9)
    await through(industry, 0.4)
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

test.describe('the side menu, on a wide screen', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('links every industry and marks the one in the middle of the screen', async ({ page }) => {
    await page.goto(PATH)
    const industries = page.locator('.mk-uc-industry')
    const links = page.locator('.mk-uc-side a')
    const anchors = await industries.evaluateAll(els => els.map(el => `#${el.id}`))
    expect(await links.evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(anchors)
    const colour = locator => locator.evaluate(el => getComputedStyle(el).color)
    await centre(industries.nth(2).locator('.mk-uc-how').nth(1))
    await expect(links.nth(2)).toBeVisible()
    await expect.poll(() => colour(links.nth(2))).not.toBe(await colour(links.nth(3)))
    await links.nth(5).click()
    await expect(page).toHaveURL(new RegExp(`${anchors[5]}$`))
  })

  test('is hidden while the intro is on screen', async ({ page }) => {
    await page.goto(PATH)
    await expect(page.locator('.mk-uc-side')).toBeHidden()
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
