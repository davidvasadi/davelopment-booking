import { test as base, type Page } from '@playwright/test'

// Minden tesztnél elnyomja az onboarding modalt (localStorage patch)
async function suppressOnboarding(page: Page) {
  await page.addInitScript(() => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key.startsWith('davelopment_onboarding_seen_')) return '1'
      return orig.call(this, key)
    }
  })
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await suppressOnboarding(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
