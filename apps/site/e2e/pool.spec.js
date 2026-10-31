import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { publishedRoutes, routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'

/* The footer's pool: the water that has fallen down the page. Every page has
   its still poster as the footer's CSS background, with no JavaScript, and
   every page lays the looping clip over it (motion/footer.js), on the media
   tier only, once the footer is near: phones included. Asserted by state and geometry, and by
   the pixels under the footer's text: its contrast is measured on what is
   actually painted there. */

const media = JSON.parse(readFileSync(new URL('../src/media/media.json', import.meta.url), 'utf8'))
const HOME = routePath('home', forge.locales.default)
const isPoolClip = url => /footer-pool[^/]*\.(webm|mp4)(\?|$)/.test(url)
const isNarrow = url => /footer-pool-narrow[^/]*\.(avif|webp|webm|mp4)/.test(url)
// The footer's phone rendition (marketing.css) is served at this width and under.
const NARROW = 720
const isPoolPoster = url => /footer-pool[^/]*\.(avif|webp)(\?|$)/.test(url)
const toFooter = page => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
const SIZES = [[1440, 900], [1024, 768], [375, 812]]

/* One page of each kind, in every published language: the poster is CSS on
   the shared footer, so every page that renders it is covered by these. */
const KINDS = ['home', 'blog', 'contact', 'privacy', 'terms']

/** The footer painted with its text, rules and halo hidden, as a canvas the
    page can sample, plus every text box in it (relative to the footer) with
    its colour. */
async function underText(page) {
  const footer = page.locator('.mk-footer')
  const texts = await footer.evaluate((f) => {
    const box = f.getBoundingClientRect(), out = []
    const walker = document.createTreeWalker(f, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue
      const range = document.createRange(); range.selectNodeContents(n)
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue
        out.push({ text: n.textContent.trim(), color: getComputedStyle(n.parentElement).color, x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height })
      }
    }
    return out
  })
  // Inline styles outrank the stylesheet; each element's own is put back after.
  const kept = await footer.evaluate((f) => [f, ...f.querySelectorAll('*:not(video)')].map((el) => {
    const was = el.getAttribute('style')
    Object.assign(el.style, { color: 'transparent', textShadow: 'none', borderColor: 'transparent' })
    return was
  }))
  const shot = (await footer.screenshot()).toString('base64')
  await footer.evaluate((f, kept) => [f, ...f.querySelectorAll('*:not(video)')].forEach((el, i) => kept[i] === null ? el.removeAttribute('style') : el.setAttribute('style', kept[i])), kept)
  return { shot, texts }
}

/** For each text box: the contrast of its colour against the darkest 2% of
    the background pixels under it. */
function contrasts(page, { shot, texts }) {
  return page.evaluate(async ({ shot, texts }) => {
    const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const scale = img.naturalWidth / document.querySelector('.mk-footer').getBoundingClientRect().width
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return texts.map((t) => {
      const x = Math.round(t.x * scale), y = Math.round(t.y * scale), w = Math.max(1, Math.round(t.w * scale)), h = Math.max(1, Math.round(t.h * scale))
      const d = ctx.getImageData(x, y, w, h).data, ls = []
      for (let i = 0; i < d.length; i += 4) ls.push(L(d[i], d[i + 1], d[i + 2]))
      ls.sort((a, b) => a - b)
      const bg = ls[Math.floor(ls.length * 0.02)]
      const [r, g, b] = t.color.match(/\d+(\.\d+)?/g).map(Number), fg = L(r, g, b)
      return { text: t.text, ratio: +((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)).toFixed(2) }
    })
  }, { shot, texts })
}

test.describe('the poster, with JavaScript off', () => {
  for (const kind of KINDS) {
    test(`the ${kind} pages' footer is the pool's poster, and no video`, async ({ browser }) => {
      for (const route of publishedRoutes().filter(r => r.key === kind)) {
        // A fresh context per page, so the poster is fetched, not cached.
        const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL })
        const page = await context.newPage(), posters = []
        page.on('response', r => { if (isPoolPoster(r.url())) posters.push(r.status()) })
        await page.goto(route.path, { waitUntil: 'load' })
        const footer = page.locator('.mk-footer')
        await footer.scrollIntoViewIfNeeded()
        const css = await footer.evaluate(f => { const s = getComputedStyle(f); return { image: s.backgroundImage, size: s.backgroundSize, repeat: s.backgroundRepeat } })
        expect(css.image, route.path).toMatch(/footer-pool[^)]*\.(avif|webp)/)
        expect(css.size, route.path).toBe('cover')
        expect(css.repeat, route.path).toBe('no-repeat')
        await expect.poll(() => posters.length, { message: route.path }).toBeGreaterThan(0)
        expect(posters.every(s => s === 200), route.path).toBe(true)
        await expect(page.locator('video'), route.path).toHaveCount(0)
        // Every page hands the footer's script the clip.
        await expect(page.locator('[data-pool]'), route.path).toHaveCount(1)
        await context.close()
      }
    })
  }
})

