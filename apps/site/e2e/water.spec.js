import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'
import { stripPlaces } from '../src/motion/water.js'

/* The calendar's water (motion/water.js): on the chosen team's two cards,
   a thin strip of small splashes repeated along the BEFORE card's top
   border (its edge row on the border), and the AFTER card's rim: ten
   pieces of one atlas clip laid round its border, its line of water on the
   border, the stream landing on it from above and leaving below (the
   stream down to it is e2e/stream.spec.js). On the media tier only,
   created once the calendar is near the viewport. Asserted by state and
   geometry, and on screen by comparing the page with the clips shown and
   hidden. */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const COPY = CATALOGS[forge.locales.default].home.day
const RIM = media.cards.rim
const isCardMedia = url => /card-(splash|rim)[^/]*\.(webm|mp4)(\?|$)/.test(url)
const visible = '.mk-day .ui-tabs-panel:visible'
const strips = page => page.locator(`${visible} [data-cal="before"] > .mk-cal-water--before`)
const rim = page => page.locator(`${visible} [data-cal="after"] > .mk-rim`)
const toCalendar = page => page.locator('[data-day]').evaluate(el => el.scrollIntoView({ block: 'start' }))
const ready = page => expect.poll(() => page.evaluate(() => {
  const r = document.querySelector('.mk-rim'), s = [...document.querySelectorAll('.mk-cal-water--before')]
  return Boolean(r?.classList.contains('is-ready') && s.length && s.every(v => v.classList.contains('is-ready')))
}), { timeout: 15000 }).toBe(true)

test('no card clip until the calendar is near; then the splashes and the rim on the chosen team\'s cards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = []
  page.on('request', r => { if (isCardMedia(r.url())) requests.push(r.url()) })
  await page.goto(HOME, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await expect(page.locator('.mk-cal-water, .mk-rim')).toHaveCount(0)
  expect(requests).toEqual([])

  await toCalendar(page)
  await expect.poll(() => strips(page).count()).toBeGreaterThan(1)
  await expect(rim(page)).toHaveCount(1)
  await expect(page.locator('.mk-rim')).toHaveCount(1)
  // Ten pieces, one <video> of the one atlas clip each, played as one.
  await expect(rim(page).locator('.mk-rim-piece')).toHaveCount(10)
  await expect(rim(page).locator('video')).toHaveCount(10)
  for (const v of await page.locator('.mk-cal-water, .mk-rim video').all()) {
    await expect(v).toHaveAttribute('aria-hidden', 'true')
    await expect(v).toHaveCSS('pointer-events', 'none')
  }
  await expect(rim(page)).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => rim(page).locator('video').evaluateAll(vs => vs.every(v => !v.paused && v.currentTime > 0))).toBe(true)
  // Played as one: their times stay together.
  await expect.poll(() => rim(page).locator('video').evaluateAll((vs) => { const t = vs.map(v => v.currentTime); return Math.max(...t) - Math.min(...t) })).toBeLessThan(0.15)
  // The BEFORE strip's copies each start at their own time.
  await expect.poll(() => strips(page).evaluateAll(vs => new Set(vs.filter(v => v.readyState > 0).map(v => v.currentTime.toFixed(1))).size)).toBe(await strips(page).count())
  // They follow the chosen team.
  await page.locator('.mk-day label', { hasText: COPY.teams.logistics.name }).click()
  await expect.poll(() => strips(page).count()).toBeGreaterThan(1)
  await expect(rim(page)).toHaveCount(1)
  await expect(page.locator('.mk-rim')).toHaveCount(1)

  // Off screen they pause.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.locator('.mk-cal-water, .mk-rim video').evaluateAll(vs => vs.every(v => v.paused))).toBe(true)
})

/** Screenshots of the viewport with all the water paused, as RGBA, with
    the given clips shown and then hidden. */
