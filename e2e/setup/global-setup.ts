import { chromium, type FullConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import fs from 'fs'
import path from 'path'

loadEnv({ path: '.env.local' })

const BASE  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_TEST_EMAIL ?? ''
const PASS  = process.env.E2E_TEST_PASSWORD ?? ''

export default async function globalSetup(_: FullConfig) {
  if (!EMAIL || !PASS) {
    console.warn('[global-setup] E2E_TEST_EMAIL / E2E_TEST_PASSWORD nincs beállítva — auth tesztek kihagyva')
    return
  }

  const authDir = path.join(process.cwd(), 'e2e/.auth')
  fs.mkdirSync(authDir, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page    = await context.newPage()

  // Onboarding modal elnyomása: minden oldalbetöltés előtt lefut
  await page.addInitScript(() => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('davelopment_onboarding_seen_')) return '1'
      return orig.call(this, key)
    }
  })

  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard|restaurant/, { timeout: 30_000 })

  // User ID lekérdezése → localStorage kulcs beállítása a storageState-be
  const meRes = await page.request.get(`${BASE}/api/me`)
  if (meRes.ok()) {
    const me = await meRes.json().catch(() => ({}))
    const uid = String(me?.id ?? '')
    if (uid) {
      await page.evaluate((id: string) => {
        localStorage.setItem(`davelopment_onboarding_seen_salon_${id}`, '1')
        localStorage.setItem(`davelopment_onboarding_seen_restaurant_${id}`, '1')
      }, uid)
    }
  }

  await context.storageState({ path: path.join(authDir, 'owner.json') })
  await browser.close()
}
