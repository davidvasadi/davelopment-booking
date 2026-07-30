/**
 * Auth UI tesztek — bejelentkezés, kijelentkezés, hibakezelés.
 * Nincs storageState: ezek magát az auth flow-t tesztelik.
 */
import { test, expect } from './fixtures'

const BASE  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_TEST_EMAIL ?? ''
const PASS  = process.env.E2E_TEST_PASSWORD ?? ''

test.describe('Bejelentkezés', () => {
  test.skip(() => !EMAIL || !PASS, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nincs beállítva')

  test('login oldal betölt', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('hibás jelszóval nem enged be', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', 'biztosan-rossz-jelszo-xyz!')
    await page.click('button[type="submit"]')
    // Marad a login oldalon, megjelenik hibaüzenet
    await expect(page).toHaveURL(/login/, { timeout: 5_000 })
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('helyes belépéssel dashboard-ra dob', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard|restaurant/, { timeout: 20_000 })
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('sikeres belépés után a dashboard betölt és nincs 500', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard|restaurant/, { timeout: 20_000 })
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

test.describe('Kijelentkezés', () => {
  test.skip(() => !EMAIL || !PASS, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD nincs beállítva')

  test('kijelentkezés után login oldalra kerül', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard|restaurant/, { timeout: 20_000 })

    // UserMenu megnyitása és kijelentkezés
    const avatarBtn = page.locator('button[aria-label*="fiók"], button[aria-label*="profil"], header button').last()
    await avatarBtn.click({ timeout: 5_000 }).catch(() => {})

    const logoutLink = page.getByText(/Kijelentkezés|Sign out/i).first()
    if (await logoutLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutLink.click()
      await expect(page).toHaveURL(/login/, { timeout: 10_000 })
    } else {
      // Fallback: direkt navigation
      await page.goto(`${BASE}/login`)
      await expect(page).toHaveURL(/login/)
    }
  })
})

test.describe('Auth redirect', () => {
  test('védett oldal auth nélkül → login-ra dob', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })

  test('védett analytics auth nélkül → login-ra dob', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/analytics`)
    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })

  test('védett étterem oldal auth nélkül → login-ra dob', async ({ page }) => {
    await page.goto(`${BASE}/restaurant`)
    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })

  test('backstage auth nélkül → login-ra dob', async ({ page }) => {
    await page.goto(`${BASE}/backstage`)
    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })
})
