/**
 * POST /api/auth/prepare-registration
 *
 * A kliens (regisztrációs wizard utolsó lépés) ezt hívja meg, MIELŐTT elindítja a
 * `signIn('google')`-t. A cégadatokat egy signed, HttpOnly cookie-ba tesszük (15 perc TTL).
 * Az OAuth-flow után a /api/auth/complete-registration olvassa ki és hozza létre a szalont/éttermet.
 *
 * Validáció:
 *   - role: 'salon_owner' | 'restaurant_owner'
 *   - placeName: 2+ karakter (salon/étterem neve)
 *   - ownerName: 2+ karakter
 *   - city, phone: opcionális (de ha megadták, sztring)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { setPendingRegistration } from '@/lib/pendingRegistration'

const schema = z.object({
  role: z.enum(['salon_owner', 'restaurant_owner']),
  ownerName: z.string().min(2, 'Add meg a neved'),
  placeName: z.string().min(2, 'Add meg a cég nevét'),
  city: z.string().optional(),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen adatok', details: parsed.error.flatten() }, { status: 400 })
  }
  await setPendingRegistration(parsed.data)
  return NextResponse.json({ ok: true })
}
