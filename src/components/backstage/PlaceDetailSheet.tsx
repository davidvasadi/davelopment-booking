'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Building2, UtensilsCrossed, MapPin, Phone, Mail, Globe, Clock, ExternalLink, LogIn } from 'lucide-react'
import {
  PLAN_LABELS, STATUS_LABELS, type PlaceKind,
} from '@/lib/backstagePlaces'

/* davelopment státusz-badge */
const SUB_BADGE: Record<string, string> = {
  trialing: 'bg-[#FBF4DC] text-[#7A6A2E]',
  active: 'bg-[#E7F2EA] text-[#1D9D63]',
  past_due: 'bg-[#F8E9E7] text-[#C0392B]',
  canceled: 'bg-[#F0EAD8] text-ink-soft',
  paused: 'bg-[#FBF4DC] text-[#7A6A2E]',
}
function bookingBadge(status: string): string {
  if (status === 'confirmed') return 'bg-[#E7F2EA] text-[#1D9D63]'
  if (status === 'cancelled' || status === 'no_show') return 'bg-[#F8E9E7] text-[#C0392B]'
  if (status === 'completed') return 'bg-[#F0EAD8] text-ink-soft'
  return 'bg-[#FBF4DC] text-[#7A6A2E]'
}

type DetailData = {
  salon: any // a hely-objektum (szalon VAGY étterem) — közös mezőkkel
  subscription: any | null
  totalBookings: number
  monthBookings: number
  recentBookings: any[]
}

interface Props {
  place: { id: string; kind: PlaceKind } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PlaceDetailSheet({ place, open, onOpenChange }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const kind = place?.kind ?? 'salon'
  const isRestaurant = kind === 'restaurant'
  const typeLabel = isRestaurant ? 'Étterem' : 'Szalon'
  const TypeIcon = isRestaurant ? UtensilsCrossed : Building2
  const apiBase = isRestaurant ? '/api/backstage/restaurants' : '/api/backstage/salons'

  useEffect(() => {
    if (!open || !place) return
    setData(null)
    setLoading(true)
    fetch(`${apiBase}/${place.id}/detail`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setNotes(d.salon?.admin_notes ?? '')
      })
      .finally(() => setLoading(false))
  }, [open, place, apiBase])

  async function saveNotes() {
    if (!place) return
    setSaving(true)
    try {
      await fetch(`${apiBase}/${place.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const placeDoc = data?.salon
  const sub = data?.subscription
  const owner = placeDoc?.owner && typeof placeDoc.owner === 'object' ? placeDoc.owner : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3 font-onest">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F6F2E4]">
              <TypeIcon className="h-5 w-5 text-ink-soft" strokeWidth={1.7} />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2 text-left text-ink">
                {placeDoc?.name ?? '—'}
                <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
              </SheetTitle>
              {placeDoc?.city && (
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-soft">
                  <MapPin className="h-3 w-3" />{placeDoc.city}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4 font-onest">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/${placeDoc?.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 rounded-[18px] bg-[#F6F2E4] px-[14px] py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-[#EFE9D6]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Nyilvános oldal
              </a>
              {owner && (
                <form method="POST" action="/api/backstage/session-as" target="_blank">
                  <input type="hidden" name="userId" value={String(owner.id)} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-[18px] bg-ink-dark px-[14px] py-2 text-[12px] font-semibold text-white"
                  >
                    <LogIn className="h-3.5 w-3.5 text-gold" />
                    Belépés owner-ként
                  </button>
                </form>
              )}
            </div>

            {/* Booking stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Összes foglalás</p>
                <p className="text-[28px] font-light leading-none tracking-[-0.02em] text-ink">{data.totalBookings}</p>
              </div>
              <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Ez a hónap</p>
                <p className="text-[28px] font-light leading-none tracking-[-0.02em] text-ink">{data.monthBookings}</p>
              </div>
            </div>

            {/* Owner */}
            <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Tulajdonos</p>
              {owner ? (
                <div>
                  <p className="text-[14px] font-semibold text-ink">{owner.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">{owner.email}</p>
                  <p className="mt-2 text-[12px] text-ink-soft2">
                    Regisztrált: {new Date(owner.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ) : <p className="text-[14px] text-ink-soft">—</p>}
            </div>

            {/* Subscription */}
            <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Előfizetés</p>
              {sub ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[14px] font-bold text-ink">{PLAN_LABELS[sub.plan] ?? sub.plan}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${SUB_BADGE[sub.status] ?? 'bg-[#F0EAD8] text-ink-soft'}`}>
                      {STATUS_LABELS[sub.status] ?? sub.status}
                    </span>
                  </div>
                  {sub.amount_huf != null && sub.amount_huf > 0 && (
                    <p className="text-[12px] text-ink-soft">{sub.amount_huf.toLocaleString('hu-HU')} Ft/hó</p>
                  )}
                  {(sub.trial_ends_at || sub.current_period_end) && (
                    <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-soft2">
                      <Clock className="h-3 w-3" />
                      {sub.status === 'trialing' && sub.trial_ends_at
                        ? `Trial vége: ${new Date(sub.trial_ends_at).toLocaleDateString('hu-HU')}`
                        : sub.current_period_end
                          ? `Időszak vége: ${new Date(sub.current_period_end).toLocaleDateString('hu-HU')}`
                          : null}
                    </p>
                  )}
                </div>
              ) : <p className="text-[14px] text-ink-soft">Nincs előfizetés</p>}
            </div>