for (const [width, height] of SIZES) {
  test(`at ${width}px the pool spans the viewport edge to edge, meets the page in white and keeps its text readable`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(routePath('contact', forge.locales.default), { waitUntil: 'load' })
    await toFooter(page)
    const box = await page.locator('.mk-footer').evaluate(f => { const r = f.getBoundingClientRect(); return { left: r.left, width: r.width, vw: document.documentElement.clientWidth } })
    expect(box.left).toBe(0)
    expect(box.width).toBe(box.vw)

    const painted = await underText(page)
    // Seamless: the footer's top row is the page's white, and the waterline
    // (the first row that is no longer white across the footer) is its top
    // edge: one flat line, under the water's colour from edge to edge.
    const rows = await page.evaluate(async (shot) => {
      const img = new Image(); img.src = `data:image/png;base64,${shot}`; await img.decode()
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
      const scale = img.naturalWidth / document.querySelector('.mk-footer').getBoundingClientRect().width
      const luma = (y) => { const d = ctx.getImageData(0, y, c.width, 1).data, l = []; for (let i = 0; i < d.length; i += 4) l.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); return l }
      const median = (l) => [...l].sort((a, b) => a - b)[l.length >> 1]
      let line = -1
      for (let y = 0; y < c.height; y++) if (median(luma(y)) < 245) { line = y; break }
      // Every column is under the white within a few rows of the line.
      const under = new Array(c.width).fill(false)
      for (let y = line; y < line + Math.ceil(6 * scale); y++) luma(y).forEach((v, x) => { if (v < 245) under[x] = true })
      return { top: Math.min(...luma(0)), waterline: line / scale, span: under.filter(Boolean).length / c.width, height: c.height / scale }
    }, painted.shot)
    // The rendition the width calls for: the band's centre on a phone.
    const poster = await page.locator('.mk-footer').evaluate(f => getComputedStyle(f).backgroundImage)
    expect(isNarrow(poster)).toBe(width <= NARROW)
    // The poster covers the footer from its top: it is drawn at the larger of
    // the width's and the height's scale, so the waterline lands at
    // media.json's fraction of that drawn height.
    const { waterline } = media.footer.pool
    const { aspect } = width <= NARROW ? media.footer.pool.narrow : media.footer.pool
    const drawn = Math.max(box.width / aspect, rows.height)
    expect(rows.top).toBeGreaterThanOrEqual(253)
    expect(Math.abs(rows.waterline - waterline * drawn)).toBeLessThanOrEqual(3)
    expect(rows.waterline).toBeGreaterThan(0)
    expect(rows.waterline).toBeLessThan(0.03 * drawn)
    expect(rows.span).toBe(1)

    // WCAG AA (4.5:1) for every piece of footer text, against the darkest 2%
    // of the water under it, without the halo.
    for (const { text, ratio } of await contrasts(page, painted)) expect(ratio, text).toBeGreaterThanOrEqual(4.5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('the clip is created only near the footer, covers the poster exactly, plays, keeps the text readable and pauses off screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = []
  page.on('request', r => { if (isPoolClip(r.url())) requests.push(r.url()) })
  await page.goto(HOME, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await expect(page.locator('.mk-footer-pool')).toHaveCount(0)
  expect(requests).toEqual([])

  await toFooter(page)
  const clip = page.locator('.mk-footer > video.mk-footer-pool')
  await expect(clip).toHaveCount(1)
  await expect(clip).toHaveAttribute('aria-hidden', 'true')
  await expect(clip).toHaveCSS('pointer-events', 'none')
  await expect.poll(() => clip.evaluate(v => !v.paused && v.currentTime > 0.5 && v.classList.contains('is-ready'))).toBe(true)
  expect(requests.length).toBeGreaterThan(0)
  // The full band, as the poster under it; its WebM says it is 10-bit AV1.
  expect(isNarrow(await clip.evaluate(v => v.currentSrc))).toBe(false)
  await expect(clip.locator('source[type^="video/webm"]')).toHaveAttribute('type', `video/webm; codecs="${media.footer.pool.av1}"`)

  // Placed exactly like the background: the footer's box, cover, the same position.
  const fit = await page.locator('.mk-footer').evaluate((f) => {
    const v = f.querySelector('.mk-footer-pool'), a = f.getBoundingClientRect(), b = v.getBoundingClientRect()
    const fs = getComputedStyle(f), vs = getComputedStyle(v)
    return { dx: Math.abs(a.left - b.left) + Math.abs(a.right - b.right), dy: Math.abs(a.top - b.top) + Math.abs(a.bottom - b.bottom), fit: vs.objectFit, at: vs.objectPosition, bg: fs.backgroundPosition }
  })
  expect(fit.dx).toBeLessThanOrEqual(1)
  expect(fit.dy).toBeLessThanOrEqual(1)
  expect(fit.fit).toBe('cover')
  expect(fit.at).toBe(fit.bg)
  // Unmasked: its top is the poster's own white and waterline.
  await expect(clip).toHaveCSS('mask-image', 'none')
  // Under the clip, the copy still paints on top of the water.
  const order = await page.locator('.mk-footer').evaluate((f) => {
    const a = f.querySelector('.mk-footer-col a'), v = f.querySelector('.mk-footer-pool')
    v.style.pointerEvents = 'auto'
    const r = a.getBoundingClientRect(), stack = document.elementsFromPoint(r.left + 4, r.top + r.height / 2)
    v.style.pointerEvents = ''
    return { link: stack.indexOf(a), clip: stack.indexOf(v) }
  })
  expect(order.link).toBeGreaterThan(-1)
  expect(order.link).toBeLessThan(order.clip)
  // The moving water keeps every piece of text at AA too.
  for (const { text, ratio } of await contrasts(page, await underText(page))) expect(ratio, text).toBeGreaterThanOrEqual(4.5)

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => clip.evaluate(v => v.paused)).toBe(true)
})

test('on a phone the clip is the band\'s centre, like the poster, and a resize across the query swaps it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(HOME, { waitUntil: 'load' })
  await toFooter(page)
  const clip = page.locator('.mk-footer > video.mk-footer-pool')
  await expect.poll(() => clip.evaluate(v => !v.paused && v.currentTime > 0.5 && v.classList.contains('is-ready'))).toBe(true)
  expect(isNarrow(await clip.evaluate(v => v.currentSrc))).toBe(true)
  expect(isNarrow(await page.locator('.mk-footer').evaluate(f => getComputedStyle(f).backgroundImage))).toBe(true)
  await expect(clip.locator('source[type^="video/webm"]')).toHaveAttribute('type', `video/webm; codecs="${media.footer.pool.narrow.av1}"`)
  // Covers the footer like its poster, and keeps the text readable.
  const fit = await page.locator('.mk-footer').evaluate((f) => {
    const a = f.getBoundingClientRect(), b = f.querySelector('.mk-footer-pool').getBoundingClientRect()
    return Math.abs(a.left - b.left) + Math.abs(a.right - b.right) + Math.abs(a.top - b.top) + Math.abs(a.bottom - b.bottom)
  })
  expect(fit).toBeLessThanOrEqual(2)
  for (const { text, ratio } of await contrasts(page, await underText(page))) expect(ratio, text).toBeGreaterThanOrEqual(4.5)

  // Wider than the query: the full band replaces it, still one clip.
  await page.setViewportSize({ width: 1024, height: 768 })
  await toFooter(page)
  await expect.poll(() => page.locator('.mk-footer > video.mk-footer-pool').evaluate(v => v.currentSrc)).toMatch(/footer-pool\.[^/]*\.(webm|mp4)/)
  await expect(page.locator('.mk-footer-pool')).toHaveCount(1)
})