async function shots(page, hide) {
  // The calendar's own motion (it empties the AFTER week once it is in
  // view) and the reveals have finished, twice over a moment.
  const settled = () => page.evaluate(() => !document.querySelector('.mk-task--ghost') && document.getAnimations()
    .filter(a => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity).length === 0)
  for (let i = 0; i < 2; i++) { await page.waitForTimeout(400); await expect.poll(settled, { timeout: 10000 }).toBe(true) }
  await page.evaluate(() => { document.querySelectorAll('video').forEach(v => v.pause()); document.getAnimations().forEach(a => a.pause()) })
  await page.waitForTimeout(150)
  const shown = (await page.screenshot()).toString('base64')
  await page.locator(hide).evaluateAll(els => els.forEach((el) => { el.style.visibility = 'hidden' }))
  await page.waitForTimeout(50)
  const hidden = (await page.screenshot()).toString('base64')
  await page.locator(hide).evaluateAll(els => els.forEach((el) => { el.style.visibility = '' }))
  return { shown, hidden }
}

/** The card's border and content boxes, in viewport px. */
const cardBox = (page, which) => page.locator(`${visible} [data-cal="${which}"]`).evaluate((el) => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
  const inset = k => parseFloat(cs[`border${k}Width`]) + parseFloat(cs[`padding${k}`])
  return {
    card: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
    content: { top: r.top + inset('Top'), left: r.left + inset('Left'), right: r.right - inset('Right'), bottom: r.bottom - inset('Bottom') },
  }
})

/** Puts one edge of a card 100px inside the viewport. */
const bring = (page, which, edge) => page.locator(`${visible} [data-cal="${which}"]`).evaluate((el, edge) => {
  const r = el.getBoundingClientRect()
  window.scrollTo({ top: scrollY + (edge === 'top' ? r.top - 140 : r.bottom - innerHeight + 140), behavior: 'instant' })
}, edge)

/** What the clips change: every changed pixel measured against the card
    (how far above, under, below and beside it, and how many inside its
    content box), and, along the given lines, where the change is darkest
    (the rim's outer line). */
const footprint = (page, { shown, hidden }, box, lines = []) => page.evaluate(async ({ shown, hidden, box: { card, content }, lines }) => {
  const read = async (src) => {
    const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    return { d: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
  }
  const a = await read(shown), b = await read(hidden)
  const k = a.w / innerWidth
  const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  const out = { above: 0, under: 0, below: 0, left: 0, right: 0, inside: 0, changed: 0 }
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = (y * a.w + x) * 4
    if (Math.max(Math.abs(a.d[i] - b.d[i]), Math.abs(a.d[i + 1] - b.d[i + 1]), Math.abs(a.d[i + 2] - b.d[i + 2])) < 8) continue
    const px = (x + 0.5) / k, py = (y + 0.5) / k
    out.changed++
    if (px > content.left && px < content.right && py > content.top && py < content.bottom) out.inside++
    out.above = Math.max(out.above, Math.round(card.top - py))
    out.under = Math.max(out.under, Math.round(py - card.top))
    out.below = Math.max(out.below, Math.round(py - card.bottom))
    out.left = Math.max(out.left, Math.round(card.left - px))
    out.right = Math.max(out.right, Math.round(px - card.right))
  }
  // Each line: { at, axis: 'x'|'y', from, to } in CSS px: the position of
  // the darkest change along it, to a device px.
  out.lines = lines.map(({ at, axis, from, to }) => {
    let best = -1, where = null
    for (let t = Math.round(from * k); t <= Math.round(to * k); t++) {
      const x = axis === 'y' ? Math.round(at * k) : t, y = axis === 'y' ? t : Math.round(at * k)
      const i = (y * a.w + x) * 4, dark = luma(b.d, i) - luma(a.d, i)
      if (dark > best) { best = dark; where = (t + 0.5) / k }
    }
    return { at, axis, from, to, where, dark: Math.round(best) }
  })
  return out
}, { shown, hidden, box, lines })

