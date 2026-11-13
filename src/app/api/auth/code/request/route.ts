import { NextRequest, NextResponse } from 'next/server'
import { isLocalRequest } from '@/lib/localRequest'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { issueCode } from '@/lib/authCodes'
import { loginEmailWhere } from '@/lib/loginEmail'
import { loginCodeEmail } from '@/lib/loginCodeEmail'
import { clientIp, rateLimit } from '@/lib/rateLimit'

/**
 * POST /api/auth/code/request — belépési vagy regisztrációs kód e-mailben (design 3.1, 3.3).
 *  - belépés: ha van ilyen (aktív) fiók, megy a kód; ha nincs, akkor is „elküldtük” a válasz (nem áruljuk el, kinek
 *    van fiókja);
 *  - regisztráció: a fiók adatai a kódhoz kötve várnak; foglalt e-mailnél 409 (lépjen be).
 * Korlát: IP-nként 20 / óra, e-mailenként 5 / 15 perc.
 */
const account = z.object({
  kind: z.enum(['salon', 'restaurant']),
  ownerName: z.string().trim().min(2).max(120),
  placeName: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  businessTypes: z.array(z.string().max(60)).max(20).optional(),
  templateId: z.string().max(60).optional(),
  tier: z.enum(['starter', 'pro']).optional(),
  referralCode: z.string().trim().max(40).optional(),
})
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), purpose: z.enum(['login', 'register']), account: account.optional() })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { email, purpose } = parsed.data
  const ip = clientIp(req.headers)
  const a = rateLimit(`code-ip:${ip}`, 20, 60 * 60_000), b = rateLimit(`code-mail:${email}`, 5, 15 * 60_000)
  if (!a.allowed || !b.allowed) return NextResponse.json({ error: 'rate_limited', retryAfter: Math.max(a.retryAfter, b.retryAfter) }, { status: 429 })

  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'users', where: loginEmailWhere(email), limit: 1, overrideAccess: true, depth: 0 })
  const user = found.docs[0] as { status?: string | null; role?: string | null } | undefined

  if (purpose === 'register') {
    if (!parsed.data.account) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    if (user) return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  } else if (!user || user.status === 'inactive' || user.role === 'admin') {
    // admin-fiók csak a Backstage-en léphet be (külön belépés) — itt nem kap kódot
    return NextResponse.json({ ok: true })
  }

  const code = await issueCode(email, purpose, purpose === 'register' ? { ...parsed.data.account, email } : undefined)
  const mail = loginCodeEmail(code, purpose, email)
  // Helyi fejlesztés (a kérés a localhost-ról jön): nem küldünk levelet — a helyi .env élő Resend-kulccsal fut, és a
  // domain ott nincs is hitelesítve —, a kód a szerver termináljába kerül. (A Host fejlécből — lásd lib/localRequest.)
  if (isLocalRequest(req.headers)) {
    console.log(`\n[auth/code/request] HELYI BELÉPÉS — ${email}: ${code}\n`)
    return NextResponse.json({ ok: true })
  }
  try {
    await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html })
  } catch (e) {
    console.error('[auth/code/request] send failed:', e)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
