'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Building2, UtensilsCrossed, MapPin, Phone, Mail, Globe, Clock, ExternalLink, LogIn } from 'lucide-react'
import {
  PLAN_LABELS, STATUS_LABELS, STATUS_COLORS, type PlaceKind,
} from '@/lib/backstagePlaces'

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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
              <TypeIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
            </div>
            <div>
              <SheetTitle className="text-left flex items-center gap-2">
                {placeDoc?.name ?? '—'}
                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{typeLabel}</span>
              </SheetTitle>
              {placeDoc?.city && (
                <p className="flex items-center gap-1 text-zinc-400 text-xs mt-0.5">
                  <MapPin className="h-3 w-3" />{placeDoc.city}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white animate-spin" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/${placeDoc?.slug}`}
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 text-xs hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Nyilvános oldal
              </a>
              {owner && (
                <form method="POST" action="/api/backstage/session-as" target="_blank">
                  <input type="hidden" name="userId" value={String(owner.id)} />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 text-xs hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Belépés owner-ként
                  </button>
                </form>
              )}
            </div>

            {/* Booking stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
                <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Összes foglalás</p>
                <p className="text-zinc-900 dark:text-white font-black text-2xl">{data.totalBookings}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
                <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Ez a hónap</p>
                <p className="text-zinc-900 dark:text-white font-black text-2xl">{data.monthBookings}</p>
              </div>
            </div>

            {/* Owner */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
              <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-3">Tulajdonos</p>
              {owner ? (
                <div>
                  <p className="text-zinc-900 dark:text-white font-semibold text-sm">{owner.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{owner.email}</p>
                  <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-2">
                    Regisztrált: {new Date(owner.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ) : <p className="text-zinc-400 text-sm">—</p>}
            </div>

            {/* Subscription */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
              <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-3">Előfizetés</p>
              {sub ? (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-zinc-900 dark:text-white font-bold text-sm">{PLAN_LABELS[sub.plan] ?? sub.plan}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>
                      {STATUS_LABELS[sub.status] ?? sub.status}
                    </span>
                  </div>
                  {sub.amount_huf != null && sub.amount_huf > 0 && (
                    <p className="text-zinc-500 text-xs">{sub.amount_huf.toLocaleString('hu-HU')} Ft/hó</p>
                  )}
                  {(sub.trial_ends_at || sub.current_period_end) && (
                    <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {sub.status === 'trialing' && sub.trial_ends_at
                        ? `Trial vége: ${new Date(sub.trial_ends_at).toLocaleDateString('hu-HU')}`
                        : sub.current_period_end
                          ? `Időszak vége: ${new Date(sub.current_period_end).toLocaleDateString('hu-HU')}`
                          : null}
                    </p>
                  )}
                </div>
              ) : <p className="text-zinc-400 text-sm">Nincs előfizetés</p>}
            </div>

            {/* Contact */}
            {(placeDoc?.phone || placeDoc?.email || placeDoc?.website || placeDoc?.address) && (
              <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
                <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-3">Elérhetőség</p>
                <div className="space-y-2">
                  {placeDoc.phone && (
                    <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />{placeDoc.phone}
                    </p>
                  )}
                  {placeDoc.email && (
                    <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />{placeDoc.email}
                    </p>
                  )}
                  {placeDoc.website && (
                    <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                      <Globe className="h-3.5 w-3.5 text-zinc-400" />{placeDoc.website}
                    </p>
                  )}
                  {placeDoc.address && (
                    <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400" />{placeDoc.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Status + meta */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-900 dark:text-white text-sm font-medium">{typeLabel} aktív</p>
                  <p className="text-zinc-400 text-xs mt-0.5">Látható az ügyfeleknek</p>
                </div>
                <ActiveToggle kind={kind} placeId={placeDoc.id} isActive={placeDoc.is_active ?? false} />
              </div>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06]">
                Regisztrált: {new Date(placeDoc.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Recent bookings */}
            {data.recentBookings.length > 0 && (
              <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
                <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider px-4 pt-4 pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
                  Legutóbbi foglalások
                </p>
                {data.recentBookings.map((b: any, i: number) => {
                  // Szalon-foglalásnál `service`, étterem-foglalásnál `pax` van — mindkettő kezelve.
                  const service = typeof b.service === 'object' ? b.service : null
                  const detail = service?.name ?? (b.pax != null ? `${b.pax} fő` : '—')
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between px-4 py-3 ${i < data.recentBookings.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
                    >
                      <div>
                        <p className="text-zinc-900 dark:text-white text-sm font-medium">{b.customer_name}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{detail} · {b.date} {b.start_time}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500'
                        : b.status === 'cancelled' || b.status === 'no_show' ? 'bg-red-500/10 text-red-500'
                        : b.status === 'completed' ? 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500'
                        : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Admin notes */}
            <div className="bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4">
              <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-3">Belső megjegyzés</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-transparent text-sm text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:outline-none resize-none"
                placeholder="Belső megjegyzések az adminnak..."
              />
              <button
                onClick={saveNotes}
                disabled={saving}
                className="mt-1 text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
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
        active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
