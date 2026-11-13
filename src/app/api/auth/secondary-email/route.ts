import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { issueCode, verifyCode } from '@/lib/authCodes'
import { loginCodeEmail } from '@/lib/loginCodeEmail'
import { startSession } from '@/lib/authLogin'
import { emailLayout, COLORS, escapeHtml } from '@/lib/emailLayout'
import { BRAND_NAME } from '@/lib/brand'
import { isLocalRequest } from '@/lib/localRequest'
import { clientIp, rateLimit } from '@/lib/rateLimit'

/**
 * Másodlagos belépési e-mail (Saját profil › Belépés, 2026-11). Ezzel is be lehet lépni (kód / Google); ha az elsődleges
 * cím megszűnik, elsődlegessé tehető. Minden változásról értesítés megy a fiók címeire (biztonság: ha nem ő volt).
 *  POST   { email }          → megerősítő kód a megadott címre
 *  PUT    { email, code }    → a kód ellenőrzése, a cím mentése (megerősítve)
 *  PATCH  { action: 'promote' } → a másodlagos lesz az elsődleges, a régi elsődleges a másodlagos
 *  DELETE                    → a másodlagos cím törlése
 */
type U = { id: number | string; email: string; role?: string | null; secondary_email?: string | null; secondary_email_verified_at?: string | null }
const emailSchema = z.string().trim().toLowerCase().email().max(200)

async function inUse(email: string, exceptId: number | string): Promise<boolean> {
  const payload = await getPayloadClient()
  const r = await payload.find({ collection: 'users', where: { and: [{ id: { not_equals: exceptId } }, { or: [{ email: { equals: email } }, { secondary_email: { equals: email } }] }] }, limit: 1, depth: 0, overrideAccess: true })
  return r.docs.length > 0
}

/** Rövid biztonsági értesítő a fiók címe(i)re. Best-effort: a hibája nem állítja meg a műveletet. */
async function notify(req: NextRequest, to: string[], title: string, text: string) {
  if (isLocalRequest(req.headers)) { console.log(`\n[secondary-email] HELYI — értesítő (${to.join(', ')}): ${title}\n`); return }
  const content = `<tr><td style="background:${COLORS.surface};padding:34px 32px 30px">
    <h1 style="margin:0;font-size:22px;font-weight:300;color:${COLORS.text}">${escapeHtml(title)}</h1>
    <p style="margin:10px 0 0;color:${COLORS.textSoft};font-size:14px;line-height:1.6">${escapeHtml(text)}</p>
    <p style="margin:18px 0 0;color:${COLORS.textFaint};font-size:12px;line-height:1.6">Ha nem te voltál, lépj be, és a Beállítások › Saját profil oldalon töröld a címet, vagy írj nekünk.</p>
  </td></tr>`
  const payload = await getPayloadClient()
  for (const addr of [...new Set(to.filter(Boolean))]) {
    await payload.sendEmail({ to: addr, subject: `${title} — ${BRAND_NAME}`, html: emailLayout({ brandName: BRAND_NAME, content }) }).catch((e) => console.error('[secondary-email] notify failed:', e))
  }
}

async function me(): Promise<U | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const payload = await getPayloadClient()
  return (await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }).catch(() => null)) as U | null
}

export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = emailSchema.safeParse(body?.email)
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen e-mail-cím.' }, { status: 400 })
  const email = parsed.data
  if (email === user.email.toLowerCase()) return NextResponse.json({ error: 'Ez már az elsődleges címed.' }, { status: 400 })
  const a = rateLimit(`secmail-ip:${clientIp(req.headers)}`, 10, 60 * 60_000), b = rateLimit(`secmail-user:${user.id}`, 5, 15 * 60_000)
  if (!a.allowed || !b.allowed) return NextResponse.json({ error: 'Túl sok próbálkozás — próbáld újra pár perc múlva.' }, { status: 429 })
  if (await inUse(email, user.id)) return NextResponse.json({ error: 'Ez a cím már egy másik fiókhoz tartozik.' }, { status: 409 })

  const code = await issueCode(email, 'secondary', { userId: user.id })
  if (isLocalRequest(req.headers)) {
    console.log(`\n[secondary-email] HELYI — megerősítő kód (${email}): ${code}\n`)
    return NextResponse.json({ ok: true })
  }
  const mail = loginCodeEmail(code, 'secondary')
  const payload = await getPayloadClient()
  try {
    await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html })
  } catch (e) {
    console.error('[secondary-email] send failed:', e)
    return NextResponse.json({ error: 'Nem sikerült elküldeni a kódot.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const email = emailSchema.safeParse(body?.email)
  const code = z.string().trim().regex(/^\d{6}$/).safeParse(body?.code)
  if (!email.success || !code.success) return NextResponse.json({ error: 'Érvénytelen adatok.' }, { status: 400 })
  const r = await verifyCode(email.data, code.data)
  if (!r.ok) {
    const msg = r.reason === 'wrong' ? `Hibás kód — még ${r.left} próbálkozás.` : r.reason === 'locked' ? 'Túl sok hibás próbálkozás — kérj új kódot.' : 'A kód lejárt — kérj újat.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  if (r.purpose !== 'secondary' || String((r.data as { userId?: unknown } | null)?.userId) !== String(user.id)) return NextResponse.json({ error: 'A kód lejárt — kérj újat.' }, { status: 400 })
  if (await inUse(email.data, user.id)) return NextResponse.json({ error: 'Ez a cím már egy másik fiókhoz tartozik.' }, { status: 409 })
  const payload = await getPayloadClient()
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { secondary_email: email.data, secondary_email_verified_at: new Date().toISOString() } as never })
  await notify(req, [user.email], 'Új másodlagos e-mail a fiókodon', `A fiókodhoz hozzáadták a(z) ${email.data} címet — ezzel is be lehet lépni.`)
  return NextResponse.json({ ok: true, secondaryEmail: email.data })
}

export async function PATCH(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (body?.action !== 'promote') return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const next = user.secondary_email?.toLowerCase()
  if (!next || !user.secondary_email_verified_at) return NextResponse.json({ error: 'Nincs megerősített másodlagos címed.' }, { status: 400 })
  if (await inUse(next, user.id)) return NextResponse.json({ error: 'Ez a cím már egy másik fiókhoz tartozik.' }, { status: 409 })
  const old = user.email.toLowerCase()
  const payload = await getPayloadClient()
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { email: next, secondary_email: old, secondary_email_verified_at: new Date().toISOString() } as never })
  await notify(req, [old, next], 'Megváltozott az elsődleges e-mail-címed', `A fiókod elsődleges címe mostantól ${next}. A korábbi cím (${old}) másodlagosként megmaradt — azzal is be tudsz lépni, amíg nem törlöd.`)
  // új token az új címmel (a régi a régi e-mailt hordozza)
  const res = NextResponse.json({ ok: true, email: next, secondaryEmail: old })
  await startSession(req, res, { id: user.id, email: next, role: user.role })
  return res
}

export async function DELETE(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const removed = user.secondary_email
  if (!removed) return NextResponse.json({ ok: true })
  const payload = await getPayloadClient()
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { secondary_email: null, secondary_email_verified_at: null } as never })
  await notify(req, [user.email, removed], 'Másodlagos e-mail törölve', `A(z) ${removed} cím lekerült a fiókodról — ezzel már nem lehet belépni.`)
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
