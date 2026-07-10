'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, Bell, Star, Users, Phone, Image as ImageIcon, FileText, MapPin, Clock,
  Info, Globe, LayoutGrid, Check, Zap, Loader2, type LucideIcon,
} from 'lucide-react'
import type { AdvisorResult, TipCard, TipCategory, TipAction } from '@/lib/tipsAdvisor'

/**
 * TIPPEK — javaslat-oldal (Crextio „Tippek — Javaslatok több foglaláshoz és jobb
 * vendégélményhez", `davelopment Bento.dc.html` 508–577). Az advisor motor (szerver:
 * `lib/tipsAdvisor.ts`) VALÓS eredményét rendereli: E heti tipp + egészség-score +
 * kategorizált, akcióképes javaslat-kártyák. A kártya-akció vagy azonnal PATCH-eli a
 * business-t (`apiBase`), vagy a releváns oldalra navigál.
 */

const EASE = [0.22, 1, 0.36, 1] as const

const CAT_LABEL: Record<TipCategory, string> = {
  foglalas: 'Foglalás',
  vendegelmeny: 'Vendégélmény',
  marketing: 'Marketing',
  profil: 'Profil',
}

const FILTERS: { id: 'all' | TipCategory; label: string }[] = [
  { id: 'all', label: 'Összes' },
  { id: 'profil', label: 'Profil' },
  { id: 'foglalas', label: 'Foglalás' },
  { id: 'vendegelmeny', label: 'Vendégélmény' },
  { id: 'marketing', label: 'Marketing' },
]

const CARD_ICON: Record<string, LucideIcon> = {
  'cfg-cover': ImageIcon,
  'cfg-logo': ImageIcon,
  'cfg-description': FileText,
  'cfg-contact': MapPin,
  'cfg-hours': Clock,
  'cfg-catalog': LayoutGrid,
  'cfg-good_to_know': Info,
  'cfg-languages': Globe,
  'feat-reminders': Bell,
  'feat-reviews': Star,
  'feat-waitlist': Users,
  'flag-require_phone': Phone,
}

