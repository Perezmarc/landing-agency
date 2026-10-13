import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The hero's stream and the AFTER card's (docs/LANDING-DESIGN.md).

   1. The pebble's stream never ends in mid-air: in the AFTER poster and the
      AFTER loop, the stream column is water (darker than the page's white)
      right down to the stage's bottom edge, on phones and desktops. On a
      phone whose browser bars collapse, the stage (100lvh) is taller than
      the small viewport the pebble is placed in (100svh); Chromium has no
      bars, so that case is reproduced by laying the hero out for a small
      viewport shorter than the screen.
   2. The stream that falls onto the AFTER card lands on the hero stream's x,
      at the hero's scale, in every calendar layout. */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const PORTRAIT = (w, h) => w <= h

/** Where the hero's stream is on screen: the media box and the stream's
    fraction of its width (media.json), for the rendition the layout uses. */
async function heroStream(page, w, h) {
  const box = await page.locator('.mk-hero-media').boundingBox()
  const s = media.hero[PORTRAIT(w, h) ? '9x16' : '16x9'].stream
  return { x: box.x + s.x * box.width, scale: s.unit * box.width, box }
}

/** The darkest luma in a strip of the screen, sampled from a screenshot. */
async function darkest(page, clip) {
  const shot = (await page.screenshot({ clip })).toString('base64')
  return page.evaluate(async (shot) => {
    const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let min = 255
    for (let i = 0; i < d.length; i += 4) min = Math.min(min, 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
    return Math.round(min)
  }, shot)
}

/** The strip at the stage's bottom edge, 24px around the stream's x. */
async function bottomStrip(page, w, h) {
  const stage = await page.locator('.mk-hero-stage').boundingBox()
  const { x } = await heroStream(page, w, h)
  const bottom = Math.min(stage.y + stage.height, h)
  return { x: Math.round(x - 12), y: Math.round(bottom - 10), width: 24, height: 8 }
}

// The page is white (255); the thin stream at the frame's foot is luma 180-215.
const WATER = 230

const SIZES = [[390, 844], [430, 932], [375, 667], [1440, 900], [1920, 1080]]

for (const [width, height] of SIZES) {
  test.describe(`the hero stream at ${width}x${height}`, () => {
    test.use({ viewport: { width, height } })

    test('the AFTER poster runs it out through the stage\'s bottom edge', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height }, baseURL: test.info().project.use.baseURL })
      const page = await context.newPage()
      await page.goto(HOME, { waitUntil: 'load' })
      await expect.poll(() => page.locator('.mk-hero-poster--after img').evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0)
      // The media box reaches the stage's bottom, and the stream is there.
      const stage = await page.locator('.mk-hero-stage').boundingBox(), box = await page.locator('.mk-hero-media').boundingBox()
      expect(box.y + box.height).toBeGreaterThanOrEqual(stage.y + stage.height - 0.5)
      expect(await darkest(page, await bottomStrip(page, width, height))).toBeLessThan(WATER)
      // And it is a stream, not the page: just beside it, the page is white.
      const strip = await bottomStrip(page, width, height)
      expect(await darkest(page, { ...strip, x: strip.x - 60 })).toBeGreaterThanOrEqual(250)
      await context.close()
    })

    test('so does the AFTER loop', async ({ page }) => {
      await page.goto(HOME, { waitUntil: 'load' })
      await page.evaluate(() => window.scrollTo(0, 100))
      await expect.poll(() => page.locator('[data-hero]').getAttribute('data-hero-state'), { timeout: 10000 }).toBe('after')
      await expect(page.locator('video.mk-hero-video--after.is-ready')).toHaveCount(1)
      await page.waitForTimeout(400)
      expect(await darkest(page, await bottomStrip(page, width, height))).toBeLessThan(WATER)
    })
  })
}

/* A phone whose bars have collapsed: the screen is taller than the small
   viewport. Every 100svh in the hero's rules is replaced by the small
   viewport's height (the screen less 25%: Safari's bars are about a fifth
   of an iPhone's screen), as Safari would lay it out. */
for (const [width, height] of [[390, 844], [375, 667]]) {
  test(`with the bars collapsed (${width}x${height}), the stream still reaches the screen's bottom edge`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height }, baseURL: test.info().project.use.baseURL })
    const page = await context.newPage()
    await page.goto(HOME, { waitUntil: 'load' })
    const svh = Math.round(height * 0.75)
    await page.evaluate((css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s) }, `
      .mk-hero-copy { height: ${svh}px; }
      .mk-hero-media { --frame-h: max(177.78cqw, ${svh}px); width: max(100%, ${0.5625 * svh}px); top: calc(${svh}px - var(--frame-h)); }`)
    await expect.poll(() => page.locator('.mk-hero-poster--after img').evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0)
    const box = await page.locator('.mk-hero-media').boundingBox()
    expect(box.y + box.height).toBeGreaterThanOrEqual(height)
    expect(await darkest(page, await bottomStrip(page, width, height))).toBeLessThan(WATER)
    await context.close()
  })
}

/* The stream onto the AFTER card: side by side, stacked weeks, one day. */
const TOLERANCE = 2   // px, between the hero stream's x and the card stream's
for (const [width, height, layout] of [[1440, 900, 'side by side'], [1920, 1080, 'side by side'], [1180, 820, 'side by side'], [1024, 768, 'stacked weeks'], [768, 1024, 'stacked weeks'], [390, 844, 'one day']]) {
  test(`${layout} at ${width}x${height}: the AFTER card's incoming stream is on the hero stream's x`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    const stream = page.locator('.mk-day .ui-tabs-panel:visible [data-cal="after"] > .mk-cal-water--stream')
    await expect(stream).toHaveCount(1)
    await expect(stream).toHaveAttribute('aria-hidden', 'true')
    const card = await page.locator('.mk-day .ui-tabs-panel:visible [data-cal="after"]').boundingBox()
    const clip = await stream.boundingBox()
    const hero = await heroStream(page, width, height)
    const { x, width: px } = media.cards.stream
    // The same x, and the same scale.
    expect(Math.abs(clip.x + x * clip.width - hero.x)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(clip.width - px * hero.scale)).toBeLessThanOrEqual(0.5)
    // It falls onto the card: above it, tucked under its top border.
    expect(clip.y).toBeLessThan(card.y)
    expect(clip.y + clip.height).toBeGreaterThan(card.y)
    expect(clip.y + clip.height).toBeLessThan(card.y + 40)
    // Behind the card, like the AFTER clip.
    await expect(stream).toHaveCSS('z-index', '-1')
    // It follows a resize.
    await page.setViewportSize({ width: width + 40, height })
    await expect.poll(async () => {
      const c = await stream.boundingBox(), h = await heroStream(page, width + 40, height)
      return Math.abs(c.x + x * c.width - h.x) <= TOLERANCE
    }).toBe(true)
  })
}
