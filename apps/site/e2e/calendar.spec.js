import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'

/* "A week, before and after": native-radio tabs that work with and without
   JavaScript; a week on desktop and one day on a phone, decided by CSS; an
   AFTER card holding only the kept tasks, in the same slots as BEFORE; an
   illustration note on every tab in every language; and a final state that
   is the same whether or not the animation ran. */

const HOME = routePath('home', forge.locales.default)
const COPY = CATALOGS[forge.locales.default].home.day
const TEAMS = Object.keys(COPY.teams)
const panel = page => page.locator('.mk-day .ui-tabs-panel:visible')
const card = (page, which) => panel(page).locator(`[data-cal="${which}"]`)
const visibleDays = locator => locator.locator('.mk-cal-day:visible')

/** Each task chip of a card: its id, day, kept flag and box relative to its card's grid. */
const chips = locator => locator.evaluate((cal) => {
  const grid = cal.querySelector('.mk-cal-grid').getBoundingClientRect()
  return [...cal.querySelectorAll('.mk-task')].map((el) => {
    const r = el.getBoundingClientRect()
    return {
      task: el.dataset.task,
      kept: el.dataset.kept,
      day: el.closest('.mk-cal-day').dataset.weekday,
      box: [r.left - grid.left, r.top - grid.top, r.width, r.height].map(Math.round).join(','),
    }
  })
})

for (const js of [true, false]) {
  test.describe(js ? 'with JavaScript' : 'with JavaScript off', () => {
    test.use({ javaScriptEnabled: js })

    test('clicking a team shows its week; arrow keys move between teams', async ({ page }) => {
      await page.goto(HOME)
      await page.locator('.mk-day label', { hasText: COPY.teams.logistics.name }).click()
      await expect(panel(page)).toHaveAttribute('data-value', 'logistics')
      await page.keyboard.press('ArrowLeft')
      await expect(panel(page)).toHaveAttribute('data-value', 'customerOps')
      await page.keyboard.press('ArrowRight')
      await expect(panel(page)).toHaveAttribute('data-value', 'logistics')
      await expect(panel(page)).toHaveCount(1)
    })

    test('a desktop shows the week: five day columns in each card', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(HOME)
      for (const which of ['before', 'after']) {
        await expect(visibleDays(card(page, which))).toHaveCount(5)
      }
      const names = await visibleDays(card(page, 'before')).locator('.mk-cal-dayname').allTextContents()
      expect(new Set(names.map(n => n.toLowerCase())).size).toBe(5)
    })

    test('a phone shows one day, with no sideways scroll', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto(HOME)
      for (const which of ['before', 'after']) {
        await expect(visibleDays(card(page, which))).toHaveCount(1)
        await expect(visibleDays(card(page, which))).toHaveAttribute('data-weekday', '0')
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    })
  })
}

test('BEFORE lists every task; AFTER keeps only the kept ones, in the same slots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(HOME)
  await page.locator('#day').scrollIntoViewIfNeeded()
  for (const id of TEAMS) {
    await page.locator('.mk-day label', { hasText: COPY.teams[id].name }).click()
    await expect(card(page, 'after').locator('.mk-task--ghost')).toHaveCount(0, { timeout: 4000 })
    const before = await chips(card(page, 'before'))
    const after = await chips(card(page, 'after'))
    expect(before.some(c => c.kept === 'false'), id).toBe(true)
    expect(after.length, id).toBeGreaterThan(0)
    expect(after.every(c => c.kept === 'true'), id).toBe(true)
    expect(after, id).toEqual(before.filter(c => c.kept === 'true'))
  }
})

for (const locale of forge.locales.published) {
  test(`the illustration note is visible on every tab in ${locale}`, async ({ page }) => {
    await page.goto(routePath('home', locale))
    const copy = CATALOGS[locale].home.day
    for (const id of TEAMS) {
      await page.locator('.mk-day label', { hasText: copy.teams[id].name }).click()
      await expect(panel(page).getByText(copy.note)).toBeVisible()
    }
  })
}

test('after the animation settles, the calendar matches the no-JS markup', async ({ browser }) => {
  const snapshot = async (javaScriptEnabled) => {
    const page = await browser.newPage({ javaScriptEnabled })
    await page.goto(HOME)
    await page.locator('#day').scrollIntoViewIfNeeded()
    await page.locator('.mk-day label', { hasText: COPY.teams.procurement.name }).click()
    // A team chosen with its AFTER card below the fold plays once the card is in view.
    await card(page, 'after').evaluate(el => el.scrollIntoView({ block: 'center' }))
    if (javaScriptEnabled) {
      // The animation really ran: the AFTER card briefly holds the eliminated tasks.
      await expect(card(page, 'after').locator('.mk-task--ghost').first()).toBeAttached()
    }
    await expect(card(page, 'after').locator('.mk-task--ghost')).toHaveCount(0, { timeout: 4000 })
    const html = await panel(page).evaluate(el => el.outerHTML)
    await page.close()
    return html
  }
  expect(await snapshot(true)).toBe(await snapshot(false))
})

/* Regression: the animation started when a quarter of the whole section was
   visible, while the AFTER card (its second half) was still below the fold,
   so nobody saw it. It must start only once the AFTER card is on screen. */
test('the AFTER card empties itself while it is on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(routePath('home', forge.locales.default), { waitUntil: 'load' })
  await page.evaluate(() => {
    window.__ghostAt = null
    new MutationObserver(() => {
      if (window.__ghostAt !== null) return
      const ghost = document.querySelector('.mk-task--ghost')
      if (!ghost) return
      const card = ghost.closest('[data-cal="after"]').getBoundingClientRect()
      window.__ghostAt = { top: card.top, bottom: card.bottom, vh: window.innerHeight }
    }).observe(document.body, { childList: true, subtree: true })
  })
  const target = await page.evaluate(() => document.querySelector('[data-day]').getBoundingClientRect().top + window.scrollY + 2000)
  for (let y = 0; y <= target; y += 120) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(40) }
  await expect.poll(() => page.evaluate(() => window.__ghostAt)).not.toBeNull()
  const at = await page.evaluate(() => window.__ghostAt)
  expect(at.top).toBeLessThan(at.vh * 0.75)
})
