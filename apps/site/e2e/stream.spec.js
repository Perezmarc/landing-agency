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
      layout: one clip of a falling stream (its first frame in the server
      HTML, the playing clip over it on the media tier), placed by CSS, one
      copy, cross-faded into the hero's own stream so the join does not
      show, with no gap (only where a card is over it, on purpose). */

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
const TOLERANCE = 1   // px, between the hero stream's x and width and the clip's
const isStreamMedia = url => /day-stream-[^/]*\.(webm|mp4)(\?|$)/.test(url)

/** The stream below the hero (its box, and its clip's: the playing clip
    once it shows, else the still under it; the clip's stream, from
    media.json), the hero stream it carries on, and the AFTER card, in
    document px, measured in one go. */
const geometry = (page, w, h) => page.evaluate(({ s, c }) => {
  const doc = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, width: r.width } }
  const panel = [...document.querySelectorAll('.mk-day .ui-tabs-panel')].find(p => p.offsetParent)
  const m = document.querySelector('.mk-hero-media').getBoundingClientRect()
  const wrapper = document.querySelector('.mk-day-stream')
  const clip = doc(wrapper.querySelector('.mk-day-stream-video.is-ready') ?? wrapper.querySelector('img'))
  return {
    wrapper: doc(wrapper),
    clip: { ...clip, x: clip.left + c.x * clip.width, stream: c.width * clip.width },
    hero: { x: m.left + s.x * m.width, width: s.width * m.width, bottom: doc(document.querySelector('.mk-hero')).bottom },
    card: doc(panel.querySelector('[data-cal="after"]')),
    before: doc(panel.querySelector('[data-cal="before"]')),
  }
}, { s: media.hero[PORTRAIT(w, h) ? '9x16' : '16x9'].stream, c: media.stream })

/** Where it is placed: its stream on the hero stream's x at its width; the
    clip starting a little above the hero's bottom edge (where it fades in
    over the hero's stream), long enough to reach well past the AFTER
    card's top border, and the box cut off behind the card. */
function expectPlaced({ wrapper, clip, hero, card }) {
  expect(Math.abs(clip.x - hero.x), 'x').toBeLessThanOrEqual(TOLERANCE)
  expect(Math.abs(clip.stream - hero.width), 'width').toBeLessThanOrEqual(TOLERANCE)
  expect(Math.abs(clip.top - wrapper.top)).toBeLessThanOrEqual(0.5)
  const join = hero.bottom - wrapper.top
  expect(join, 'starts over the hero\'s stream').toBeGreaterThanOrEqual(40)
  expect(join).toBeLessThanOrEqual(80)
  expect(clip.x).toBeGreaterThanOrEqual(card.left + 24)
  expect(clip.x).toBeLessThanOrEqual(card.right - 24)
  // One copy reaches the card, and it is seen to end under the card's top
  // border: the box ends behind the card and never shows below it.
  expect(clip.bottom, 'one clip reaches the card').toBeGreaterThan(card.top + 24)
  expect(wrapper.bottom).toBeGreaterThan(card.top + 24)
  expect(wrapper.bottom).toBeLessThan(card.bottom)
}

