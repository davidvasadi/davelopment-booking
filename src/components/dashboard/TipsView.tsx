'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertCircle, Bell, Calendar, Check, Clock, ExternalLink, FileText, Gift, Globe, Heart, Image as ImageIcon, Info, LayoutGrid, MapPin,
  MessageSquare, Phone, Send, ShieldCheck, Star, UserPlus, Users, Zap, type LucideIcon, Images, Mail, Receipt,
} from 'lucide-react'
import { Button, EmptyState, Modal, OptionCard, PageHead, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { HealthScoreCard, TIP_CATS, TipCard, WeeklyTipCard, type Tip } from '@/components/blocks/tips'
import type { AdvisorResult, TipAction, TipCategory } from '@/lib/tipsAdvisor'

/**
 * Tippek — szalon és étterem (design 14.1–14.4). Az advisor (`lib/tipsAdvisor`) valós eredménye: az „E heti tipp”
 * (lapozható), a foglalóoldal egészsége a teendőkkel, alatta a javaslat-kártyák kategóriánként. A művelet vagy azonnal
 * menti a beállítást (PATCH `apiBase`), vagy a megfelelő oldalra visz.
 */

const CATS: ('all' | TipCategory)[] = ['all', 'profil', 'foglalas', 'vendegelmeny', 'marketing']
const CAT_LABEL: Record<TipCategory, string> = { profil: 'Profil', foglalas: 'Foglalás', vendegelmeny: 'Vendégélmény', marketing: 'Marketing' }
const CARD_ICON: Record<string, LucideIcon> = {
  'cfg-cover': ImageIcon, 'cfg-logo': ImageIcon, 'cfg-description': FileText, 'cfg-contact': MapPin, 'cfg-hours': Clock, 'cfg-catalog': LayoutGrid,
  'cfg-good_to_know': Info, 'cfg-languages': Globe, 'feat-reminders': Bell, 'feat-reviews': Star, 'feat-waitlist': Users, 'flag-require_phone': Phone, 'growth-gallery': Images, 'growth-guest-email': Mail, 'growth-invoicing': Receipt,
  'sched-ahead': Calendar, 'booking-pending': AlertCircle, 'booking-notes': FileText, 'guest-loyalty': Heart, 'guest-notes': MessageSquare,
  'guest-reengagement': UserPlus, 'growth-vouchers': Gift, 'growth-reviews': ExternalLink, 'growth-deposit': ShieldCheck, 'growth-campaign': Send,
}

export function TipsView({ data, apiBase, canManage = false }: { data: AdvisorResult; apiBase: string; canManage?: boolean }) {
  const router = useRouter()
  const restaurant = data.variant === 'restaurant'
  const [cat, setCat] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [weekly, setWeekly] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  // értesítésből érkezve (?tip=<id>) a heti tipp pontosan azt mutatja; utána a paraméter kikerül a címből
  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get('tip')
    if (!id) return
    const i = data.weeklyTipPool.findIndex((w) => w.id === id)
    if (i >= 0) setWeekly(i)
    url.searchParams.delete('tip'); url.searchParams.delete('t')
    window.history.replaceState(null, '', url.pathname + url.search)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // mobil fejléc szűrő-ikonja (DashboardNav)
  useEffect(() => {
    const f = () => setFilterOpen(true)
    window.addEventListener('davelopment:open-tips-filter', f)
    return () => window.removeEventListener('davelopment:open-tips-filter', f)
  }, [])

  const run = async (id: string, action: TipAction) => {
    if (action.kind === 'nav') { if (action.href !== '#') router.push(action.href); return }
    if (!canManage) return
    setBusy(id)
    try {
      const r = await fetch(apiBase, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(action.body) })
      if (!r.ok) throw new Error()
      toast.success(action.toast); router.refresh()
    } catch { toast.error('Nem sikerült menteni — próbáld újra.') } finally { setBusy(null) }
  }
  const canAct = (a: TipAction) => a.kind === 'nav' || canManage

  const key = CATS[cat]
  const cards = useMemo(() => (key === 'all' ? data.recommendations : data.recommendations.filter((c) => c.category === key)), [key, data.recommendations])
  const tip = data.weeklyTipPool[weekly] ?? null
  const nextTip = () => setWeekly((i) => i + 1)

  const top = key === 'all' && (
    <div className="grid gap-[5px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <WeeklyTipCard restaurant={restaurant} tip={tip ? { title: tip.title, body: tip.body, metric: tip.metric, actionLabel: tip.actionLabel } : null} index={weekly} total={data.weeklyTipPool.length}
        onAction={tip && canAct(tip.action) ? () => void run(tip.id, tip.action) : undefined} onNext={nextTip} busy={!!tip && busy === tip.id} />
      <HealthScoreCard score={Math.max(0, Math.min(100, Math.round(data.healthScore)))} label={data.healthLabel} missing={data.checklist.filter((c) => !c.done).length}
        items={data.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done }))} onItem={(id) => { const c = data.checklist.find((x) => x.id === id); if (c) router.push(c.href) }} />
    </div>
  )
  const grid = cards.length ? (
    <div className={`grid gap-[5px] sm:grid-cols-2 xl:grid-cols-3 ${top ? 'mt-[5px]' : ''}`}>
      {cards.map((c) => {
        const t: Tip = { icon: CARD_ICON[c.id] ?? Zap, cat: CAT_LABEL[c.category], t: c.title, d: c.desc, impact: c.state === 'enabled' ? undefined : c.impact, on: c.state === 'enabled', action: canAct(c.action) ? (c.action.kind === 'patch' ? 'Bekapcsolom' : 'Megnyitás') : undefined }
        return <TipCard key={c.id} tip={t} onAction={() => void run(c.id, c.action)} busy={busy === c.id} />
      })}
    </div>
  ) : (
    <EmptyState icon={Check} title="Ebben a kategóriában minden rendben" action={key !== 'all' ? <Button variant="glass" onClick={() => setCat(0)}>Összes tipp</Button> : undefined}>Válts kategóriát a további javaslatokért.</EmptyState>
  )

  return (
    <div className="p-4 lg:p-0">
      <div className="max-lg:hidden">
        <PageHead title="Tippek" sub="Javaslatok több foglaláshoz és jobb vendégélményhez" actions={<Segmented options={[...TIP_CATS]} active={cat} onSelect={setCat} />} />
      </div>
      <div className="mb-4 lg:hidden">
        <div className="text-ui-num font-light leading-none text-ui-text">Tippek</div>
        <div className="mt-1 text-ui-meta text-ui-muted">{cat ? TIP_CATS[cat] : 'Összes kategória'}</div>
      </div>
      {top}
      {grid}
      <PopupModal open={filterOpen} onClose={() => setFilterOpen(false)} panel={
        <Modal title="Kategória" onClose={() => setFilterOpen(false)}>
          <div className="space-y-1">
            {TIP_CATS.map((c, i) => (
              <button key={c} type="button" onClick={() => { setCat(i); setFilterOpen(false) }} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                <OptionCard radio title={c} selected={i === cat} />
              </button>
            ))}
          </div>
        </Modal>
      } />
    </div>
  )
}
