/**
 * Publikus oldal E2E tesztek — foglalási wizard, szalon/étterem nyilvános oldalak.
 * Nincs bejelentkezés. A legfontosabb: a vendég le tudja adni a foglalást.
 */
import { test, expect } from './fixtures'

const BASE          = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const SALON_SLUG    = process.env.E2E_TEST_SALON_SLUG ?? ''
const RESTAURANT_SLUG = process.env.E2E_TEST_RESTAURANT_SLUG ?? ''

// ── Szalon nyilvános oldal ─────────────────────────────────────────────────────

test.describe('Szalon nyilvános oldal', () => {
  test.skip(() => !SALON_SLUG, 'E2E_TEST_SALON_SLUG nincs beállítva')

  test('oldal betölt, van cím', async ({ page }) => {
    await page.goto(`${BASE}/${SALON_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('h1').first()).toBeAttached({ timeout: 8_000 })
  })

  test('van og:title meta tag', async ({ page }) => {
    await page.goto(`${BASE}/${SALON_SLUG}`)
    const og = await page.locator('meta[property="og:title"]').getAttribute('content')
    expect(og).toBeTruthy()
  })
})

// ── Szalon foglalás wizard ─────────────────────────────────────────────────────

test.describe('Szalon foglalás wizard', () => {
  test.skip(() => !SALON_SLUG, 'E2E_TEST_SALON_SLUG nincs beállítva')

  test('/book oldal betölt, wizard első lépése látható', async ({ page }) => {
    await page.goto(`${BASE}/${SALON_SLUG}/book`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    // Bármilyen interaktív elem megjelenik (gomb, kártya, heading)
    await expect(page.locator('button, h1, h2, h3').first()).toBeVisible({ timeout: 10_000 })
  })

  test('legalább egy szolgáltatás kártya megjelenik', async ({ page }) => {
    await page.goto(`${BASE}/${SALON_SLUG}/book`)
    await page.waitForLoadState('networkidle')
    // Legalább egy kattintható kártya/gomb a szolgáltatás-listában
    const cards = page.locator('button, [role="button"]').filter({ hasNotText: /vissza|back|close|bezár/i })
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('vissza gomb az első lépésen visszavisz a szalon oldalra', async ({ page }) => {
    await page.goto(`${BASE}/${SALON_SLUG}/book`)
    await page.waitForLoadState('domcontentloaded')
    const backBtn = page.getByRole('link', { name: /vissza|back/i }).first()
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click()
      await expect(page).toHaveURL(new RegExp(SALON_SLUG), { timeout: 5_000 })
    }
  })
})

// ── Étterem nyilvános oldal ────────────────────────────────────────────────────

test.describe('Étterem nyilvános oldal', () => {
  test.skip(() => !RESTAURANT_SLUG, 'E2E_TEST_RESTAURANT_SLUG nincs beállítva')

  test('oldal betölt, van cím', async ({ page }) => {
    await page.goto(`${BASE}/${RESTAURANT_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('h1').first()).toBeAttached({ timeout: 8_000 })
  })

  test('/book oldal betölt, tartalom megjelenik', async ({ page }) => {
    await page.goto(`${BASE}/${RESTAURANT_SLUG}/book`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('button, h1, h2, h3').first()).toBeVisible({ timeout: 10_000 })
  })
})

// ── Mobil viewport ─────────────────────────────────────────────────────────────

test.describe('Mobil — publikus oldalak', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('szalon oldal mobilon betölt', async ({ page }) => {
    test.skip(!SALON_SLUG, 'E2E_TEST_SALON_SLUG nincs beállítva')
    await page.goto(`${BASE}/${SALON_SLUG}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('/book wizard mobilon betölt', async ({ page }) => {
    test.skip(!SALON_SLUG, 'E2E_TEST_SALON_SLUG nincs beállítva')
    await page.goto(`${BASE}/${SALON_SLUG}/book`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})