/* Side by side, stacked weeks and one day: the same placement rules. */
for (const [width, height] of [[1440, 900], [1024, 768], [375, 812]]) {
  test(`at ${width}px the BEFORE strip sits on the top border, every copy in a row along it`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    await expect.poll(() => strips(page).count()).toBeGreaterThan(0)
    const { card, clips } = await page.locator(`${visible} [data-cal="before"]`).evaluate((card) => {
      const c = card.getBoundingClientRect()
      const clips = [...card.querySelectorAll(':scope > .mk-cal-water--before')].map((v) => {
        const r = v.getBoundingClientRect()
        return { left: r.left, right: r.right, width: r.width, edge: r.top + parseFloat(v.style.getPropertyValue('--water-edge')) * r.height }
      })
      return { card: { top: c.top, left: c.left, right: c.right, width: c.width }, clips }
    })
    // As many copies as the border needs at the strip's scale (1 to 4), in
    // a row along it: each one's edge row on the card's top border, the
    // first at its left end and the last at its right (one alone is
    // centred), every one inside the card's width, overlapping the next.
    const { places } = stripPlaces(card.width, clips[0].width)
    expect(clips).toHaveLength(places.length)
    expect(places.length).toBeGreaterThanOrEqual(1)
    expect(places.length).toBeLessThanOrEqual(4)
    for (const [i, s] of clips.entries()) {
      expect(Math.abs(s.edge - card.top), `strip ${i} edge`).toBeLessThanOrEqual(1)
      expect(s.left).toBeGreaterThanOrEqual(card.left - 1.5)
      expect(s.right).toBeLessThanOrEqual(card.right + 1.5)
      if (i) expect(s.left).toBeLessThan(clips[i - 1].right)
    }
    const [first, last] = [clips[0], clips.at(-1)]
    if (places.length > 1) {
      expect(Math.abs(first.left - card.left)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(last.right - card.right)).toBeLessThanOrEqual(1.5)
    } else {
      expect(Math.abs((first.left - card.left) - (card.right - first.right))).toBeLessThanOrEqual(1.5)
    }
    await expect(strips(page).first()).toHaveCSS('mix-blend-mode', 'multiply')
  })

  test(`at ${width}px the splashes stay in a thin band over the BEFORE card's top border, clear of the content`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    await ready(page)
    // Not the card's business: the header (fixed over the page) and the
    // stream (where it meets the BEFORE card's top border, the splashes
    // multiply over it, so their faintest haze would count as a change).
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; } .mk-day-stream { display: none; }' })
    await bring(page, 'before', 'top')
    const top = await footprint(page, await shots(page, `${visible} .mk-cal-water--before`), await cardBox(page, 'before'))
    expect(top.changed).toBeGreaterThan(0)
    expect(top.inside).toBe(0)
    expect(top.above).toBeLessThanOrEqual(width < 720 ? 15 : 16)
    expect(top.under).toBeLessThanOrEqual(5)
    expect(top.left).toBeLessThanOrEqual(1)
    expect(top.right).toBeLessThanOrEqual(1)
  })

  test(`at ${width}px the AFTER rim's line of water is on the card's border, nothing inside its content box, the stream landing at its x`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(HOME, { waitUntil: 'load' })
    await toCalendar(page)
    await ready(page)
    await page.addStyleTag({ content: '.mk-header { visibility: hidden; }' })
    const k = await rim(page).evaluate(r => parseFloat(getComputedStyle(r).getPropertyValue('--rim-k')))
    // The streams' pieces are centred on the page stream's x.
    const x = await page.evaluate(({ sx }) => {
      const s = document.querySelector('.mk-day-stream').getBoundingClientRect()
      const piece = k => document.querySelector(`.mk-rim-piece[data-piece="${k}"]`)
      const centre = el => { const r = el.getBoundingClientRect(); return (r.left + r.right) / 2 }
      return { stream: s.left + sx * s.width, in: centre(piece('in')), out: centre(piece('out')) }
    }, { sx: media.stream.x })
    expect(Math.abs(x.in - x.stream), 'stream in on the page stream').toBeLessThanOrEqual(1)
    expect(Math.abs(x.out - x.stream), 'stream out under it').toBeLessThanOrEqual(1)

    for (const edge of ['top', 'bottom']) {
      await bring(page, 'after', edge)
      const box = await cardBox(page, 'after'), { card } = box
      // Lines across the border, clear of the corners and the streams.
      const span = [card.left + 40, card.right - 40].filter(v => Math.abs(v - x.stream) > 50)
      const across = edge === 'top' ? card.top : card.bottom
      const lines = [
        ...span.map(at => ({ at, axis: 'y', from: across - 8, to: across + 8 })),
        { at: (card.top + card.bottom) / 2 + (edge === 'top' ? -150 : 150), axis: 'x', from: card.left - 8, to: card.left + 8 },
        { at: (card.top + card.bottom) / 2 + (edge === 'top' ? -150 : 150), axis: 'x', from: card.right - 8, to: card.right + 8 },
      ].filter(l => l.axis === 'y' || (l.at > 20 && l.at < height - 20))
      const f = await footprint(page, await shots(page, `${visible} .mk-rim video`), box, lines)
      test.info().annotations.push({ type: 'rim', description: JSON.stringify({ width, edge, ...f, card }) })
      expect(f.changed).toBeGreaterThan(0)
      // Nothing inside the content box.
      expect(f.inside, 'pixels changed inside the content box').toBe(0)
      // The rim's outer line (the darkest of its water) is on the border:
      // the border's own 1px, its centre half a px in from the box.
      for (const l of f.lines) {
        const border = l.axis === 'y' ? (Math.abs(l.from + 8 - card.top) < 1 ? card.top + 0.5 : card.bottom - 0.5) : (Math.abs(l.from + 8 - card.left) < 1 ? card.left + 0.5 : card.right - 0.5)
        expect(l.dark, `a line of water at ${JSON.stringify(l)}`).toBeGreaterThan(30)
        expect(Math.abs(l.where - border), `on the border at ${JSON.stringify(l)}`).toBeLessThanOrEqual(1)
      }
      // A thin band round the border: a few px outside the sides; the
      // streams' pieces above and below.
      expect(f.left).toBeLessThanOrEqual(Math.ceil(RIM.out * k) + 1)
      expect(f.right).toBeLessThanOrEqual(Math.ceil(RIM.out * k) + 1)
      expect(f.above).toBeLessThanOrEqual(Math.ceil(RIM.above * k) + 1)
      expect(f.below).toBeLessThanOrEqual(Math.ceil(RIM.below * k) + 1)
      if (edge === 'bottom') expect(f.below, 'the stream leaving below').toBeGreaterThan(20)
    }

    // The stream lands on the card visibly above the border: on screen, the
    // column at the stream's x is water all the way down to the border, and
    // the rim's own water reaches up over it (where the stream meets the
    // rim it swells into a clear bulb, its dark edges either side of the
    // page stream's).
    await bring(page, 'after', 'top')
    const { card } = await cardBox(page, 'after')
    const top = await footprint(page, await shots(page, `${visible} .mk-rim video`), await cardBox(page, 'after'), [{ at: x.stream, axis: 'y', from: card.top - 40, to: card.top }])
    expect(top.above, 'the rim\'s water over the top border').toBeGreaterThanOrEqual(5)
    const column = await page.evaluate(async ({ x, top, shot }) => {
      const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
      const k = c.width / innerWidth, rows = []
      for (let y = top - 40; y <= top - 1; y += 3) {
        const d = ctx.getImageData(Math.round((x - 16) * k), Math.round(y * k), Math.round(32 * k), 1).data
        let min = 255
        for (let i = 0; i < d.length; i += 4) min = Math.min(min, 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
        rows.push(Math.round(min))
      }
      return rows
    }, { x: x.stream, top: card.top, shot: (await shots(page, '.mk-none')).shown })
    for (const [i, v] of column.entries()) expect(v, `water ${40 - 3 * i}px above the border`).toBeLessThan(235)

    // The clips never widen the page.
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
    await expect(page.locator('.mk-cal-water, .mk-rim')).toHaveCount(0)
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
    await expect(page.locator('.mk-cal-water, .mk-rim')).toHaveCount(0)
    expect(requests).toEqual([])
  })
})

test('what places the clips comes from media.json', async ({ page }) => {
  await page.goto(HOME, { waitUntil: 'load' })
  const data = JSON.parse(await page.locator('[data-day]').getAttribute('data-water'))
  expect(data.before).toMatchObject(media.cards.before)
  expect(data.rim).toMatchObject(media.cards.rim)
  expect(data.stream).toMatchObject({ x: media.stream.x, width: media.stream.width })
  expect(Object.keys(data).sort()).toEqual(['before', 'rim', 'stream'])
})
