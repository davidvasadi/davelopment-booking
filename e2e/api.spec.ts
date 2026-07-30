/**
 * API szintű tesztek — böngésző nélkül, request context-en keresztül.
 * Gyors (~5-10s), izolált, nincs UI-függőség.
 * Fedezi: auth guardok, input validáció, biztonsági fejlécek, rate limit, tokenek.
 */
import { test, expect } from '@playwright/test'

const BASE  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const SLUG  = process.env.E2E_TEST_SALON_SLUG ?? ''
const TOKEN = process.env.E2E_TEST_ICS_TOKEN ?? ''

// ── Auth guardok (minden védett route 401-et ad bejelentkezés nélkül) ──────────

test.describe('Auth guard', () => {
  const PROTECTED = [
    '/api/me',
    '/api/export-csv',
    '/api/notifications',
    '/api/ical',
  ]

  for (const route of PROTECTED) {
    test(`GET ${route} → 401`, async ({ request }) => {
      const res = await request.get(`${BASE}${route}`)
      expect(res.status()).toBe(401)
    })
  }

  test('POST /api/staff → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/staff`, {
      data: { name: 'Test', email: 'x@x.hu', salon: '1' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/subscription/select → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/subscription/select`, {
      data: { plan: 'pro' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/shifts → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/shifts`, {
      data: { staffId: '1', date: '2030-01-01', start_time: '09:00', end_time: '17:00' },
    })
    expect(res.status()).toBe(401)
  })
})

// ── Szalon foglalás validáció ───────────────────────────────────────────────────

test.describe('Szalon foglalás — input validáció', () => {
  const BASE_BODY = {
    salonId: '1', serviceId: '1', staffId: '1',
    date: '2030-06-15', start_time: '10:00', end_time: '11:00',
    customer_email: 'teszt@teszt.hu', customer_phone: '06301234567',
  }

  test('üres customer_name → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: '' },
    })
    expect(res.status()).toBe(400)
  })

  test('egybetűs customer_name → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: 'A' },
    })
    expect(res.status()).toBe(400)
  })

  test('érvénytelen email → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: 'Teszt Vendég', customer_email: 'nem-email' },
    })
    expect(res.status()).toBe(400)
  })

  test('múltbeli dátum → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: 'Teszt Vendég', date: '2020-01-01' },
    })
    expect(res.status()).toBe(400)
  })

  test('XSS script tag a névben → nem 500', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: '<script>alert(1)</script>' },
    })
    expect(res.status()).not.toBe(500)
    const body = await res.text()
    expect(body).not.toContain('<script>alert(1)</script>')
  })

  test('túl hosszú notes (>1000 kar) → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { ...BASE_BODY, customer_name: 'Teszt', notes: 'x'.repeat(1001) },
    })
    expect(res.status()).toBe(400)
  })
})

// ── Étterem foglalás validáció ──────────────────────────────────────────────────

test.describe('Étterem foglalás — input validáció', () => {
  test('negatív vendégszám → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/restaurant/reservations`, {
      data: { restaurantId: '1', date: '2030-06-15', time: '19:00', pax: -1, customer_email: 'x@x.hu', customer_name: 'X' },
    })
    expect(res.status()).toBe(400)
  })

  test('nulla vendégszám → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/restaurant/reservations`, {
      data: { restaurantId: '1', date: '2030-06-15', time: '19:00', pax: 0, customer_email: 'x@x.hu', customer_name: 'X' },
    })
    expect(res.status()).toBe(400)
  })

  test('50-nél több vendég → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/restaurant/reservations`, {
      data: { restaurantId: '1', date: '2030-06-15', time: '19:00', pax: 51, customer_email: 'x@x.hu', customer_name: 'X' },
    })
    expect(res.status()).toBe(400)
  })

  test('manage-reservation érvénytelen token → nem 200', async ({ request }) => {
    const res = await request.post(`${BASE}/api/restaurant/manage-reservation`, {
      data: { token: 'biztosan-nem-letezik-xyz999', action: 'confirm' },
    })
    expect(res.status()).not.toBe(200)
  })

  test('move-options auth nélkül → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/restaurant/move-options`)
    expect(res.status()).toBe(401)
  })
})

// ── Biztonsági fejlécek ─────────────────────────────────────────────────────────

test('biztonsági HTTP fejlécek megvannak', async ({ request }) => {
  const res = await request.get(`${BASE}/`)
  const h = res.headers()
  expect(h['x-frame-options'] ?? h['content-security-policy']).toBeTruthy()
})

// ── Rate limit ──────────────────────────────────────────────────────────────────

test('check-email 6 kísérlet után 429-et ad', async ({ request }) => {
  const statuses: number[] = []
  for (let i = 0; i < 6; i++) {
    const res = await request.post(`${BASE}/api/check-email`, {
      data: { email: `rate-limit-teszt-${i}@x.hu` },
    })
    statuses.push(res.status())
  }
  expect(statuses).toContain(429)
})

// ── ICS / naptár token ──────────────────────────────────────────────────────────

test.describe('ICS token', () => {
  test('érvénytelen token → 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ics/booking/biztosan-nem-letezik-token-xyz`)
    expect(res.status()).toBe(404)
  })

  test('érvényes token → text/calendar', async ({ request }) => {
    test.skip(!TOKEN, 'E2E_TEST_ICS_TOKEN nincs beállítva')
    const res = await request.get(`${BASE}/api/ics/booking/${TOKEN}`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/calendar')
  })
})

// ── Cron autentikáció ───────────────────────────────────────────────────────────

test.describe('Cron guard', () => {
  test('secret nélkül → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/notifications`)
    expect(res.status()).toBe(401)
  })

  test('rossz secret-tel → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/cron/notifications`, {
      headers: { Authorization: 'Bearer biztosan-rossz-secret' },
    })
    expect(res.status()).toBe(401)
  })
})

// ── Publikus SEO ────────────────────────────────────────────────────────────────

test.describe('SEO', () => {
  test('sitemap.xml elérhető', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`)
    expect([200, 304]).toContain(res.status())
  })

  test('robots.txt elérhető és nem 500', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`)
    expect(res.status()).not.toBe(500)
    if (res.status() === 200) {
      const body = await res.text()
      expect(body.toLowerCase()).toContain('user-agent')
    }
  })

  test(`salon nyilvános oldal nem 500 (${SLUG})`, async ({ request }) => {
    test.skip(!SLUG, 'E2E_TEST_SALON_SLUG nincs beállítva')
    const res = await request.get(`${BASE}/${SLUG}`)
    expect(res.status()).not.toBe(500)
  })
})
