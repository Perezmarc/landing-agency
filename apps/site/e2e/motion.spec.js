import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The landing page's motion, asserted by STATE, never by pixels: Playwright's
   Chromium has no H.264 and headless WebGL is unreliable, so these check the
   data attributes and requests the motion code drives.

   THE CSP HARNESS. `astro preview` sends no headers, so the policy from
   vercel.json is injected into every document response. A violation (an
   inline script, a blocked media file) is a console error, which fails the
   test. */

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const CSP = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value
const HOME = routePath('home', forge.locales.default)
const isMedia = url => /\.(webm|mp4)(\?|$)/.test(url)

async function withCsp(page) {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue()
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': CSP } })
  })
  const violations = []
  page.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()) })
  return violations
}

const heroState = page => page.locator('[data-hero]').getAttribute('data-hero-state')

/** Which hero headline line is black: 'lead', 'main', or null mid-fade. */
const blackLine = page => page.evaluate(() => {
  const probe = document.createElement('i'); probe.style.color = 'var(--ink)'; document.body.append(probe)
  const ink = getComputedStyle(probe).color; probe.remove()
  const color = sel => getComputedStyle(document.querySelector(sel)).color
  const lead = color('.mk-hero-line--lead') === ink, main = color('.mk-hero-line--main') === ink
  return lead !== main ? (lead ? 'lead' : 'main') : null
})

/** The BEFORE layer's computed opacity: '1' shows the rough rock. */
const beforeOpacity = page => page.locator('[data-hero-before]').evaluate(el => getComputedStyle(el).opacity)

/** A video's playhead, twice, 300ms apart. */
const playhead = (page, sel) => page.evaluate(async (sel) => {
  const v = document.querySelector(sel)
  if (!v) return null
  const a = v.currentTime; await new Promise(r => setTimeout(r, 300))
  return { paused: v.paused, moved: v.currentTime !== a, ready: v.classList.contains('is-ready') }
}, sel)

test.describe('motion, with the production CSP', () => {
  test('scrolling top → bottom → top raises no CSP violation', async ({ page }) => {
    const violations = await withCsp(page)
    await page.goto(HOME, { waitUntil: 'load' })
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y <= height; y += 700) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(80) }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
    expect(violations).toEqual([])
  })

  test('the scripts stay inside the 30 KB gzip budget', async ({ page }) => {
    const scripts = []
    page.on('response', async (r) => { if (r.request().resourceType() === 'script') scripts.push(r) })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.mouse.wheel(0, 120); await page.waitForTimeout(1500)
    let total = 0
    for (const r of scripts) total += gzipSync(await r.body()).length
    expect(total).toBeLessThanOrEqual(30 * 1024)
  })

  test('scrolling 100px crashes into after; back at the top it reassembles into before', async ({ page }) => {
    await withCsp(page)
    await page.goto(HOME, { waitUntil: 'load' })
    await expect.poll(() => heroState(page)).toBe('before')
    await page.evaluate(() => window.scrollTo(0, 100))
    await expect.poll(() => heroState(page), { timeout: 8000 }).toBe('after')
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => heroState(page), { timeout: 4000 }).toBe('before')
  })

  test('a hash link boots straight into after, with no burst', async ({ page }) => {
    await page.goto(`${HOME}#how`, { waitUntil: 'load' })
    await expect.poll(() => heroState(page)).toBe('after')
  })

  test('the headline line that is black follows the image: the first over the rock, the second over the crystal', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' })
    await expect.poll(() => heroState(page)).toBe('before')
    await expect.poll(() => blackLine(page)).toBe('lead')
    await page.evaluate(() => window.scrollTo(0, 100))
    await expect.poll(() => heroState(page), { timeout: 8000 }).toBe('after')
    await expect.poll(() => blackLine(page)).toBe('main')
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => blackLine(page), { timeout: 4000 }).toBe('lead')
  })

  test('the stage stays pinned for a screen and a half, so the crash plays in view', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' })
    const { pin, vh } = await page.evaluate(() => ({
      pin: document.querySelector('.mk-hero').offsetHeight - document.querySelector('.mk-hero-stage').offsetHeight,
      vh: window.innerHeight,
    }))
    expect(pin).toBeGreaterThanOrEqual(1.4 * vh)
    await expect.poll(() => heroState(page)).toBe('before')
    // A scroll of a whole screen is still inside the pin: the stage has not
    // moved, and the jump is not a skip: it crashes rather than snapping.
    const states = await page.evaluate(async () => {
      const hero = document.querySelector('[data-hero]'), seen = []
      new MutationObserver(() => seen.push(hero.dataset.heroState)).observe(hero, { attributeFilter: ['data-hero-state'] })
      window.scrollTo(0, window.innerHeight)
      await new Promise(r => setTimeout(r, 300))
      return seen
    })
    expect(states[0]).toBe('crashing')
    expect(await page.locator('.mk-hero-stage').evaluate(s => Math.round(s.getBoundingClientRect().top))).toBe(0)
  })
})

/* iOS Safari, emulated in Chromium: no frame callback, `preload` and load()
   ignored (nothing is fetched until play()), a clamped core count, no
   deviceMemory, a touch screen. The crash must still play the clip, and end
   on a playing AFTER loop. */
