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
      top border, on the hero stream's x, at its width, in every calendar
      layout: one drawn element, placed by CSS (so with or without
      JavaScript), with no gap (only where a card is over it, on purpose). */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const PORTRAIT = (w, h) => w <= h

/** Where the hero's stream is on screen: the media box and the stream's
    centre as a fraction of its width (media.json), for the rendition the
    layout uses. */
async function heroStream(page, w, h) {
  const box = await page.locator('.mk-hero-media').boundingBox()
  const s = media.hero[PORTRAIT(w, h) ? '9x16' : '16x9'].stream
  return { x: box.x + s.x * box.width }
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
const STREAM = '.mk-day-stream'
const TOLERANCE = 1   // px, between the hero stream's x and width and the drawn one's

/** The drawn stream, the hero stream it carries on, and the boxes it runs
    between, in document px, measured in one go. */
const geometry = (page, w, h) => page.evaluate(({ s }) => {
  const doc = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, width: r.width } }
  const panel = [...document.querySelectorAll('.mk-day .ui-tabs-panel')].find(p => p.offsetParent)
  const m = document.querySelector('.mk-hero-media').getBoundingClientRect()
  return {
    stream: doc(document.querySelector('.mk-day-stream')),
    hero: { x: m.left + s.x * m.width, width: s.width * m.width, bottom: doc(document.querySelector('.mk-hero')).bottom },
    card: doc(panel.querySelector('[data-cal="after"]')),
  }
}, { s: media.hero[PORTRAIT(w, h) ? '9x16' : '16x9'].stream })

/** Where it is placed: on the hero stream's x at its width, from the hero's
    bottom edge into the AFTER card, landing well inside it. */
function expectPlaced({ stream, hero, card }) {
  expect(Math.abs((stream.left + stream.right) / 2 - hero.x), 'x').toBeLessThanOrEqual(TOLERANCE)
  expect(Math.abs(stream.width - hero.width), 'width').toBeLessThanOrEqual(TOLERANCE)
  expect(Math.abs(stream.top - hero.bottom), 'starts at the hero\'s bottom edge').toBeLessThanOrEqual(0.5)
  expect(stream.left).toBeGreaterThanOrEqual(card.left + 24)
  expect(stream.right).toBeLessThanOrEqual(card.right - 24)
  // It ends behind the AFTER card (whose white hides it), so it is seen to
  // end under the card's top border, and never shows below the card.
  expect(stream.bottom).toBeGreaterThan(card.top + 24)
  expect(stream.bottom).toBeLessThan(card.bottom)
}

for (const [width, height, layout] of [[1440, 900, 'side by side'], [1920, 1080, 'side by side'], [1180, 820, 'side by side'], [1024, 768, 'stacked weeks'], [768, 1024, 'stacked weeks'], [390, 844, 'one day']]) {
  test(`${layout} at ${width}x${height}: one drawn stream, on the hero stream's x at its width, into the AFTER card`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    // One element, not stacked copies of a clip.
    await expect(page.locator(STREAM)).toHaveCount(1)
    await expect(page.locator(STREAM)).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator(STREAM)).toHaveCSS('pointer-events', 'none')
    await expect(page.locator('.mk-cal-water--stream, video[src*="card-stream"], source[src*="card-stream"]')).toHaveCount(0)
    const g = await geometry(page, width, height)
    expectPlaced(g)
    test.info().annotations.push({ type: 'stream', description: JSON.stringify({ width, dx: (g.stream.left + g.stream.right) / 2 - g.hero.x, dw: g.stream.width - g.hero.width, join: g.stream.top - g.hero.bottom }) })
    // Behind the page's content: inside the AFTER card, hit-testing (with the
    // stream made hittable) finds the card before the stream.
    const order = await page.locator(STREAM).evaluate((s) => {
      const card = [...document.querySelectorAll('.mk-day .ui-tabs-panel')].find(p => p.offsetParent).querySelector('[data-cal="after"]')
      card.scrollIntoView({ block: 'center', behavior: 'instant' })
      s.style.pointerEvents = 'auto'
      const r = s.getBoundingClientRect(), c = card.getBoundingClientRect()
      const stack = document.elementsFromPoint((r.left + r.right) / 2, Math.min(c.top + 40, innerHeight - 10))
      s.style.pointerEvents = ''
      return { card: stack.indexOf(card), stream: stack.indexOf(s) }
    })
    expect(order.stream).toBeGreaterThan(-1)
    expect(order.card).toBeGreaterThan(-1)
    expect(order.card).toBeLessThan(order.stream)
    // It follows a resize (CSS: nothing to re-measure), and never widens the page.
    await page.setViewportSize({ width: width + 40, height })
    await expect.poll(async () => {
      const r = await geometry(page, width + 40, height)
      return Math.abs((r.stream.left + r.stream.right) / 2 - r.hero.x) <= TOLERANCE && Math.abs(r.stream.width - r.hero.width) <= TOLERANCE
    }).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 40)
  })
}