export function TipsAdvisorView({
  variant,
  data,
  apiBase,
}: {
  variant: 'salon' | 'restaurant'
  data: AdvisorResult
  apiBase: string
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | TipCategory>('all')
  const [dismissedWeekly, setDismissedWeekly] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const healthWord = variant === 'salon' ? 'Szalon-egészség' : 'Étterem-egészség'

  const visible = useMemo(
    () => (filter === 'all' ? data.recommendations : data.recommendations.filter((c) => c.category === filter)),
    [filter, data.recommendations],
  )

  // Akció: PATCH (azonnali mentés) vagy navigáció.
  async function runAction(id: string, action: TipAction) {
    if (action.kind === 'nav') {
      if (action.href !== '#') router.push(action.href)
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(action.body),
      })
      if (!res.ok) throw new Error()
      toast.success(action.toast)
      router.refresh()
    } catch {
      toast.error('Nem sikerült menteni — próbáld újra.')
    } finally {
      setBusyId(null)
    }
  }

  const pending = data.checklist.filter((c) => !c.done)
  const score = Math.max(0, Math.min(100, data.healthScore))
  const CIRC = 2 * Math.PI * 42
  const dashoffset = CIRC * (1 - score / 100)

  return (
    <div className="space-y-5 p-5 font-onest lg:p-0">
      {/* ── Fejléc + kategória-szűrő ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[32px] font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[44px]">Tippek</h1>
          <p className="mt-1.5 text-[13px] text-ink-soft lg:text-sm">
            Javaslatok több foglaláshoz és jobb vendégélményhez
          </p>
        </div>
        <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:overflow-visible lg:px-0">
          <div className="inline-flex gap-1 rounded-[22px] bg-white p-1.5 shadow-dav-card">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`whitespace-nowrap rounded-[18px] px-4 py-2 text-[13px] font-medium transition-colors ${
                  filter === f.id ? 'bg-ink-dark text-white' : 'text-ink-soft2 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── E heti tipp + egészség-score ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* E heti tipp — sötét kártya */}
        <AnimatePresence mode="wait">
          {data.weeklyTip && !dismissedWeekly ? (
            <motion.div
              key={data.weeklyTip.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative overflow-hidden rounded-[30px] bg-ink-dark p-7 text-white lg:p-8"
              style={{ boxShadow: '0 22px 46px -24px rgba(40,35,15,.5)' }}
            >
              <Zap className="pointer-events-none absolute -bottom-8 -right-6 h-52 w-52 text-[#F1CE45] opacity-[0.07]" fill="currentColor" strokeWidth={0} />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-[#F1CE45]/[0.16] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#F1CE45]">
                <Zap className="h-3 w-3" fill="currentColor" strokeWidth={0} /> E heti tipp
              </span>
              <h2 className="relative mt-4 max-w-xl text-[24px] font-light leading-[1.25] tracking-[-0.01em] lg:text-[28px]">
                {data.weeklyTip.title}
              </h2>
              <p className="relative mt-3 max-w-lg text-[14px] leading-relaxed text-white/65 lg:text-[15px]">
                {data.weeklyTip.body}
              </p>
              {data.weeklyTip.metric && (
                <span className="relative mt-3 inline-block text-[13px] font-semibold text-[#F1CE45]">
                  {data.weeklyTip.metric}
                </span>
              )}
              <div className="relative mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => runAction(data.weeklyTip!.id, data.weeklyTip!.action)}
                  disabled={busyId === data.weeklyTip.id}
                  className="inline-flex items-center gap-2 rounded-[20px] bg-[#F1CE45] px-5 py-3 text-[14px] font-semibold text-ink-dark transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {busyId === data.weeklyTip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {data.weeklyTip.actionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedWeekly(true)}
                  className="rounded-[20px] border border-white/20 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/5"
                >
                  Később
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="weekly-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-[200px] flex-col items-center justify-center rounded-[30px] border border-dashed border-line-strong bg-white/50 p-8 text-center"
            >
              <Check className="h-7 w-7 text-[#2E9E63]" strokeWidth={2} />
              <p className="mt-3 text-[14px] font-medium text-ink">Nincs sürgős tipp a héten</p>
              <p className="mt-1 text-[12.5px] text-ink-soft">Jó úton haladsz — nézd meg a javaslatokat lentebb.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Egészség-score */}
        <div className="flex flex-col rounded-[30px] bg-[#FCFAF1] p-6 shadow-dav-card">
          <div className="text-[17px] font-semibold text-ink">{healthWord}</div>
          <div className="mt-3 flex items-center gap-5">
            <div className="relative flex shrink-0 items-center justify-center">
              <svg width="104" height="104" viewBox="0 0 104 104">
                <circle cx="52" cy="52" r="42" fill="none" stroke="#EFEAD8" strokeWidth="12" />
                <motion.circle
                  cx="52" cy="52" r="42" fill="none" stroke="#F1CE45" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={{ strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: dashoffset }}
                  transition={{ duration: 0.9, ease: EASE }}
                  transform="rotate(-90 52 52)"
                />
              </svg>
              <div className="absolute text-[26px] font-light tracking-[-0.02em] text-ink">{score}</div>
            </div>
            <div>
              <div className="text-[30px] font-light tracking-[-0.02em] text-ink">
                {score}
                <span className="text-[15px] font-medium text-ink-soft">/100</span>
              </div>
              <div className="mt-0.5 text-[13px] font-medium text-[#1D9D63]">{data.healthLabel}</div>
            </div>
          </div>
          <div className="my-4 h-px bg-line" />
          <div className="space-y-0.5">
            {data.checklist.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.done && router.push(item.href)}
                className={`flex w-full items-center gap-3 rounded-xl py-1.5 text-left ${
                  item.done ? 'cursor-default' : 'cursor-pointer hover:bg-white/60'
                }`}
              >
                {item.done ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F1CE45]">
                    <Check className="h-3 w-3 text-ink-dark" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#D9D3C4]" />
                )}
                <span className={`text-[13.5px] ${item.done ? 'text-ink-soft line-through' : 'font-medium text-ink'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Javaslat-kártyák ── */}
      <AnimatePresence mode="popLayout">
        {visible.length > 0 ? (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((card, i) => (
              <RecCard
                key={card.id}
                card={card}
                index={i}
                busy={busyId === card.id}
                onAction={() => runAction(card.id, card.action)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-[26px] border border-dashed border-line-strong bg-white/50 py-12 text-center"
          >
            <p className="text-[14px] font-medium text-ink">Ebben a kategóriában minden rendben 🎉</p>
            <p className="mt-1 text-[12.5px] text-ink-soft">Válts kategóriát a további javaslatokért.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RecCard({
  card,
  index,
  busy,
  onAction,
}: {
  card: TipCard
  index: number
  busy: boolean
  onAction: () => void
}) {
  const Icon = CARD_ICON[card.id] ?? Zap
  const enabled = card.state === 'enabled'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(index * 0.04, 0.24) }}
      className="flex flex-col rounded-[26px] bg-[#FCFAF1] p-5 shadow-dav-card lg:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${
            enabled ? 'bg-[#F1CE45]' : 'bg-ink-dark'
          }`}
        >
          <Icon className={`h-5 w-5 ${enabled ? 'text-ink-dark' : 'text-[#F1CE45]'}`} strokeWidth={1.7} />
        </span>
        <span className="rounded-lg border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-ink-soft2">
          {CAT_LABEL[card.category]}
        </span>
      </div>

      <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink">{card.title}</h3>
      <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-soft">{card.desc}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        {enabled ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1D9D63]">
            <Check className="h-4 w-4" strokeWidth={2.2} /> Bekapcsolva
          </span>
        ) : (
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Alkalmaz
            {!busy && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        )}
        {card.impact && !enabled && (
          <span className="text-[11.5px] font-medium text-ink-soft2">{card.impact}</span>
        )}
      </div>
    </motion.div>
  )
}
