'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, Banknote, CalendarDays, Users } from 'lucide-react'
import { Avatar, Button, Card, ListRow, Meta, Pill, StatusPill } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { EASE } from '@/lib/motion'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { COUNTRIES } from '@/components/booking/phoneCountries'
import { notifDate, timeAgo, type Notification, type DigestMetadata } from '@/lib/useNotifications'
import { DigestBody, type DigestData } from '@/components/blocks/digest'

const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Születésnap',
  anniversary: 'Évforduló',
  business: 'Üzleti',
  date: 'Randevú',
  celebration: 'Ünneplés',
}

function occLabel(key: string) {
  return OCCASION_LABELS[key] ?? key
}

const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))

/** ISO-2 országkód → zászló emoji (Unicode regionális jelző betűk). */
function flagEmoji(iso: string): string {
  const code = iso.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
}

/** Belföldi (HU) vs külföldi arány kördiagramként — a design Statisztikák „Vendégek” kártyájának mintája
 *  (belföldi sárga, külföldi sötét). Kattintásra a teljes országlista a kártyán BELÜL nyílik ki. */
function CountryDonut({ countries }: { countries: Record<string, number> }) {
  const [open, setOpen] = useState(false)
  const total = Object.values(countries).reduce((s, n) => s + n, 0)
  if (total === 0) return null
  const domestic = countries['HU'] ?? 0
  const foreign = total - domestic
  const domesticPct = Math.round((domestic / total) * 100)
  const foreignPct = 100 - domesticPct
  const sorted = Object.entries(countries).sort(([, a], [, b]) => b - a)

  const R = 26
  const CIRC = 2 * Math.PI * R
  const domLen = (domesticPct / 100) * CIRC
  const forLen = (foreignPct / 100) * CIRC

  return (
    <Block label="Vendégek országa">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <Card tone="cell" pad="sm" inner>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={R} fill="none" stroke="var(--ui-yellow)" strokeWidth="9" strokeDasharray={`${domLen} ${CIRC}`} transform="rotate(-90 32 32)" strokeLinecap="round" />
                {foreign > 0 && (
                  <circle cx="32" cy="32" r={R} fill="none" stroke="var(--ui-dark)" strokeWidth="9" strokeDasharray={`${forLen} ${CIRC}`} strokeDashoffset={-domLen - (domestic > 0 ? 3 : 0)} transform="rotate(-90 32 32)" strokeLinecap="round" />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-ui-body tabular-nums text-ui-text">{total}</span>
                <span className="text-ui-label text-ui-muted">fő</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-ui-body text-ui-text">
              <p className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-ui-yellow" />Belföldi <span className="tabular-nums">{domesticPct}%</span><span className="text-ui-muted">({domestic})</span></p>
              <p className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-ui-dark" />Külföldi <span className="tabular-nums">{foreignPct}%</span><span className="text-ui-muted">({foreign})</span></p>
            </div>
          </div>
          <Meta className="mt-2.5">Koppints a részletekért</Meta>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                <div className="mt-3 space-y-1.5 border-t border-dashed border-ui-divider pt-3">
                  {sorted.map(([code, cnt]) => (
                    <div key={code} className="flex items-center justify-between gap-2 text-ui-body text-ui-text">
                      <span className="flex min-w-0 items-center gap-2"><span className="shrink-0">{flagEmoji(code)}</span><span className="truncate">{COUNTRY_BY_CODE[code]?.name ?? code}</span></span>
                      <span className="shrink-0 tabular-nums text-ui-muted">{cnt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </button>
    </Block>
  )
}

/** Egy szakasz a popupban: kis címke, alatta a tartalom. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Meta className="mb-2">{label}</Meta>
      {children}
    </div>
  )
}

/** Szám-cella (új / visszatérő vendég, foglalás forrása). */
function Num({ value, label }: { value: number; label: string }) {
  return (
    <Card tone="cell" pad="sm" inner className="text-center">
      <div className="text-ui-sub font-light tabular-nums text-ui-text">{value}</div>
      <div className="text-ui-label text-ui-muted">{label}</div>
    </Card>
  )
}

/**
 * Reggeli/esti összefoglaló popup — a közös PopupModal-ban (mobilon alulról, desktopon középen), a kit elemeivel.
 * Helyben nyílik, nem navigál; alul a napi foglalásokra visz.
 */
export function DigestSheet({ n, open, onClose }: { n: Notification; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const meta = n.metadata as DigestMetadata | null
  const isEvening = n.type === 'digest_evening'
  const isRest = n.restaurant != null
  const bookingsHref = isRest ? '/restaurant/bookings' : '/dashboard/bookings'

  function goToBookings() {
    onClose()
    const date = meta?.date
    router.push(date ? `${bookingsHref}?date=${date}` : bookingsHref)
  }

  // új összefoglaló (design 22.2): desktopon széles, két hasáb; a teendő-sor oda visz, ahol intézni kell
  const digest = (n.metadata as { digest?: DigestData } | null)?.digest
  if (digest) {
    const base = isRest ? '/restaurant' : '/dashboard'
    const go = (href: string) => { onClose(); router.push(href) }
    return (
      <PopupModal open={open} onClose={onClose} title={isEvening ? 'Esti összefoglaló' : 'Reggeli összefoglaló'} subtitle={`${digest.day} · ${timeAgo(n.createdAt)}`} maxWidth="sm:max-w-[880px]">
        <DigestBody wide data={digest} onOpenDay={goToBookings}
          onTodo={(k) => go(k === 'bday' ? `${base}/guests` : k === 'unclosed' ? `${base}/bookings?date=${(() => { const d = new Date(`${meta?.date ?? ''}T12:00:00`); if (isNaN(d.getTime())) return ''; d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()}` : `${base}/bookings`)} />
      </PopupModal>
    )
  }

  return (
    <PopupModal open={open} onClose={onClose} title={n.title} subtitle={`${notifDate(n.createdAt)} · ${timeAgo(n.createdAt)}`} maxWidth="sm:max-w-[440px]">
      <div className="space-y-5">
        {/* Fő számok */}
        {meta && (
          <div className="flex flex-wrap gap-1.5">
            <Pill icon={CalendarDays}>{meta.bookings} foglalás</Pill>
            <Pill icon={Users}>{meta.guests} fő</Pill>
            {meta.team_count != null && meta.team_count > 0 && <Pill>{meta.team_count} munkatárs</Pill>}
            {meta.revenue_huf != null && meta.revenue_huf > 0 && <Pill icon={Banknote}>{meta.revenue_huf.toLocaleString('hu-HU')} Ft</Pill>}
          </div>
        )}

        {/* Vendégkör — új vs visszatérő */}
        {meta && (meta.new_guests ?? 0) + (meta.returning_guests ?? 0) > 0 && (
          <Block label="Vendégkör">
            <div className="grid grid-cols-2 gap-1.5">
              <Num value={meta.new_guests ?? 0} label="Új vendég" />
              <Num value={meta.returning_guests ?? 0} label="Visszatérő" />
            </div>
          </Block>
        )}

        {/* Legnépszerűbb szolgáltatások — szalon */}
        {meta?.top_services && meta.top_services.length > 0 && (
          <Block label="Legnépszerűbb szolgáltatások">
            <div className="flex flex-wrap gap-1.5">
              {meta.top_services.map((s) => <Pill key={s.name} size="sm">{s.name}<span className="text-ui-muted">· {s.bookings}</span></Pill>)}
            </div>
          </Block>
        )}

        {/* Vendégek országa — étterem, a telefon-előhívóból */}
        {meta?.countries && Object.keys(meta.countries).length > 0 && <CountryDonut countries={meta.countries} />}

        {/* Alkalmak — étterem, a választott esemény-típus ikonjával */}
        {meta?.occasions && Object.keys(meta.occasions).length > 0 && (
          <Block label="Alkalmak">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(meta.occasions).map(([occ, info]) => {
                const OccIcon = eventIconByKey(info.icon)
                return (
                  <Pill key={occ} size="sm">
                    <OccIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {occLabel(occ)}<span className="text-ui-muted">· {info.count}</span>
                  </Pill>
                )
              })}
            </div>
          </Block>
        )}

        {/* Munkatársak — szalon */}
        {meta?.staff_breakdown && meta.staff_breakdown.length > 0 && (
          <Block label="Munkatársak">
            <Card tone="cell" pad="none" inner className="px-1">
              {meta.staff_breakdown.map((s) => <ListRow key={s.name} title={s.name} trailing={<span className="text-ui-body tabular-nums text-ui-muted">{s.bookings} foglalás</span>} />)}
            </Card>
          </Block>
        )}

        {/* Esti: foglalás forrása */}
        {isEvening && meta?.source && (
          <Block label="Foglalás forrása">
            <div className="grid grid-cols-3 gap-1.5">
              {meta.source.walk_in != null && <Num value={meta.source.walk_in} label="Beeső" />}
              {meta.source.phone != null && <Num value={meta.source.phone} label="Telefon" />}
              {meta.source.online != null && <Num value={meta.source.online} label="Online" />}
            </div>
          </Block>
        )}

        {/* Esti: státusz */}
        {isEvening && meta?.status && (
          <Block label="Státusz">
            <div className="flex flex-wrap gap-1.5">
              {meta.status.completed != null && <StatusPill status="ok">{meta.status.completed} teljesült</StatusPill>}
              {meta.status.cancelled != null && <StatusPill status="bad">{meta.status.cancelled} lemondva</StatusPill>}
              {meta.status.no_show != null && <StatusPill status="neutral">{meta.status.no_show} nem jött</StatusPill>}
            </div>
          </Block>
        )}

        {/* Műszakvezető */}
        {meta?.shift_manager && (
          <Block label="Műszakvezető">
            <Card tone="cell" pad="none" inner className="px-1">
              <ListRow leading={<Avatar src={meta.shift_manager.avatar_url ?? null} size="sm" />} title={meta.shift_manager.name} />
            </Card>
          </Block>
        )}

        <Button size="lg" icon={ArrowRight} onClick={goToBookings} className="w-full">Napi foglalások megtekintése</Button>
      </div>
    </PopupModal>
  )
}