test('one stream whichever team is chosen: it belongs to the section, not to a tab', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto(HOME, { waitUntil: 'load' })
  const labels = page.locator('.mk-day .ui-tabs-strip label')
  for (const i of [1, (await labels.count()) - 1]) {
    await labels.nth(i).click()
    await expect(page.locator(STREAM)).toHaveCount(1)
    expectPlaced(await geometry(page, 1024, 768))
  }
})

/* One stream from the hero to the card: the stream covers every row from
   the hero's bottom edge to the AFTER card's top border, and on screen the
   column is water wherever the page shows it (not under a card or the tabs). */
const GAP = 2   // px: the most the stream may break anywhere
for (const [width, height, layout] of [[1440, 900, 'side by side'], [1024, 768, 'stacked weeks'], [390, 844, 'one day']]) {
  test(`${layout} at ${width}x${height}: the stream is continuous from the hero's bottom to the AFTER card`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    const { stream, hero, card } = await geometry(page, width, height)
    // Geometry: nothing between the hero and the card is left uncovered.
    const gap = Math.max(stream.top - hero.bottom, card.top - stream.bottom, 0)
    test.info().annotations.push({ type: 'stream', description: JSON.stringify({ width, heroBottom: hero.bottom, cardTop: card.top, gap }) })
    expect(gap).toBeLessThanOrEqual(GAP)

    // On screen: every 40px down the column, where no opaque box is over the
    // stream (a card, the tabs), the column is darker than the page.
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })
    const x = (stream.left + stream.right) / 2
    // Puts document row y mid-screen and returns its screen y.
    const centre = y => page.evaluate(async (y) => {
      window.scrollTo({ top: y - innerHeight / 2, behavior: 'instant' })
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      return y - scrollY
    }, y)
    let sampled = 0
    for (let y = hero.bottom + 8; y < card.top - 4; y += 40) {
      const at = await centre(y)
      // (The stream takes no pointer events, so hit-testing walks down to
      // the body through whatever is over it.)
      const open = await page.evaluate(({ x, at }) => {
        for (const el of document.elementsFromPoint(x, at)) {
          if (el === document.body || el === document.documentElement) return true
          const bg = getComputedStyle(el).backgroundColor
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false
        }
        return true
      }, { x, at })
      if (!open) continue
      sampled++
      expect(await darkest(page, { x: Math.round(x - 12), y: Math.round(at - 2), width: 24, height: 4 }), `water at y=${y}`).toBeLessThan(WATER)
    }
    expect(sampled).toBeGreaterThan(3)
  })
}

/* It is HTML and CSS, so it is there, still and in place, with no
   JavaScript and with reduced motion; it flows (`is-flowing`) only on the
   media tier, and only while it is near the viewport. */
test('with JavaScript off it is in place, still', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  await page.goto(HOME, { waitUntil: 'load' })
  await expect(page.locator(STREAM)).toHaveCount(1)
  expectPlaced(await geometry(page, 1440, 900))
  await expect(page.locator(STREAM)).not.toHaveClass(/is-flowing/)
  for (const pseudo of ['::before', '::after']) expect(await page.locator(STREAM).evaluate((s, p) => getComputedStyle(s, p).content, pseudo)).toBe('none')
  await context.close()
})

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('it is in place and still', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(600)
    expectPlaced(await geometry(page, 390, 844))
    await expect(page.locator(STREAM)).not.toHaveClass(/is-flowing/)
    // Even with the class, reduced motion draws no moving layer.
    await page.locator(STREAM).evaluate(s => s.classList.add('is-flowing'))
    for (const pseudo of ['::before', '::after']) expect(await page.locator(STREAM).evaluate((s, p) => getComputedStyle(s, p).content, pseudo)).toBe('none')
  })
})

test('Save-Data: in place and still', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HOME, { waitUntil: 'load' })
  await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(600)
  expectPlaced(await geometry(page, 1440, 900))
  await expect(page.locator(STREAM)).not.toHaveClass(/is-flowing/)
})

test('on the media tier it flows only while near the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HOME, { waitUntil: 'load' })
  await expect(page.locator(STREAM)).not.toHaveClass(/is-flowing/)
  await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await expect(page.locator(STREAM)).toHaveClass(/is-flowing/)
  // Its two moving layers are transforms, looping for ever.
  const flow = await page.locator(STREAM).evaluate(s => document.getAnimations()
    .filter(a => a.effect?.target === s && a.effect.pseudoElement)
    .map(a => ({ name: a.animationName, iterations: a.effect.getComputedTiming().iterations, transform: a.effect.getKeyframes().some(k => 'transform' in k) })))
  expect(flow).toHaveLength(2)
  for (const a of flow) expect(a).toEqual({ name: 'mk-stream-flow', iterations: Infinity, transform: true })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator(STREAM)).not.toHaveClass(/is-flowing/)
})