test.describe('on an iPhone-like browser', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  test('the crash clip plays and the AFTER loop keeps playing after it', async ({ page }) => {
    await page.addInitScript(() => {
      delete HTMLVideoElement.prototype.requestVideoFrameCallback
      Object.defineProperty(HTMLMediaElement.prototype, 'preload', { configurable: true, get() { return 'none' }, set() { this.setAttribute('preload', 'none') } })
      HTMLMediaElement.prototype.load = function () {}
      Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { configurable: true, get: () => 2 })
      Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => undefined })
    })
    await page.goto(HOME, { waitUntil: 'load' })
    await expect.poll(() => heroState(page)).toBe('before')
    await expect(page.locator('video.mk-hero-transition')).toHaveCount(1)
    await page.evaluate(() => window.scrollTo(0, 100))
    // The clip is on screen and its playhead moves.
    await expect.poll(() => page.locator('[data-hero]').getAttribute('class'), { timeout: 3000 }).toContain('is-transitioning')
    await expect.poll(async () => (await playhead(page, 'video.mk-hero-transition'))?.moved).toBe(true)
    await expect.poll(() => heroState(page), { timeout: 8000 }).toBe('after')
    // And the AFTER loop is playing, not a still.
    await expect.poll(() => playhead(page, 'video.mk-hero-video--after')).toEqual({ paused: false, moved: true, ready: true })
  })
})

/* Regression: pause() while a play() is still pending rejects that promise
   with AbortError. Treating it as a refusal deleted the loop for the rest of
   the visit, so back at the top the rock was a still. Slow the BEFORE clip so
   its play() is still pending when the crash pauses it. */
test('a loop whose play() is cut short by a pause is kept, and plays again later', async ({ page }) => {
  await page.route(/hero-before-[^/]*\.(webm|mp4)/, async (route) => {
    await new Promise(r => setTimeout(r, 2500)); await route.continue()
  })
  await page.goto(HOME, { waitUntil: 'load' })
  await expect.poll(() => heroState(page)).toBe('before')
  await expect(page.locator('video.mk-hero-video--before')).toHaveCount(1)
  await page.evaluate(() => window.scrollTo(0, 100))
  await expect.poll(() => heroState(page), { timeout: 8000 }).toBe('after')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => heroState(page), { timeout: 4000 }).toBe('before')
  await expect(page.locator('video.mk-hero-video--before')).toHaveCount(1)
  await expect.poll(async () => (await playhead(page, 'video.mk-hero-video--before'))?.moved, { timeout: 8000 }).toBe(true)
})

/* Short landscape screens (a phone on its side, a small laptop window): the
   stage is sticky and clips, so copy that overflows it can never be scrolled
   to. Every line and both buttons must sit between the header and the stage
   bottom. */
for (const [width, height] of [[844, 390], [667, 375], [1280, 600]]) {
  test(`the hero copy fits a ${width}x${height} screen in every language`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    for (const locale of forge.locales.published) {
      await page.goto(routePath('home', locale), { waitUntil: 'load' })
      const box = await page.evaluate(() => {
        const header = document.querySelector('header').getBoundingClientRect().bottom
        const copy = document.querySelector('.mk-hero-copy')
        const first = copy.firstElementChild.getBoundingClientRect().top
        const last = copy.querySelector('.mk-hero-actions').getBoundingClientRect().bottom
        return { header, first, last, stage: document.querySelector('.mk-hero-stage').getBoundingClientRect().bottom }
      })
      expect(box.first, locale).toBeGreaterThanOrEqual(box.header)
      expect(box.last, locale).toBeLessThanOrEqual(box.stage)
    }
  })
}

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('no video and no media requests', async ({ page }) => {
    const media = []
    page.on('request', r => { if (isMedia(r.url())) media.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.mouse.wheel(0, 200); await page.waitForTimeout(1200)
    await expect(page.locator('video')).toHaveCount(0)
    expect(media).toEqual([])
  })
})

test.describe('Save-Data', () => {
  test('no media requests', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }))
    const media = []
    page.on('request', r => { if (isMedia(r.url())) media.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(1200)
    expect(media).toEqual([])
  })
})

test('before the motion module runs, the hero shows the rough rock, never the polished pebble', async ({ page }) => {
  // Hold the one script back: what is on screen then is the first paint.
  await page.route(/\.js(\?|$)/, route => route.abort())
  await page.goto(HOME, { waitUntil: 'load' })
  await expect(page.locator('[data-hero]')).not.toHaveAttribute('data-hero-state')
  expect(await beforeOpacity(page)).toBe('1')
  expect(await blackLine(page)).toBe('lead')
  // The pebble still loads underneath, ready for the crash.
  await expect.poll(() => page.locator('.mk-hero-poster--after img').evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.mk-hero-poster--before img').evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0)
})

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })
  test('the hero poster loads, no video is in the HTML and the calendar shows its after state', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' })
    const poster = page.locator('.mk-hero-poster--after img')
    await expect.poll(() => poster.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    await expect(page.locator('[data-hero]')).not.toHaveAttribute('data-hero-state')
    await expect.poll(() => beforeOpacity(page)).toBe('0')
    await expect.poll(() => blackLine(page)).toBe('main')
    // Every clip is created by motion/; the server HTML is posters only.
    await expect(page.locator('video')).toHaveCount(0)
    const after = page.locator('.ui-tabs-panel:visible [data-cal="after"]')
    await expect(after.locator('.mk-task--ghost')).toHaveCount(0)
    await expect(after.locator('.mk-task[data-kept="false"]')).toHaveCount(0)
    await expect(after.locator('.mk-task[data-kept="true"]').first()).toBeVisible()
  })
})
