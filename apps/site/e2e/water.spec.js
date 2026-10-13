import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'

/* The calendar's water (motion/water.js): a looping clip on each of the
   chosen team's two cards, kept to a thin band around the borders, and the
   stream falling onto the AFTER card (copies of one clip; e2e/stream.spec.js
   checks where it runs), on the media tier only, created once the calendar
   is near the viewport. Asserted by state and geometry; the band by
   comparing the page with the card clips shown and hidden. */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const COPY = CATALOGS[forge.locales.default].home.day
const isCardMedia = url => /card-(before|after|stream)[^/]*\.(webm|mp4)(\?|$)/.test(url)
const water = (page, which) => page.locator(`.mk-day .ui-tabs-panel:visible [data-cal="${which === 'stream' ? 'after' : which}"] > .mk-cal-water--${which}`)
const copies = page => water(page, 'stream').count()
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
  await expect.poll(() => copies(page)).toBeGreaterThan(1)
  const n = await copies(page)
  await expect(page.locator('.mk-cal-water')).toHaveCount(2 + n)
  for (const v of await page.locator('.mk-cal-water').all()) {
    await expect(v).toHaveAttribute('aria-hidden', 'true')
    await expect(v).toHaveCSS('pointer-events', 'none')
  }
  // The copies of the stream each start at their own time.
  await expect.poll(() => water(page, 'stream').evaluateAll(vs => new Set(vs.filter(v => v.readyState > 0).map(v => v.currentTime.toFixed(1))).size)).toBeGreaterThan(1)
  // They play (AV1 in Chromium), and they follow the chosen team.
  await expect.poll(() => water(page, 'after').evaluate(v => !v.paused && v.currentTime > 0)).toBe(true)
  await page.locator('.mk-day label', { hasText: COPY.teams.logistics.name }).click()
  await expect(water(page, 'before')).toHaveCount(1)
  await expect(water(page, 'after')).toHaveCount(1)
  await expect.poll(() => copies(page)).toBeGreaterThan(1)
  await expect(page.locator('.mk-cal-water')).toHaveCount(2 + await copies(page))

  // Off screen they pause.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.locator('.mk-cal-water').evaluateAll(vs => vs.every(v => v.paused))).toBe(true)
})

/* Where a card clip may change the page: never inside the card's content
   box (inside its padding: the title, the axis and the chips), and at most
   BAND (px) outside its border box. */
const BAND = { 1440: 60, 1024: 60, 375: 44 }

/** Every pixel one card's clip changes, measured against the card: the
    viewport is shot with all the water paused, then with that clip hidden.
    `edge` is the border kept on screen, 100px in from the viewport's edge. */
async function footprint(page, which, edge) {
  const card = page.locator(`.mk-day .ui-tabs-panel:visible [data-cal="${which}"]`)
  await card.evaluate((el, edge) => {
    const r = el.getBoundingClientRect()
    window.scrollTo({ top: scrollY + (edge === 'top' ? r.top - 100 : r.bottom - innerHeight + 100), behavior: 'instant' })
  }, edge)
  // The calendar's own motion and the reveals have finished (looping ones
  // elsewhere on the page are not the cards').
  await expect.poll(() => page.evaluate(() => document.getAnimations()
    .filter(a => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity).length)).toBe(0)
  const clip = water(page, which)
  // Everything that moves holds still between the two shots: the water and
  // the page's looping motion (the stones).
  await page.locator('.mk-cal-water').evaluateAll(vs => vs.forEach(v => v.pause()))
  await page.evaluate(() => document.getAnimations().forEach(a => a.pause()))
  await page.waitForTimeout(100)
  const shot = async () => (await page.screenshot()).toString('base64')
  const shown = await shot()
  await clip.evaluate(v => { v.style.visibility = 'hidden' })
  const hidden = await shot()
  await clip.evaluate(v => { v.style.visibility = '' })
  const box = await card.evaluate((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    const inset = k => parseFloat(cs[`border${k}Width`]) + parseFloat(cs[`padding${k}`])
    return {
      card: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
      content: { top: r.top + inset('Top'), left: r.left + inset('Left'), right: r.right - inset('Right'), bottom: r.bottom - inset('Bottom') },
    }
  })
  return page.evaluate(async ({ shown, hidden, box: { card, content } }) => {
    const read = async (src) => {
      const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
      return { d: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    }
    const a = await read(shown), b = await read(hidden)
    const k = a.w / innerWidth
    const out = { above: 0, below: 0, left: 0, right: 0, inside: 0, changed: 0 }
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * 4
      if (Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2])) < 8) continue
      const px = (x + 0.5) / k, py = (y + 0.5) / k
      out.changed++
      if (px > content.left && px < content.right && py > content.top && py < content.bottom) out.inside++
      out.above = Math.max(out.above, Math.round(card.top - py))
      out.below = Math.max(out.below, Math.round(py - card.bottom))
      out.left = Math.max(out.left, Math.round(card.left - px))
      out.right = Math.max(out.right, Math.round(px - card.right))
    }
    return out
  }, { shown, hidden, box })
}

