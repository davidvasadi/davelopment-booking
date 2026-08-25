import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { CONTACT_EMAIL } from '@/lib/brand'
import { escapeHtml } from '@/lib/emailLayout'
import { logEmail } from '@/lib/emailLog'
import { sendPushToUsers } from '@/lib/webPush'
import { Resend } from 'resend'

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).optional().or(z.literal('')),
  message: z.string().trim().min(1).max(4000),
})

/** Publikus kapcsolatfelvételi űrlap: elmenti az üzenetet + admin-értesítő emailt küld. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const { name, email, phone, message } = parsed.data

  const payload = await getPayloadClient()
  await payload.create({
    collection: 'contact-messages',
    overrideAccess: true,
    data: { name, email, phone: phone || undefined, message },
  })

  // Azonnali backstage-értesítés (harang) — enélkül csak emailből (ami dev-en API-kulcs
  // hiányában nem is megy ki) vagy a /backstage/contact manuális megnyitásából derülne ki,
  // hogy üzenet érkezett.
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: {
      audience: 'admin',
      type: 'contact_message',
      title: `Új kapcsolatfelvétel: ${name}`,
      body: message.length > 140 ? `${message.slice(0, 140)}…` : message,
      read: false,
    },
  }).catch(() => null)

  // Böngésző-push az összes adminnak — best-effort, ne bukjon el emiatt a beküldés.
  try {
    const admins = await payload.find({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    await sendPushToUsers(payload, admins.docs.map((a) => a.id), {
      title: `Új kapcsolatfelvétel: ${name}`,
      body: message.length > 140 ? `${message.slice(0, 140)}…` : message,
      url: '/backstage/contact',
      tag: 'contact-message',
    })
  } catch (err) {
    payload.logger.error(`contact push hiba: ${String(err)}`)
  }

  const subject = `Új kapcsolatfelvétel — ${name}`
  const html = `
    <div style="font-family:sans-serif;font-size:14px;color:#211F1A;line-height:1.6;">
      <p><strong>Név:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${phone ? `<p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>` : ''}
      <p><strong>Üzenet:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `.trim()

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data: sendResult, error } = await resend.emails.send({
      from: `"davelopment booking" <${process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu'}>`,
      to: CONTACT_EMAIL,
      reply_to: email,
      subject,
      html,
    })
    await logEmail('contact_form', CONTACT_EMAIL, subject, !error, error?.message, { resendId: sendResult?.id })
  }

  return NextResponse.json({ ok: true })
}
