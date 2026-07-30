import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
import fs from 'fs'

config({ path: '.env.local' })

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const APP_PORT = new URL(APP_URL).port || '3001'
const AUTH_FILE = 'e2e/.auth/owner.json'
const HAS_AUTH  = fs.existsSync(AUTH_FILE)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup/global-setup',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Publikus oldalak és API tesztek — nincs bejelentkezés
    {
      name: 'api',
      testMatch: ['**/api.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth',
      testMatch: ['**/auth.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public',
      testMatch: ['**/public.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Dashboard — mentett owner auth állapottal
    {
      name: 'dashboard',
      testMatch: ['**/dashboard.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        ...(HAS_AUTH ? { storageState: AUTH_FILE } : {}),
      },
    },
  ],
  webServer: {
    command: `cross-env NODE_OPTIONS='--max-old-space-size=4096' next dev -p ${APP_PORT}`,
    url: APP_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
