import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

// A globális árazás (pricing-settings global) frissítése a backstage-ből — admin-only.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const data: Record<string, number> = {}
  // Csak érvényes, nem-negatív egészeket fogadunk el. Az árak + próbanapok bármekkorák lehetnek,
  // az éves kedvezmény (%) 0–100 közé szorítva.
  const keys = [
    'salon_pro_huf',
    'salon_extra_staff_huf',
    'restaurant_pro_huf',
    'annual_discount_pct',
    'trial_days',
  ] as const
  for (const key of keys) {
    const v = Number(body[key])
    if (!Number.isFinite(v) || v < 0) continue
    data[key] = key === 'annual_discount_pct' ? Math.min(100, Math.round(v)) : Math.round(v)
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nincs érvényes mező' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const updated = await payload.updateGlobal({ slug: 'pricing-settings', data, overrideAccess: true })

  return NextResponse.json({ ok: true, pricing: updated })
}
