'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SlideSwap } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { AttentionBar, PendingApproval } from '@/components/blocks/booking'
import { setBookingStatus } from './ApprovalActions'

type Pending = { id: string; name: string; when: string; createdAt: string; service: string; detail: string; price: string; staffName?: string; img?: string | null; rows: [string, string][] }
type Data = { pending: Pending[]; pendingTotal?: number; paymentDue: { count: number; oldest?: { name: string; when: string } }; prefs: { pendingPopup: boolean; paymentBar: boolean }; kind?: 'salon' | 'restaurant' }

// az élő frissítés (SSE: booking-changed / notification-changed) azonnal szól; az időzített lekérdezés csak tartalék
// (pl. a „fizetésre vár” az idő múlásával jelenik meg) — sebesség, docs/audit/2026-11-05_1921
const POLL_MS = 5 * 60_000
const store = { get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* privát mód */ } } }

/**
 * „Ami figyelmet kér” (design 6.8.1) az app keretében — percenként lekérdezi (/api/attention):
 *  - új függő foglalás: a saját beállítás szerint a sáv alul („Új foglalás vár jóváhagyásra · Megnézem”), vagy azonnal a
 *    jóváhagyó popup (több várónál lapozóval). A sáv „Megnézem”-je is a popupot nyitja. Az X elrejti, amíg nem jön újabb.
 *  - fizetésre vár (szalon, ha a sáv be van kapcsolva): „N foglalás fizetésre vár · Lezárom” → a Foglalások.
 * A beállítások / előfizetés oldalon nem jelenik meg. Csak annak, aki jóváhagyhat (a szerver dönti el).
 */
export function AttentionHost({ basePath, restaurant = false }: { basePath: string; restaurant?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<Data | null>(null)
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  // a lapozás iránya: 1 = következő (jobbról jön), -1 = előző (balról); 0 = nyitás (nincs csúszás)
  const [dir, setDir] = useState(0)
  const [hidden, setHidden] = useState<{ pending: string | null; pay: string | null }>({ pending: null, pay: null })
  const seen = useRef<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/attention', { credentials: 'include' }).catch(() => null)
    if (!r?.ok) return
    const j = (await r.json().catch(() => null)) as Data | null
    if (!j) return
    setData(j)
    // popup módban: ha új (még nem látott) függő foglalás érkezett, magától nyílik
    const newest = j.pending[j.pending.length - 1]?.id ?? null
    if (j.prefs.pendingPopup && newest && newest !== seen.current && newest !== store.get('attention-seen')) { setDir(0); setIdx(j.pending.length - 1); setOpen(true) }
    seen.current = newest
  }, [])

  useEffect(() => {
    setHidden({ pending: store.get('attention-hide-pending'), pay: store.get('attention-hide-pay') })
    void load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    const onChange = () => { void load() }
    window.addEventListener('booking-changed', onChange)
    window.addEventListener('notification-changed', onChange)
    return () => { clearInterval(t); window.removeEventListener('booking-changed', onChange); window.removeEventListener('notification-changed', onChange) }
  }, [load])

  if (!data || pathname?.includes('/settings') || pathname?.includes('/subscription')) return null
  const pending = data.pending
  const newestId = pending[pending.length - 1]?.id ?? null
  const cur = pending[Math.min(idx, pending.length - 1)]

  const act = async (approve: boolean) => {
    if (!cur) return
    setBusy(true)
    try {
      await setBookingStatus({ restaurant, id: cur.id, status: approve ? 'confirmed' : 'cancelled', decline: !approve })
      toast.success(approve ? 'Elfogadva — a vendég megkapta a visszaigazolást' : 'Elutasítva — a vendég e-mailben értesült')
      const rest = pending.filter((p) => p.id !== cur.id)
      setData({ ...data, pending: rest })
      if (!rest.length) setOpen(false)
      else setIdx((i) => Math.min(i, rest.length - 1))
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt') } finally { setBusy(false) }
  }
  const go = (d: 1 | -1) => { setDir(d); setIdx((i) => Math.max(0, Math.min(pending.length - 1, i + d))) }
  const closePopup = () => { setOpen(false); if (newestId) store.set('attention-seen', newestId) }

  const showPendingBar = pending.length > 0 && !open && hidden.pending !== newestId
  const payKey = String(data.paymentDue.count)
  const showPayBar = !restaurant && data.prefs.paymentBar && data.paymentDue.count > 0 && hidden.pay !== payKey && !showPendingBar

  return (
    <>
      {(showPendingBar || showPayBar) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-6">
          {showPendingBar ? (
            <AttentionBar className="pointer-events-auto" kind="pending" count={data.pendingTotal ?? pending.length} who={pending[0].name} when={pending[0].when} img={pending.length === 1 ? pending[0].img : null}
              onOpen={() => { setDir(0); setIdx(0); setOpen(true) }}
              onDismiss={() => { if (newestId) { store.set('attention-hide-pending', newestId); setHidden((h) => ({ ...h, pending: newestId })) } }} />
          ) : (
            <AttentionBar className="pointer-events-auto" kind="payment" count={data.paymentDue.count} who={data.paymentDue.oldest?.name} when={data.paymentDue.oldest?.when}
              href={`${basePath}/bookings`}
              onDismiss={() => { store.set('attention-hide-pay', payKey); setHidden((h) => ({ ...h, pay: payKey })) }} />
          )}
        </div>
      )}
      {/* a közös popup (PopupModal): ugyanaz a beugró bounce (desktopon genie, mobilon alulról felcsúszó lap), mint minden ablakon */}
      <PopupModal open={open && !!cur} onClose={closePopup} maxWidth="sm:max-w-[440px]" panel={cur ? (
        <PendingApproval className="w-full max-sm:rounded-b-none sm:w-[440px]" arrived={cur.id === newestId ? 'Épp most érkezett' : undefined}
          queue={{ i: Math.min(idx, pending.length - 1) + 1, n: pending.length, onPrev: () => go(-1), onNext: () => go(1) }}
          data={cur} busy={busy} onApprove={() => void act(true)} onDecline={() => void act(false)} onClose={closePopup}
          // lapozáskor csak a tartalom csúszik (jobbról balra, rugósan) — a keret és a gombok állnak
          wrap={(body) => <SlideSwap k={cur.id} dir={dir}>{body}</SlideSwap>} />
      ) : null} />
    </>
  )
}