for (const [width, height, layout] of [[1440, 900, 'side by side'], [1920, 1080, 'side by side'], [1180, 820, 'side by side'], [1024, 768, 'stacked weeks'], [768, 1024, 'stacked weeks'], [430, 932, 'one day'], [390, 844, 'one day'], [375, 667, 'one day'], [360, 740, 'one day']]) {
  test(`${layout} at ${width}x${height}: one stream clip, on the hero stream's x at its width, into the AFTER card`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    // One copy: one still, and on the media tier one clip, over it, the same box.
    await expect(page.locator(STREAM)).toHaveCount(1)
    await expect(page.locator(`${STREAM} img`)).toHaveCount(1)
    await expect(page.locator(STREAM)).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator(STREAM)).toHaveCSS('pointer-events', 'none')
    await expect(page.locator(`${STREAM} video.is-ready`)).toHaveCount(1, { timeout: 15000 })
    await expect(page.locator(`${STREAM} video`)).toHaveCount(1)
    const [still, clip] = await page.locator(STREAM).evaluate(s => ['img', 'video'].map((k) => { const r = s.querySelector(k).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
    for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(still[k] - clip[k]), k).toBeLessThanOrEqual(0.5)
    const g = await geometry(page, width, height)
    expectPlaced(g)
    test.info().annotations.push({ type: 'stream', description: JSON.stringify({ width, dx: g.clip.x - g.hero.x, dw: g.clip.stream - g.hero.width, join: g.hero.bottom - g.wrapper.top, reach: g.clip.bottom - g.card.top }) })
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
      return Math.abs(r.clip.x - r.hero.x) <= TOLERANCE && Math.abs(r.clip.stream - r.hero.width) <= TOLERANCE && r.clip.bottom > r.card.top + 24
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

/** Puts document row y mid-screen and returns its screen y. */
const centre = (page, y) => page.evaluate(async (y) => {
  window.scrollTo({ top: y - innerHeight / 2, behavior: 'instant' })
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  return y - scrollY
}, y)

/* Where the clip meets the hero's stream: on screen, every few px from
   above the clip's top, through the cross-fade and the hero's bottom edge,
   to below it, the column is one stream: water, its centre and width those
   of the hero's (which wobbles a few px frame to frame). With the hero in
   its AFTER state and both clips playing, at three moments of the loop. */
for (const [width, height, scale] of [[1440, 900, 2], [1024, 768, 2], [390, 844, 3]]) {
  test(`at ${width}x${height} the join with the hero's stream does not show`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, baseURL: test.info().project.use.baseURL })
    const page = await context.newPage()
    await page.goto(HOME, { waitUntil: 'load' })
    await page.evaluate(() => window.scrollTo(0, 100))
    await expect.poll(() => page.locator('[data-hero]').getAttribute('data-hero-state'), { timeout: 10000 }).toBe('after')
    const { hero } = await geometry(page, width, height)
    await page.evaluate(y => window.scrollTo({ top: y - innerHeight / 2, behavior: 'instant' }), hero.bottom)
    await expect(page.locator(`${STREAM} video.is-ready`)).toHaveCount(1, { timeout: 15000 })
    await expect(page.locator('video.mk-hero-video--after.is-ready')).toHaveCount(1)
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })
    const g = await geometry(page, width, height)
    for (const moment of [0, 1, 2]) {
      await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.play()))
      await page.waitForTimeout(moment ? 1300 : 300)
      // Both clips held on one frame for the shot.
      await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()))
      await page.waitForTimeout(100)
      const top = await page.evaluate(() => scrollY)
      const shot = (await page.screenshot({ clip: { x: Math.round(g.hero.x - 30), y: g.hero.bottom - top - 90, width: 60, height: 180 } })).toString('base64')
      const rows = await page.evaluate(async ({ shot, k }) => {
        const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode()
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
        const out = []
        for (let y = 2; y < 178; y += 4) {
          const d = ctx.getImageData(0, Math.round(y * k), c.width, 1).data, L = i => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
          let peak = 0
          for (let i = 0; i < c.width; i++) if (L(i) < L(peak)) peak = i
          let l = -1, r = -1
          for (let i = 0; i < c.width; i++) if (L(i) < 240 && Math.abs(i - peak) < 24 * k) { if (l < 0) l = i; r = i }
          out.push({ y: y - 90, min: Math.round(L(peak)), centre: (l + r + 1) / 2 / k - 30, width: (r + 1 - l) / k })
        }
        return out
      }, { shot, k: scale })
      // One stream all the way: water on every row; from the clip's top
      // (64px over the hero's edge, where it starts to fade in) down, no
      // step from row to row past the few px either stream wobbles
      // and swells by; and from the hero's edge down, on average, the
      // stream centred on the hero's at its width (media.json, where it
      // leaves the hero; higher up the hero's stream is its own business).
      test.info().annotations.push({ type: 'join', description: JSON.stringify({ width, moment, rows: rows.map(r => [r.y, +r.centre.toFixed(1), +r.width.toFixed(1), r.min]) }) })
      const x = g.hero.x - Math.round(g.hero.x - 30) - 30
      const below = rows.filter(r => r.y >= 0), mean = k => below.reduce((s, r) => s + r[k], 0) / below.length
      expect(Math.abs(mean('centre') - x), 'centre under the hero\'s edge').toBeLessThanOrEqual(1.5)
      expect(Math.abs(mean('width') - g.hero.width), 'width under the hero\'s edge').toBeLessThanOrEqual(3)
      for (const [i, r] of rows.entries()) {
        expect(r.min, `water at ${r.y}px from the hero's bottom`).toBeLessThan(WATER)
        if (r.y < -64) continue
        if (r.y >= 0) expect(Math.abs(r.centre - x), `centre at ${r.y}px`).toBeLessThanOrEqual(3)
        expect(Math.abs(r.centre - rows[i - 1].centre), `centre step at ${r.y}px`).toBeLessThanOrEqual(2.5)
        expect(Math.abs(r.width - rows[i - 1].width), `width step at ${r.y}px`).toBeLessThanOrEqual(5)
      }
    }
    await context.close()
  })
}