            {/* Contact */}
            {(placeDoc?.phone || placeDoc?.email || placeDoc?.website || placeDoc?.address) && (
              <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Elérhetőség</p>
                <div className="space-y-2">
                  {placeDoc.phone && (
                    <p className="flex items-center gap-2 text-[13.5px] text-ink">
                      <Phone className="h-3.5 w-3.5 text-ink-soft" />{placeDoc.phone}
                    </p>
                  )}
                  {placeDoc.email && (
                    <p className="flex items-center gap-2 text-[13.5px] text-ink">
                      <Mail className="h-3.5 w-3.5 text-ink-soft" />{placeDoc.email}
                    </p>
                  )}
                  {placeDoc.website && (
                    <p className="flex items-center gap-2 text-[13.5px] text-ink">
                      <Globe className="h-3.5 w-3.5 text-ink-soft" />{placeDoc.website}
                    </p>
                  )}
                  {placeDoc.address && (
                    <p className="flex items-center gap-2 text-[13.5px] text-ink">
                      <MapPin className="h-3.5 w-3.5 text-ink-soft" />{placeDoc.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Status + meta */}
            <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{typeLabel} aktív</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">Látható az ügyfeleknek</p>
                </div>
                <ActiveToggle kind={kind} placeId={placeDoc.id} isActive={placeDoc.is_active ?? false} />
              </div>
              <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink-soft2">
                Regisztrált: {new Date(placeDoc.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Recent bookings */}
            {data.recentBookings.length > 0 && (
              <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-dav-card">
                <p className="border-b border-line px-4 pb-3 pt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                  Legutóbbi foglalások
                </p>
                {data.recentBookings.map((b: any, i: number) => {
                  // Szalon-foglalásnál `service`, étterem-foglalásnál `pax` van — mindkettő kezelve.
                  const service = typeof b.service === 'object' ? b.service : null
                  const detail = service?.name ?? (b.pax != null ? `${b.pax} fő` : '—')
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between px-4 py-3 ${i < data.recentBookings.length - 1 ? 'border-b border-line' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-ink">{b.customer_name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-ink-soft">{detail} · {b.date} {b.start_time}</p>
                      </div>
                      <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${bookingBadge(b.status)}`}>
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Admin notes */}
            <div className="rounded-[20px] border border-line bg-white p-4 shadow-dav-card">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Belső megjegyzés</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-[16px] border border-line bg-white px-[14px] py-3 text-[13.5px] text-ink placeholder:text-ink-soft2 focus:border-strong focus:outline-none"
                placeholder="Belső megjegyzések az adminnak..."
              />
              <button
                onClick={saveNotes}
                disabled={saving}
                className="mt-2 rounded-[16px] bg-ink-dark px-[16px] py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Mentés...' : saved ? 'Mentve ✓' : 'Mentés'}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ActiveToggle({ kind, placeId, isActive }: { kind: PlaceKind; placeId: string; isActive: boolean }) {
  const [active, setActive] = useState(isActive)
  const [pending, setPending] = useState(false)
  const endpoint = kind === 'restaurant'
    ? `/api/backstage/restaurants/${placeId}/toggle`
    : `/api/backstage/salons/${placeId}/toggle`

  async function toggle() {
    const next = !active
    setActive(next)
    setPending(true)
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
    } catch {
      setActive(v => !v)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        active ? 'bg-[#1D9D63]' : 'bg-[#E5DEC9]'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
