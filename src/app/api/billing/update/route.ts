import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    type?: string
    id?: string
    legal_name?: string
    tax_number?: string
    company_reg_number?: string
    billing_email?: string
    billing_postal_code?: string
    billing_city?: string
    billing_street?: string
  }

  const collection = body.type === 'salon' ? 'salons' : body.type === 'restaurant' ? 'restaurants' : null
  if (!collection || !body.id) return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 })

  const denied = await assertCapability(user.id, body.type as 'salon' | 'restaurant', body.id, 'billing.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  await payload.update({
    collection,
    id: body.id,
    overrideAccess: true,
    data: {
      ...(body.legal_name !== undefined ? { legal_name: body.legal_name } : {}),
      ...(body.tax_number !== undefined ? { tax_number: body.tax_number } : {}),
      ...(body.company_reg_number !== undefined ? { company_reg_number: body.company_reg_number } : {}),
      ...(body.billing_email !== undefined ? { billing_email: body.billing_email } : {}),
      ...(body.billing_postal_code !== undefined ? { billing_postal_code: body.billing_postal_code } : {}),
      ...(body.billing_city !== undefined ? { billing_city: body.billing_city } : {}),
      ...(body.billing_street !== undefined ? { billing_street: body.billing_street } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
