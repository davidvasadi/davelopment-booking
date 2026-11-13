import { requireAuth } from '@/lib/auth'
import { Check, Mail, MessageSquare } from 'lucide-react'
import { Kpi, PageHead } from '@/components/ui-kit'
import { MessagesView } from '@/components/backstage/BackstageViews'
import { getPayloadClient } from '@/lib/payload'
import { ago } from '@/lib/backstageView'
import type { ContactMessage, User } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/** Backstage › Kapcsolat (design B.13): a kapcsolat-űrlap üzenetei, mellette a megnyitott üzenet. Ha a feladó már
 *  ügyfél (azonos e-mail), az üzlete és a fiókja is látszik. */
export default async function BackstageContactPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'contact-messages', sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true })
  const msgs = res.docs as ContactMessage[]
  const emails = [...new Set(msgs.map((m) => m.email?.toLowerCase()).filter(Boolean))] as string[]
  const users = emails.length
    ? ((await payload.find({ collection: 'users', where: { email: { in: emails } }, limit: emails.length, depth: 1, overrideAccess: true }).catch(() => null))?.docs ?? []) as User[]
    : []
  const byEmail = new Map(users.map((u) => {
    const place = [u.salon, u.restaurant].find((p) => p && typeof p === 'object') as { name?: string } | undefined
    return [u.email.toLowerCase(), { id: String(u.id), name: place?.name || u.name || u.email, owner: u.role !== 'admin' }]
  }))
  const rows = msgs.map((m) => {
    const u = byEmail.get(m.email?.toLowerCase() ?? '')
    return { key: String(m.id), id: String(m.id), name: m.name, email: m.email, phone: m.phone ?? null, message: m.message, when: ago(m.createdAt), answered: m.status === 'answered', account: u?.owner ? u.name : null, accountHref: u?.owner ? `/backstage/accounts/${u.id}` : undefined }
  })
  const fresh = rows.filter((r) => !r.answered).length
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Kapcsolat" sub="A kapcsolat-űrlap üzenetei"
        kpis={<><Kpi icon={MessageSquare} value={String(fresh)} label="Új üzenet" /><Kpi icon={Mail} value={String(res.totalDocs)} label="Összesen" /><Kpi icon={Check} value={String(rows.length - fresh)} label="Megválaszolva" /></>} />
      <MessagesView messages={rows} />
    </div>
  )
}
