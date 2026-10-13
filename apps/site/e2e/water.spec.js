import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'

/* The calendar's water (motion/water.js): a looping clip on each of the
   chosen team's two cards, and the stream falling onto the AFTER card
   (e2e/stream.spec.js checks where it lands), on the media tier only,
   created once the calendar is near the viewport. Asserted by state and
   geometry, never by pixels. */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const COPY = CATALOGS[forge.locales.default].home.day
const isCardMedia = url => /card-(before|after|stream)[^/]*\.(webm|mp4)(\?|$)/.test(url)
const water = (page, which) => page.locator(`.mk-day .ui-tabs-panel:visible [data-cal="${which === 'stream' ? 'after' : which}"] > .mk-cal-water--${which}`)
const toCalendar = page => page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))

/** The card's border box, the clip's box and where the clip's fit box lands. */
const boxes = (page, which) => page.locator(`.mk-day .ui-tabs-panel:visible [data-cal="${which}"]`).evaluate((card, which) => {
  const v = card.querySelector(`.mk-cal-water--${which}`)
  const c = card.getBoundingClientRect(), r = v.getBoundingClientRect()
  const num = k => parseFloat(v.style.getPropertyValue(`--water-${k}`))
  return {
    card: { top: c.top, left: c.left, right: c.right, bottom: c.bottom },
    clip: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
    fit: {
      top: r.top + num('t') * r.height, bottom: r.top + num('b') * r.height,
      left: r.left + num('l') * r.width, right: r.left + num('r') * r.width,
    },
  }
}, which)

test('no card clip until the calendar is near; then one on each card of the chosen team', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = []
  page.on('request', r => { if (isCardMedia(r.url())) requests.push(r.url()) })
  await page.goto(HOME, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await expect(page.locator('.mk-cal-water')).toHaveCount(0)
  expect(requests).toEqual([])

  await toCalendar(page)
  await expect(water(page, 'before')).toHaveCount(1)
  await expect(water(page, 'after')).toHaveCount(1)
  await expect(water(page, 'stream')).toHaveCount(1)
  await expect(page.locator('.mk-cal-water')).toHaveCount(3)
  for (const which of ['before', 'after', 'stream']) {
    await expect(water(page, which)).toHaveAttribute('aria-hidden', 'true')
    await expect(water(page, which)).toHaveCSS('pointer-events', 'none')
  }
  // They play (AV1 in Chromium), and they follow the chosen team.
  await expect.poll(() => water(page, 'after').evaluate(v => !v.paused && v.currentTime > 0)).toBe(true)
  await page.locator('.mk-day label', { hasText: COPY.teams.logistics.name }).click()
  await expect(water(page, 'before')).toHaveCount(1)
  await expect(water(page, 'after')).toHaveCount(1)
  await expect(water(page, 'stream')).toHaveCount(1)
  await expect(page.locator('.mk-cal-water')).toHaveCount(3)

  // Off screen they pause.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.locator('.mk-cal-water').evaluateAll(vs => vs.every(v => v.paused))).toBe(true)
})

/* Side by side, stacked weeks and one day: the same placement rules. */
for (const [width, height] of [[1440, 900], [1024, 768], [375, 812]]) {
  test(`at ${width}px the BEFORE clip sits on the top border and the AFTER clip behind the card, past both sides`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    await expect(page.locator('.mk-cal-water')).toHaveCount(3)

    const before = await boxes(page, 'before')
    // The slab's top edge is the card's top border, and the slab spans the card.
    expect(Math.abs(before.fit.top - before.card.top)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(before.fit.left - before.card.left)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(before.fit.right - before.card.right)).toBeLessThanOrEqual(1.5)
    await expect(water(page, 'before')).toHaveCSS('mix-blend-mode', 'multiply')

    const after = await boxes(page, 'after')
    // The sheets' inner edges are on the side borders (tucked under them by at
    // most 2% of the card on a tablet), so the sheets run just outside; the
    // clip starts at the card's top edge (the stream coming in is the
    // stream clip's) and the stream leaves below.
    const tuck = 0.02 * (after.card.right - after.card.left) + 1.5
    expect(Math.abs(after.fit.left - after.card.left)).toBeLessThanOrEqual(tuck)
    expect(Math.abs(after.fit.right - after.card.right)).toBeLessThanOrEqual(tuck)
    expect(after.clip.left).toBeLessThan(after.card.left)
    expect(after.clip.right).toBeGreaterThan(after.card.right)
    expect(after.clip.top).toBeLessThan(after.card.top)
    expect(after.card.top - after.clip.top).toBeLessThan(40)
    expect(after.clip.bottom).toBeGreaterThan(after.card.bottom)
    // Behind the card: inside the card, hit-testing (with the clip made
    // hittable) finds the card's own content before the clip.
    const order = await page.locator('.mk-day .ui-tabs-panel:visible [data-cal="after"]').evaluate((card) => {
      const v = card.querySelector('.mk-cal-water--after')
      v.style.pointerEvents = 'auto'
      card.scrollIntoView({ block: 'center', behavior: 'instant' })
      const r = card.getBoundingClientRect()
      const stack = document.elementsFromPoint(r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, 80), innerHeight - 10))
      v.style.pointerEvents = ''
      return { card: stack.indexOf(card), clip: stack.indexOf(v) }
    })
    expect(order.clip).toBeGreaterThan(-1)
    expect(order.card).toBeGreaterThan(-1)
    expect(order.card).toBeLessThan(order.clip)
    // The clip never widens the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('no card clips', async ({ page }) => {
    const requests = []
    page.on('request', r => { if (isCardMedia(r.url())) requests.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page); await page.waitForTimeout(1200)
    await expect(page.locator('.mk-cal-water')).toHaveCount(0)
    expect(requests).toEqual([])
  })
})

test.describe('Save-Data', () => {
  test('no card clips', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }))
    const requests = []
    page.on('request', r => { if (isCardMedia(r.url())) requests.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page); await page.waitForTimeout(1200)
    await expect(page.locator('.mk-cal-water')).toHaveCount(0)
    expect(requests).toEqual([])
  })
})

test('the clip boxes come from media.json', async ({ page }) => {
  await page.goto(HOME, { waitUntil: 'load' })
  const data = JSON.parse(await page.locator('[data-day]').getAttribute('data-water'))
  for (const which of ['before', 'after']) {
    expect(data[which].fit).toEqual(media.cards[which].fit)
    expect(data[which].aspect).toBe(media.cards[which].aspect)
  }
  expect(data.stream).toMatchObject(media.cards.stream)
  expect(data.hero).toEqual({ l: media.hero['16x9'].stream, p: media.hero['9x16'].stream })
})
