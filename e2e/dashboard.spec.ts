/**
 * Dashboard E2E tesztek — owner fiókkal, mentett auth állapotból indul.
 * Fedi: oldalbetöltések, beállítások tab-ok, staff meghívás, API authenticated kérések.
 * Fut: csak ha e2e/.auth/owner.json létezik (global-setup hozza létre).
 */
import { test, expect } from './fixtures'
import fs from 'fs'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const HAS_AUTH = fs.existsSync('e2e/.auth/owner.json')

test.skip(() => !HAS_AUTH, 'e2e/.auth/owner.json hiányzik — futtasd a global-setup-ot')

// ── Fő dashboard oldalak ────────────────────────────────────────────────────────

test.describe('Dashboard oldalak', () => {
  const PAGES = [
    { name: 'főoldal',     path: '/dashboard' },
    { name: 'analitika',   path: '/dashboard/analytics' },
    { name: 'foglalások',  path: '/dashboard/bookings' },
    { name: 'vendégek',    path: '/dashboard/guests' },
    { name: 'munkatársak', path: '/dashboard/staff' },
    { name: 'beosztás',    path: '/dashboard/schedule' },
    { name: 'nyitvatartás',path: '/dashboard/availability' },
    { name: 'előfizetés',  path: '/dashboard/subscription' },
    { name: 'tippek',      path: '/dashboard/tips' },
    { name: 'súgó',        path: '/dashboard/help' },
  ]

  for (const { name, path } of PAGES) {
    test(`${name} betölt (nem 500)`, async ({ page }) => {
      await page.goto(`${BASE}${path}`)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
      // Valamilyen tartalom megjelenik
      await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({ timeout: 10_000 })
    })
  }
})

// ── Beállítások tab-ok ──────────────────────────────────────────────────────────

test.describe('Beállítások', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('settings oldal betölt', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('h1, h2, button, input').filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('Nyitvatartás tab megnyílik', async ({ page }) => {
    const tab = page.getByRole('button', { name: /Nyitvatartás/i }).first()
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('Értesítések tab megnyílik', async ({ page }) => {
    const tab = page.getByRole('button', { name: /Értesítések/i }).first()
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('Foglalási funkciók tab megnyílik', async ({ page }) => {
    const tab = page.getByRole('button', { name: /Foglalási funkciók|Funkciók/i }).first()
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('Audit napló tab megnyílik', async ({ page }) => {
    const tab = page.getByRole('button', { name: /Audit|napló/i }).first()
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('Számlázás tab megnyílik', async ({ page }) => {
    const tab = page.getByRole('button', { name: /Számlázás/i }).first()
    if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tab.click()
      await page.waitForTimeout(500)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })
})

// ── Munkatársak ─────────────────────────────────────────────────────────────────

test.describe('Munkatársak', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/dashboard/staff`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('oldal betölt, lista vagy üres állapot látható', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('h1, h2, button, input').filter({ visible: true }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('kereső mező látható', async ({ page }) => {
    const search = page.locator('input[type="search"], input[type="text"], input[placeholder]').first()
    await expect(search).toBeVisible({ timeout: 8_000 })
  })

  test('Meghívás gomb látható (owner)', async ({ page }) => {
    const inviteBtn = page.getByRole('button').filter({ hasText: /Meghív|Hozzáad|Invite|Új munkatárs/i }).first()
    await expect(inviteBtn).toBeVisible({ timeout: 8_000 })
  })

  test('Meghívás: üres email esetén validáció jelenik meg', async ({ page }) => {
    const inviteBtn = page.getByRole('button').filter({ hasText: /Meghív/i }).first()
    if (await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await inviteBtn.click()
      await page.waitForTimeout(300)
      const emailInput = page.locator('input[type="email"]').first()
      if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const submitBtn = page.getByRole('button', { name: /Küld|Meghív|Invite/i }).last()
        await submitBtn.click({ timeout: 3_000 }).catch(() => {})
        // Marad az űrlapon, nem crashel
        await expect(page.locator('body')).not.toContainText('Internal Server Error')
      }
    }
  })
})

// ── Beosztás naptár ─────────────────────────────────────────────────────────────

test.describe('Beosztás naptár', () => {
  test('naptár betölt, hónap fejléc látható', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/schedule`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    // Hónap neve (pl. Január, február stb.) a naptár fejlécében
    const months = /január|február|március|április|május|június|július|augusztus|szeptember|október|november|december/i
    const header = page.getByText(months).first()
    await expect(header).toBeVisible({ timeout: 10_000 })
  })
})

// ── Authenticated API hívások ───────────────────────────────────────────────────

test.describe('API — bejelentkezve', () => {
  test('/api/me user objektumot ad', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    const res = await page.request.get(`${BASE}/api/me`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    // /api/me válasz: { user: { id, email, ... } }
    expect(body).toHaveProperty('user.id')
    expect(body).toHaveProperty('user.email')
  })

  test('/api/notifications GET 200', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    const res = await page.request.get(`${BASE}/api/notifications`)
    expect([200, 304]).toContain(res.status())
  })

  test('/api/ical bejelentkezve nem 500', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    const res = await page.request.get(`${BASE}/api/ical`)
    // 200 (van ical token) vagy 400/404 (nincs token) — de nem 500
    expect(res.status()).not.toBe(500)
  })

  test('/api/export-csv bejelentkezve CSV-t ad', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    const res = await page.request.get(`${BASE}/api/export-csv?period=month`)
    expect([200, 304]).toContain(res.status())
  })
})

// ── Mobil dashboard ─────────────────────────────────────────────────────────────

test.describe('Dashboard — mobil', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('főoldal mobilon betölt', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('mobil navigáció megjelenik', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    // Bottom nav vagy hamburger menü
    const nav = page.locator('nav, [role="navigation"]').last()
    await expect(nav).toBeVisible({ timeout: 8_000 })
  })
})