/* Side by side, stacked weeks and one day: the same placement rules. */
for (const [width, height] of [[1440, 900], [1024, 768], [375, 812]]) {
  test(`at ${width}px the BEFORE clip sits on the top border and the AFTER clip behind the card, past both sides`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    await expect(water(page, 'before')).toHaveCount(1)
    await expect(water(page, 'after')).toHaveCount(1)

    const before = await boxes(page, 'before')
    // The slab's top edge is the card's top border, and the slab spans the
    // card's border box widened by --water-out each side.
    const out = await water(page, 'before').evaluate(v => parseFloat(getComputedStyle(v).getPropertyValue('--water-out')))
    expect(out).toBeGreaterThan(0)
    expect(Math.abs(before.fit.top - before.card.top)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(before.fit.left - (before.card.left - out))).toBeLessThanOrEqual(1.5)
    expect(Math.abs(before.fit.right - (before.card.right + out))).toBeLessThanOrEqual(1.5)
    await expect(water(page, 'before')).toHaveCSS('mix-blend-mode', 'multiply')

    const after = await boxes(page, 'after')
    // The sheets' inner edges are tucked under the side borders (by at most
    // 4% of the card), so only their outer edge runs outside; the clip starts
    // at the card's top edge (the stream coming in is the stream copies') and
    // the stream leaves below.
    const tuck = 0.04 * (after.card.right - after.card.left) + 1.5
    expect(after.fit.left).toBeGreaterThan(after.card.left - 1.5)
    expect(after.fit.left - after.card.left).toBeLessThanOrEqual(tuck)
    expect(after.fit.right).toBeLessThan(after.card.right + 1.5)
    expect(after.card.right - after.fit.right).toBeLessThanOrEqual(tuck)
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
    // The clips never widen the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })

  test(`at ${width}px the card water stays in a thin band around the borders, clear of the content`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    for (const which of ['before', 'after']) await expect(water(page, which)).toHaveClass(/is-ready/)
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })   // fixed over the page: not the cards' business
    const band = BAND[width]
    // The BEFORE card's top border and the top of its sides.
    const top = await footprint(page, 'before', 'top')
    expect(top.changed).toBeGreaterThan(0)
    expect(top.inside).toBe(0)
    expect(top.above).toBeLessThanOrEqual(band)
    expect(top.left).toBeLessThanOrEqual(band)
    expect(top.right).toBeLessThanOrEqual(band)
    // The AFTER card's sides and its bottom border, where the stream leaves.
    const bottom = await footprint(page, 'after', 'bottom')
    expect(bottom.changed).toBeGreaterThan(0)
    expect(bottom.inside).toBe(0)
    expect(bottom.below).toBeLessThanOrEqual(band)
    expect(bottom.left).toBeLessThanOrEqual(band)
    expect(bottom.right).toBeLessThanOrEqual(band)
    test.info().annotations.push({ type: 'band', description: JSON.stringify({ width, before: top, after: bottom }) })
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
