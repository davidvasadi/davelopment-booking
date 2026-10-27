'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, Users, Sunrise, Sunset, Banknote, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonHover, EASE, SHEET_SPRING } from '@/lib/motion'
import { UserAvatar } from './UserAvatar'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
import { COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { notifDate, timeAgo, type Notification, type DigestMetadata } from '@/lib/useNotifications'

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

// A davelopment chart-paletta (ugyanaz, mint a Statisztikák oldal `NationalityCard`-jában):
// belföldi = ink, külföldi = gold.
const CHART_C = { ink: '#1D1C19', accent: '#F1CE45' }
const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))

/** ISO-2 országkód → zászló emoji (Unicode regionális jelző betűk). */
function flagEmoji(iso: string): string {
  const code = iso.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
}

/** Belföldi (HU) vs külföldi arány kördiagramként — UGYANAZ az SVG/ívelt-szár minta, mint a
 *  Statisztikák oldal `NationalityCard`-jában (ink=belföldi, gold=külföldi). Kattintásra a
 *  részletes, teljes országnévvel + zászlóval ellátott lista a kártyán BELÜL nyílik ki (nem
 *  lebegő dropdown — az a sheet saját `overflow-y-auto`-ja miatt levágódna). */
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
  const inkLen = (domesticPct / 100) * CIRC
  const goldLen = (foreignPct / 100) * CIRC

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Vendégek országa</p>
      <div
        className="cursor-pointer rounded-[16px] border border-line bg-white px-4 py-3.5"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={R} fill="none" stroke={CHART_C.ink} strokeWidth="9" strokeDasharray={`${inkLen} ${CIRC}`} transform="rotate(-90 32 32)" strokeLinecap="round" />
              {foreign > 0 && (
                <circle cx="32" cy="32" r={R} fill="none" stroke={CHART_C.accent} strokeWidth="9" strokeDasharray={`${goldLen} ${CIRC}`} strokeDashoffset={-inkLen - (domestic > 0 && foreign > 0 ? 3 : 0)} transform="rotate(-90 32 32)" strokeLinecap="round" />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-[15px] font-bold tabular-nums text-ink">{total}</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-soft2">fő</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-[13px] text-ink-soft">
            <p className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_C.ink }} />
              <span className="text-ink">Belföldi</span>
              <span className="font-semibold tabular-nums text-ink">{domesticPct}%</span>
              <span className="text-ink-soft2">({domestic})</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHART_C.accent }} />
              <span className="text-ink">Külföldi</span>
              <span className="font-semibold tabular-nums text-ink">{foreignPct}%</span>
              <span className="text-ink-soft2">({foreign})</span>
            </p>
          </div>
        </div>
        <p className="mt-2.5 text-[12px] text-ink-soft2">Koppints a részletekért</p>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
                {sorted.map(([code, cnt]) => (
                  <div key={code} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <span className="shrink-0">{flagEmoji(code)}</span>
                      <span className="truncate">{COUNTRY_BY_CODE[code]?.name ?? code}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft2">{cnt}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * Reggeli/esti digest popup — mobilon alulról felcsúszó sheet, desktopon (lg+) középre
 * animálódó modal (a davelopment kártya-stílust követve: fehér alap, ink-dark/gold jelvények,
 * pill-alakú CTA — nem a régi pasztell sárga/kék fejléc). Helyben nyílik, nem navigál.
 */
export function DigestSheet({
  n,
  open,
  onClose,
}: {
  n: Notification
  open: boolean
  onClose: () => void
}) {
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

  // Portal mount — SSR-safe (createPortal csak kliens-oldalon)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Desktopon (lg+) középre animálódó modal, mobilon alulról felcsúszó sheet — ugyanaz a
  // minta, mint a `NewsletterManager`-ben (`matchMedia` + resize-listener).
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const upd = () => setIsDesktop(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])

  if (!mounted) return null

  const sheetMotion = isDesktop
    ? { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 12 }, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: SHEET_SPRING }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Pozicionáló réteg: mobilon alulra, desktopon középre igazít. */}
          <div className="fixed inset-0 z-[201] flex items-end justify-center lg:items-center lg:p-6">
            <motion.div
              key="sheet"
              {...sheetMotion}
              className="max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-white font-onest shadow-[0_18px_60px_-20px_rgba(29,28,25,.35)] lg:max-w-[440px] lg:rounded-[28px]"
              data-lenis-prevent
            >
              {/* Húzó fül — csak mobilon */}
              <div className="sticky top-0 flex justify-center bg-white pb-1 pt-3 lg:hidden">
                <div className="h-[4px] w-10 rounded-full bg-line-strong" />
              </div>

              {/* Fejléc */}
              <div className="mx-4 mb-4 mt-1 lg:mt-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-ink-dark">
                    {isEvening
                      ? <Sunset className="h-5 w-5 text-gold" strokeWidth={1.7} />
                      : <Sunrise className="h-5 w-5 text-gold" strokeWidth={1.7} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold leading-tight text-ink">{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-soft2">
                      {notifDate(n.createdAt)}
                      <span className="mx-1.5 opacity-40">·</span>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 transition-colors hover:bg-black/[0.05] hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Fő statisztikák */}
                {meta && (
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink">
                      <CalendarDays className="h-3.5 w-3.5 text-ink-soft2" />
                      {meta.bookings} foglalás
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink">
                      <Users className="h-3.5 w-3.5 text-ink-soft2" />
                      {meta.guests} fő
                    </span>
                    {meta.team_count != null && meta.team_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink">
                        {meta.team_count} munkatárs
                      </span>
                    )}
                    {meta.revenue_huf != null && meta.revenue_huf > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink">
                        <Banknote className="h-3.5 w-3.5 text-ink-soft2" />
                        {meta.revenue_huf.toLocaleString('hu-HU')} Ft
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4 px-4 pb-6">
                {/* Vendégkör — új vs visszatérő, a mai (vagy foglalt) egyedi vendégek közül */}
                {meta && (meta.new_guests ?? 0) + (meta.returning_guests ?? 0) > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Vendégkör</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-[16px] border border-line bg-white px-3 py-3 text-center">
                        <p className="text-xl font-bold tabular-nums text-ink">{meta.new_guests ?? 0}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft2">Új vendég</p>
                      </div>
                      <div className="rounded-[16px] border border-line bg-white px-3 py-3 text-center">
                        <p className="text-xl font-bold tabular-nums text-ink">{meta.returning_guests ?? 0}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft2">Visszatérő</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legnépszerűbb szolgáltatások — szalon */}
                {meta?.top_services && meta.top_services.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Legnépszerűbb szolgáltatások</p>
                    <div className="flex flex-wrap gap-2">
                      {meta.top_services.map((s) => (
                        <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper/60 px-3 py-1 text-[13px] font-medium text-ink">
                          {s.name}
                          <span className="ml-0.5 tabular-nums text-ink-soft2">· {s.bookings}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vendégek országa — étterem, a `country` mezőből (telefon-előhívó) */}
                {meta?.countries && Object.keys(meta.countries).length > 0 && (
                  <CountryDonut countries={meta.countries} />
                )}

                {/* Alkalmak — étterem, a választott esemény-típus ikonjával */}
                {meta?.occasions && Object.keys(meta.occasions).length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Alkalmak</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(meta.occasions).map(([occ, info]) => {
                        const OccIcon = eventIconByKey(info.icon)
                        return (
                          <span key={occ} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper/60 px-3 py-1 text-[13px] font-medium text-ink">
                            <OccIcon className="h-3.5 w-3.5 text-ink-soft2" strokeWidth={1.8} />
                            {occLabel(occ)}
                            <span className="ml-0.5 tabular-nums text-ink-soft2">· {info.count}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Staff breakdown — szalon */}
                {meta?.staff_breakdown && meta.staff_breakdown.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Munkatársak</p>
                    <div className="overflow-hidden rounded-[16px] border border-line bg-white">
                      {meta.staff_breakdown.map((s, i) => (
                        <div key={s.name} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-line')}>
                          <span className="text-[13.5px] font-medium text-ink">{s.name}</span>
                          <span className="text-[13.5px] tabular-nums text-ink-soft2">{s.bookings} foglalás</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Esti: forrás breakdown */}
                {isEvening && meta?.source && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Foglalás forrása</p>
                    <div className="grid grid-cols-3 gap-2">
                      {meta.source.walk_in != null && (
                        <div className="rounded-[16px] border border-line bg-white px-3 py-3 text-center">
                          <p className="text-xl font-bold tabular-nums text-ink">{meta.source.walk_in}</p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft2">Beeső</p>
                        </div>
                      )}
                      {meta.source.phone != null && (
                        <div className="rounded-[16px] border border-line bg-white px-3 py-3 text-center">
                          <p className="text-xl font-bold tabular-nums text-ink">{meta.source.phone}</p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft2">Telefon</p>
                        </div>
                      )}
                      {meta.source.online != null && (
                        <div className="rounded-[16px] border border-line bg-white px-3 py-3 text-center">
                          <p className="text-xl font-bold tabular-nums text-ink">{meta.source.online}</p>
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft2">Online</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Esti: státusz */}
                {isEvening && meta?.status && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Státusz</p>
                    <div className="flex flex-wrap gap-2">
                      {meta.status.completed != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F6EF] px-3 py-1.5 text-[13px] font-semibold text-ok">
                          ✓ {meta.status.completed} teljesült
                        </span>
                      )}
                      {meta.status.cancelled != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBE9E7] px-3 py-1.5 text-[13px] font-semibold text-bad">
                          ✕ {meta.status.cancelled} lemondva
                        </span>
                      )}
                      {meta.status.no_show != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink-soft">
                          ? {meta.status.no_show} nem jött
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Műszak vezető */}
                {meta?.shift_manager && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Műszak vezető</p>
                    <div className="flex items-center gap-3 rounded-[16px] border border-line bg-white px-4 py-3">
                      <UserAvatar name={meta.shift_manager.name} src={meta.shift_manager.avatar_url ?? null} size={36} />
                      <span className="text-[13.5px] font-semibold text-ink">{meta.shift_manager.name}</span>
                    </div>
                  </div>
                )}

                {/* CTA — foglalások oldal (pill-alakú, arany körös nyíllal, mint az app többi CTA-ja) */}
                <motion.button
                  type="button"
                  onClick={goToBookings}
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  whileTap="hover"
                  className="mt-2 flex h-12 w-full items-center justify-between rounded-full bg-ink-dark pl-5 pr-1.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Napi foglalások megtekintése
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold">
                    <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                      <ArrowRight className="h-4 w-4 text-ink-dark" />
                    </motion.div>
                    <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                      <ArrowRight className="h-4 w-4 text-ink-dark" />
                    </motion.div>
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