/* One stream from the hero to the card: the clip covers every row from
   the hero's bottom edge to the AFTER card's top border, and on screen the
   column is water wherever the page shows it (not under a card or the tabs). */
const GAP = 2   // px: the most the stream may break anywhere
for (const [width, height, layout] of [[1440, 900, 'side by side'], [1024, 768, 'stacked weeks'], [390, 844, 'one day'], [375, 667, 'one day']]) {
  test(`${layout} at ${width}x${height}: the stream is continuous from the hero's bottom to the AFTER card`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    await expect(page.locator(`${STREAM} video.is-ready`)).toHaveCount(1, { timeout: 15000 })
    const { wrapper, clip, hero, card } = await geometry(page, width, height)
    // Geometry: nothing between the hero and the card is left uncovered.
    const gap = Math.max(clip.top - hero.bottom, card.top - Math.min(clip.bottom, wrapper.bottom), 0)
    test.info().annotations.push({ type: 'stream', description: JSON.stringify({ width, heroBottom: hero.bottom, cardTop: card.top, gap }) })
    expect(gap).toBeLessThanOrEqual(GAP)

    // On screen: every 40px down the column, where no opaque box is over the
    // stream (a card, the tabs), the column is darker than the page.
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })
    let sampled = 0
    for (let y = hero.bottom + 8; y < card.top - 4; y += 40) {
      const at = await centre(page, y)
      if (at < 4 || at > (await page.evaluate(() => innerHeight)) - 4) continue
      // (The stream takes no pointer events, so hit-testing walks down to
      // the body through whatever is over it.)
      const open = await page.evaluate(({ x, at }) => {
        for (const el of document.elementsFromPoint(x, at)) {
          if (el === document.body || el === document.documentElement || el.closest('.mk-day-stream')) return true
          const bg = getComputedStyle(el).backgroundColor
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false
        }
        return true
      }, { x: clip.x, at })
      if (!open) continue
      sampled++
      expect(await darkest(page, { x: Math.round(clip.x - 12), y: Math.round(at - 2), width: 24, height: 4 }), `water at y=${y}`).toBeLessThan(WATER)
    }
    expect(sampled).toBeGreaterThan(3)
  })
}

/* With no JavaScript, reduced motion or Save-Data, the still is there, in
   place, the same stream; no clip is requested. */
test('with JavaScript off the still is in place', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  await page.goto(HOME, { waitUntil: 'load' })
  await expect(page.locator(STREAM)).toHaveCount(1)
  await expect(page.locator(`${STREAM} video`)).toHaveCount(0)
  const g = await geometry(page, 1440, 900)
  expectPlaced(g)
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), g.hero.bottom + 100)
  await expect.poll(() => page.locator(`${STREAM} img`).evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0)
  const top = await page.evaluate(() => scrollY)
  expect(await darkest(page, { x: Math.round(g.clip.x - 12), y: Math.round(g.hero.bottom + 200 - top), width: 24, height: 4 })).toBeLessThan(WATER)
  await context.close()
})

for (const [name, setup] of [
  ['reduced motion', async (page) => page.emulateMedia({ reducedMotion: 'reduce' })],
  ['Save-Data', async (page) => page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }))],
]) {
  test(`${name}: the still in place, no clip`, async ({ page }) => {
    await setup(page)
    const requests = []
    page.on('request', r => { if (isStreamMedia(r.url())) requests.push(r.url()) })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(1200)
    await expect(page.locator(`${STREAM} video`)).toHaveCount(0)
    expect(requests).toEqual([])
    expectPlaced(await geometry(page, 390, 844))
  })
}

test('on the media tier the clip is the layout\'s rendition, plays only near the viewport, and swaps across the query', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = []
  page.on('request', r => { if (isStreamMedia(r.url())) requests.push(r.url()) })
  await page.goto(HOME, { waitUntil: 'load' })
  await page.waitForTimeout(600)
  expect(requests).toEqual([])
  await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  const video = page.locator(`${STREAM} video`)
  await expect.poll(() => video.evaluate(v => !v.paused && v.currentTime > 0 && v.currentSrc)).toMatch(/day-stream-16x9/)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => video.evaluate(v => v.paused)).toBe(true)
  // Portrait: the 9:16 rendition, still placed on the hero's stream.
  await page.setViewportSize({ width: 600, height: 900 })
  await page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
  await expect.poll(() => video.evaluate(v => !v.paused && v.currentSrc)).toMatch(/day-stream-9x16/)
  await expect(video).toHaveCount(1)
  await expect(page.locator(`${STREAM} video.is-ready`)).toHaveCount(1, { timeout: 15000 })
  expectPlaced(await geometry(page, 600, 900))
})
