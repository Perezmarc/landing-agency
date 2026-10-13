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
   2. The stream carries on from the hero's bottom edge to the AFTER card's
      top border, on the hero stream's x, at the hero's scale, in every
      calendar layout: one stream, with no gap (only where a card is over it,
      on purpose). */

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
    await expect.poll(() => stream.count()).toBeGreaterThan(1)
    const { x, width: px } = media.cards.stream
    for (const copy of await stream.all()) {
      await expect(copy).toHaveAttribute('aria-hidden', 'true')
      await expect(copy).toHaveCSS('z-index', '-1')   // behind the page's text and the cards
    }
    // Every copy on the same x, at the same scale (measured in one go, with
    // the hero and the card).
    const { card, media: m, copies } = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height } }
      const panel = [...document.querySelectorAll('.mk-day .ui-tabs-panel')].find(p => p.offsetParent)
      const card = panel.querySelector('[data-cal="after"]')
      return { card: box(card), media: box(document.querySelector('.mk-hero-media')), copies: [...card.querySelectorAll(':scope > .mk-cal-water--stream')].map(box) }
    })
    const s = media.hero[PORTRAIT(width, height) ? '9x16' : '16x9'].stream
    const hero = { x: m.x + s.x * m.width, scale: s.unit * m.width }
    for (const clip of copies) {
      expect(Math.abs(clip.x + x * clip.width - hero.x)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(clip.width - px * hero.scale)).toBeLessThanOrEqual(0.5)
    }
    // The last one falls onto the card: from above it to under its top
    // border (its rows below that are behind the card).
    const last = copies.at(-1)
    expect(last.y).toBeLessThan(card.y)
    expect(last.y + last.height).toBeGreaterThan(card.y + 20)
    expect(last.y + last.height).toBeLessThanOrEqual(card.y + last.height)
    // It follows a resize.
    await page.setViewportSize({ width: width + 40, height })
    await expect.poll(async () => {
      const c = await stream.first().boundingBox(), h = await heroStream(page, width + 40, height)
      return Math.abs(c.x + x * c.width - h.x) <= TOLERANCE
    }).toBe(true)
  })
}

/** Where the stream is drawn down the page, in document px: each copy's
    solid rows (below --stream-solid; the rows above it fade in over the copy
    above), and the cards it passes behind on purpose. */
const coverage = page => page.evaluate(() => {
  const doc = r => ({ top: r.top + scrollY, bottom: r.bottom + scrollY })
  const panel = [...document.querySelectorAll('.mk-day .ui-tabs-panel')].find(p => p.offsetParent)
  const copies = [...panel.querySelectorAll('[data-cal="after"] > .mk-cal-water--stream')]
  const x = (() => { const r = copies[0].getBoundingClientRect(); return r.left + r.width / 2 })()
  const spans = copies.map((v) => {
    const r = doc(v.getBoundingClientRect())
    const solid = parseFloat(v.style.getPropertyValue('--stream-solid')) / 100
    return { top: r.top + solid * (r.bottom - r.top), bottom: r.bottom }
  })
  const before = panel.querySelector('[data-cal="before"]').getBoundingClientRect()
  const behind = x > before.left && x < before.right ? [doc(before)] : []
  return {
    x,
    heroBottom: doc(document.querySelector('.mk-hero').getBoundingClientRect()).bottom,
    cardTop: doc(panel.querySelector('[data-cal="after"]').getBoundingClientRect()).top,
    spans, behind,
  }
})

/* One stream from the hero to the card: the copies (and the BEFORE card,
   where the layout stacks it over the stream) cover every row from the
   hero's bottom edge to the AFTER card's top border, and on screen the
   column is water wherever the page shows it. */
const GAP = 3   // px: the most the stream may break anywhere
for (const [width, height, layout] of [[1440, 900, 'side by side'], [1024, 768, 'stacked weeks'], [390, 844, 'one day']]) {
  test(`${layout} at ${width}x${height}: the stream is continuous from the hero's bottom to the AFTER card`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    await expect.poll(() => page.locator('.mk-cal-water--stream').count()).toBeGreaterThan(1)
    const { x, heroBottom, cardTop, spans, behind } = await coverage(page)
    // Geometry: the largest stretch between hero and card that nothing covers.
    const covers = [...spans, ...behind].sort((a, b) => a.top - b.top)
    let reach = heroBottom, gap = 0
    for (const s of covers) {
      if (s.bottom <= reach) continue
      gap = Math.max(gap, s.top - reach)
      reach = Math.max(reach, s.bottom)
    }
    gap = Math.max(gap, cardTop - reach)
    test.info().annotations.push({ type: 'stream', description: JSON.stringify({ width, heroBottom, cardTop, copies: spans.length, gap }) })
    expect(spans[0].top).toBeLessThanOrEqual(heroBottom + GAP)
    expect(gap).toBeLessThanOrEqual(GAP)

    // On screen: every 40px down the column, where no opaque box is over the
    // stream (a card, the tabs), the column is darker than the page.
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })
    for (let y = heroBottom + 8; y < cardTop - 4; y += 40) {
      const at = await page.evaluate(async (y) => {
        window.scrollTo({ top: y - innerHeight / 2, behavior: 'instant' })
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        return y - scrollY
      }, y)
      // (The copies take no pointer events, so hit-testing walks down to the
      // body through whatever is over them.)
      const open = await page.evaluate(({ x, at }) => {
        for (const el of document.elementsFromPoint(x, at)) {
          if (el === document.body || el === document.documentElement) return true
          const bg = getComputedStyle(el).backgroundColor
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false
        }
        return true
      }, { x, at })
      if (!open) continue
      await expect.poll(() => page.locator('.mk-cal-water--stream').evaluateAll((vs, at) => vs
        .filter(v => { const r = v.getBoundingClientRect(); return r.top <= at && r.bottom >= at })
        .every(v => v.classList.contains('is-ready') && !v.paused && getComputedStyle(v).opacity === '1'), at)).toBe(true)
      expect(await darkest(page, { x: Math.round(x - 12), y: Math.round(at - 2), width: 24, height: 4 }), `water at y=${y}`).toBeLessThan(WATER)
    }
  })
}