/* Not only the home page: every page's footer moves, on a phone too. */
test.describe('on every page, on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
  for (const kind of ['useCases', 'blog', 'contact', 'privacy']) {
    test(`the ${kind} page's footer plays the phone clip`, async ({ page }) => {
      // A short page has its footer near from the start, so the clip may
      // load at once; the home page's test holds the laziness.
      await page.goto(routePath(kind, forge.locales.default), { waitUntil: 'load' })
      await toFooter(page)
      const clip = page.locator('.mk-footer > video.mk-footer-pool')
      await expect.poll(() => clip.evaluate(v => !v.paused && v.currentTime > 0.5 && v.classList.contains('is-ready'))).toBe(true)
      expect(isNarrow(await clip.evaluate(v => v.currentSrc))).toBe(true)
      await expect(page.locator('.mk-footer-pool')).toHaveCount(1)
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  test('the poster only', async ({ page }) => {
    const requests = []
    page.on('request', r => { if (isPoolClip(r.url())) requests.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await toFooter(page); await page.waitForTimeout(1200)
    await expect(page.locator('.mk-footer-pool')).toHaveCount(0)
    expect(requests).toEqual([])
  })
})

test.describe('Save-Data', () => {
  test('the poster only', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' } }))
    const requests = []
    page.on('request', r => { if (isPoolClip(r.url())) requests.push(r.url()) })
    await page.goto(HOME, { waitUntil: 'load' })
    await toFooter(page); await page.waitForTimeout(1200)
    await expect(page.locator('.mk-footer-pool')).toHaveCount(0)
    expect(requests).toEqual([])
  })
})
