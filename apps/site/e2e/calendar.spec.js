import { test, expect } from '@playwright/test'
import { routePath } from '@forge/seo/routes'
import forge from '@forge/manifest'
import { CATALOGS } from '@forge/i18n'

/* "A day, before and after": native-radio tabs that work with and without
   JavaScript, an illustration note on every tab in every language, and a
   final state that is the same whether or not the animation ran. */

const TEAMS = Object.keys(CATALOGS[forge.locales.default].home.day.teams)
const panel = page => page.locator('.mk-day .ui-tabs-panel:visible')

for (const js of [true, false]) {
  test.describe(js ? 'with JavaScript' : 'with JavaScript off', () => {
    test.use({ javaScriptEnabled: js })

    test('clicking a team shows its day; arrow keys move between teams', async ({ page }) => {
      await page.goto(routePath('home', forge.locales.default))
      const copy = CATALOGS[forge.locales.default].home.day
      await page.locator('.mk-day label', { hasText: copy.teams.logistics.name }).click()
      await expect(panel(page)).toHaveAttribute('data-value', 'logistics')
      await page.keyboard.press('ArrowLeft')
      await expect(panel(page)).toHaveAttribute('data-value', 'customerOps')
      await page.keyboard.press('ArrowRight')
      await expect(panel(page)).toHaveAttribute('data-value', 'logistics')
      await expect(panel(page)).toHaveCount(1)
    })
  })
}

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
    await page.goto(routePath('home', forge.locales.default))
    await page.locator('#day').scrollIntoViewIfNeeded()
    await page.locator('.mk-day label', { hasText: CATALOGS[forge.locales.default].home.day.teams.procurement.name }).click()
    await page.waitForTimeout(1800)
    const html = await panel(page).locator('[data-day-after]').evaluate(el => {
      const clone = el.cloneNode(true)
      clone.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'))
      return clone.outerHTML
    })
    await page.close()
    return html
  }
  expect(await snapshot(true)).toBe(await snapshot(false))
})
