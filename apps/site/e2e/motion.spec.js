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
})

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

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })
  test('the hero poster loads, the stream is visible and the calendar shows its after state', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'load' })
    const poster = page.locator('.mk-hero-poster--after img')
    await expect.poll(() => poster.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-hero-state', 'after')
    const rail = page.locator('[data-rail]')
    expect(await rail.evaluate(el => getComputedStyle(el).getPropertyValue('--pour').trim())).toBe('100%')
    expect((await rail.boundingBox()).height).toBeGreaterThan(1000)
    const after = page.locator('.ui-tabs-panel:visible [data-day-after]')
    await expect(after).not.toHaveClass(/is-first/)
    await expect(after.locator('.blk--person').first()).toBeVisible()
  })
})
