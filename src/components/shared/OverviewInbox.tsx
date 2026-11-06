'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton, Meta } from '@/components/ui-kit'
import { setBookingStatus } from '@/components/dashboard/ApprovalActions'
import type { InboxRow, OverviewInbox as Inbox } from '@/lib/overviewInbox'
import { OverviewAccordion } from './OverviewPanels'

/**
 * Az Áttekintés „kezelendők” akkordeonja (a /design 4.1): tegnap lezáratlan (Megjelent / Nem jött), jóváhagyásra
 * vár (Elfogadom / Elutasítom), ma szülinapos vendég, lejáró utalvány. A kezelt sor azonnal eltűnik, az oldal frissül.
 * Az első nem üres sor nyitva indul.
 */
export function OverviewInbox({ inbox, restaurant, base }: { inbox: Inbox; restaurant: boolean; base: string }) {
  const router = useRouter()
  const [done, setDone] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null)
  const left = (rows: InboxRow[]) => rows.filter((r) => !done.has(r.id))

  async function act(row: InboxRow, status: string, msg: string, decline = false) {
    setBusy(row.id)
    try {
      await setBookingStatus({ restaurant, id: row.id, status, decline })
      setDone((d) => new Set(d).add(row.id))
      toast.success(msg)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült')
    } finally {
      setBusy(null)
      setConfirmDecline(null)
    }
  }

  const list = (rows: InboxRow[], empty: string, actions: (r: InboxRow) => React.ReactNode) => (
    rows.length === 0 ? <Meta className="pb-1">{empty}</Meta> : (
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-ui-control bg-white/80 px-2.5 py-2">
            <span className="min-w-0 flex-1"><span className="block truncate text-ui-meta text-ui-text">{r.title}</span><span className="block truncate text-ui-label text-ui-muted">{r.meta}</span></span>
            {actions(r)}
          </div>
        ))}
      </div>
    )
  )

  const unclosed = left(inbox.unclosed)
  const pending = left(inbox.pending)
  const sections = [
    {
      label: 'Tegnap lezáratlan', rows: unclosed,
      body: list(unclosed, 'Minden tegnapi foglalás le van zárva.', (r) => (
        <>
          <Button size="sm" disabled={busy !== null} onClick={() => act(r, 'completed', 'Lezárva — megjelent')}>Megjelent</Button>
          <Button size="sm" variant="cell" disabled={busy !== null} onClick={() => act(r, 'no_show', 'Lezárva — nem jött')}>Nem jött</Button>
        </>
      )),
    },
    {
      label: 'Jóváhagyásra vár', rows: pending,
      body: list(pending, 'Nincs jóváhagyásra váró foglalás.', (r) => (
        <>
          <IconButton icon={Check} label="Elfogadom" variant="dark" size="sm" disabled={busy !== null} onClick={() => act(r, 'confirmed', 'Elfogadva — a vendég megkapta a visszaigazolást')} />
          {confirmDecline === r.id
            ? <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => act(r, 'cancelled', 'Elutasítva — a vendég e-mailben értesült', true)}>Biztos?</Button>
            : <IconButton icon={X} label="Elutasítom" variant="cell" size="sm" disabled={busy !== null} onClick={() => setConfirmDecline(r.id)} />}
        </>
      )),
    },
    {
      label: 'Ma szülinapos vendég', rows: inbox.birthdays,
      body: list(inbox.birthdays, 'Ma nincs szülinapos vendég.', () => <IconButton icon={ArrowUpRight} label="Vendégek" variant="cell" size="sm" href={`${base}/guests`} />),
    },
    {
      label: 'Lejáró utalvány', rows: inbox.vouchers,
      body: list(inbox.vouchers, '30 napon belül nem jár le utalvány.', () => <IconButton icon={ArrowUpRight} label="Utalványok" variant="cell" size="sm" href={`${base}/vouchers`} />),
    },
  ]
  const firstOpen = Math.max(0, sections.findIndex((s) => s.rows.length > 0))

  return <OverviewAccordion defaultOpen={firstOpen} items={sections.map((s) => ({ label: s.label, count: s.rows.length, body: s.body }))} />
}
