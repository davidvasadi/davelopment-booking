'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, MessagesSquare } from 'lucide-react'
import type { Pricing } from '@/lib/pricing'
import { businessMonthlyFee, applyCycle } from '@/lib/tier'

/**
 * Csomag-kártyák a Csomag/Előfizetés oldalon — KÉT kártya az AKTÍV üzletre (Crextio „mappa-fül"
 * pricing kártya, arany hatch kerettel):
 *  - „Pro" = a normál, önkiszolgáló csomag (MINDEN funkció). A kártyán belül havi/éves CSÚSZKA
 *    (ELŐNÉZET), éves ciklusnál ÁTHÚZOTT havi ár → kedvezményes ár. A mappa-fül a STÁTUSZ
 *    (Aktív / Próba). A tényleges átállás a gombbal (`/api/subscription/select`).
 *  - „Egyedi" = testreszabott (kapcsolatfelvétel).
 */

type Kind = 'salon' | 'restaurant'
type Cycle = 'monthly' | 'annual'

const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
// Arany, átlós-vonalkázott (hatch) minta a mappa-fül kerethez.
const HATCH = 'repeating-linear-gradient(45deg, #F1CE45 0, #F1CE45 7px, #E6C238 7px, #E6C238 14px)'

function Feat({ ok, dark, children }: { ok: boolean; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={{ background: ok ? '#4a7a2a' : dark ? 'rgba(255,255,255,.08)' : '#E7E0CC' }}
      >
        <Check className="h-3 w-3" strokeWidth={3} style={{ color: '#fff' }} />
      </span>
      <span className={`text-[13.5px] ${dark ? 'text-white' : 'text-ink'}`}>{children}</span>
    </div>
  )
}

export function PricingCards({
  kind,
  pricing,
  annualDiscountPct,
  currentCycle,
  activeBusiness,
  isTrial,
}: {
  kind: Kind
  pricing: Pricing
  annualDiscountPct: number
  currentCycle: Cycle
  /** Az AKTÍV üzlet (amire a csomag vonatkozik). Null → csak megjelenítés. */
  activeBusiness: { type: Kind; id: string; tier: 'pro' | 'egyedi'; staffCount: number } | null
  isTrial: boolean
}) {
  const router = useRouter()
  const [previewCycle, setPreviewCycle] = useState<Cycle>(currentCycle)
  const [pending, setPending] = useState(false)

  const noun = kind === 'restaurant' ? 'Étterem' : 'Szalon'
  const isSalon = kind === 'salon'
  const staffCount = activeBusiness?.staffCount ?? 0
  const isAnnual = previewCycle === 'annual'

  // Ár: a nyers (havi ciklusú) díj = étterem fix / szalon alapdíj + per-fő. Éves = −kedvezmény.
  const monthlyRaw = businessMonthlyFee(pricing, kind, staffCount)
  const effMonthly = applyCycle(monthlyRaw, previewCycle, annualDiscountPct)
  const yearlyTotal = effMonthly * 12
  const extraPerStaff = applyCycle(pricing.salon_extra_staff_huf, previewCycle, annualDiscountPct)

  const billingNote = isAnnual
    ? `évi ${ft(yearlyTotal)}${isSalon ? ` · ${staffCount} naptár` : ''}`
    : isSalon
      ? `${staffCount} naptár · +${ft(extraPerStaff)}/további fő`
      : 'fix havidíj'

  const proFeats = [
    { label: 'Online foglaló oldal + naptár', ok: true },
    { label: 'Email visszaigazolás (.ics)', ok: true },
    { label: isSalon ? 'Korlátlan munkatárs (per-fő díj)' : 'Korlátlan terem & asztal', ok: true },
    { label: 'Analitika + vendég-térkép', ok: true },
    { label: 'Többnyelvű + offline (PWA)', ok: true },
    { label: 'Emlékeztetők, várólista, értékelések', ok: true },
  ]
  const customFeats = [
    { label: 'Minden a Próból', ok: true },
    { label: 'Több telephely egy fiókban', ok: true },
    { label: 'Egyedi fejlesztés az igényeidre', ok: true },
    { label: 'Testreszabott foglaló + arculat', ok: true },
    { label: 'Dedikált kapcsolattartó', ok: true },
    { label: 'Prioritásos támogatás & SLA', ok: true },
  ]

  async function selectPro() {
    if (!activeBusiness || pending) return
    setPending(true)
    try {
      const res = await fetch('/api/subscription/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeBusiness.type, id: activeBusiness.id, tier: 'pro', cycle: previewCycle }),
      })
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(e.error || 'hiba')
      }
      toast.success(`Mentve · ${isAnnual ? 'éves' : 'havi'} számlázás`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült menteni.')
    } finally {
      setPending(false)
    }
  }

  const sameCycle = previewCycle === currentCycle
  const proCta = sameCycle
    ? (isTrial ? 'Jelenlegi (próba)' : 'Jelenlegi csomag')
    : `Váltás ${isAnnual ? 'éves' : 'havi'} számlázásra`
  const tabLabel = activeBusiness?.tier === 'egyedi' ? 'Egyedi' : isTrial ? 'Próba' : 'Aktív'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-medium text-ink">Csomag</h2>
        <p className="text-[13px] text-ink-soft">
          {activeBusiness
            ? `A(z) aktív ${noun.toLowerCase()}ra vonatkozik · másik üzlethez válts át fent`
            : 'Az aktív üzletre vonatkozik'}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        {/* ── PRO — mappa-fül kártya, arany hatch keret ── */}
        <div className="relative flex flex-col">
          {/* Mappa-fül: a keret tetejéből kinövő fül (STÁTUSZ). A notch HATCH+mask → egybefolyik a kerettel. */}
          <div
            className="relative z-10 -mb-px ml-auto flex w-max items-center gap-1.5 rounded-t-[20px] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-dark"
            style={{ backgroundImage: HATCH }}
          >
            {tabLabel}
            <span className="h-1.5 w-1.5 rounded-full bg-ink-dark" />
            <span
              className="pointer-events-none absolute -left-[28px] bottom-0 h-[28px] w-[28px]"
              style={{
                backgroundImage: HATCH,
                WebkitMaskImage: 'radial-gradient(circle at top left, transparent 27px, #000 27.5px)',
                maskImage: 'radial-gradient(circle at top left, transparent 27px, #000 27.5px)',
              }}
            />
          </div>

          {/* Arany hatch keret (top-right lapos, hogy a fül egybefolyjon) */}
          <div className="rounded-[30px] rounded-tr-none p-[5px]" style={{ backgroundImage: HATCH, boxShadow: '0 30px 60px -26px rgba(40,35,15,.5)' }}>
            {/* Sötét belső kártya */}
            <div className="rounded-[26px] rounded-tr-[18px] bg-ink-dark p-6 text-white sm:p-7">
              <div className="text-[18px] font-semibold text-white">{noun} Pro</div>
              <div className="mt-0.5 text-[13px] text-white/55">Minden funkció · azonnal használható</div>

              {/* Havi/éves CSÚSZKA (előnézet) */}
              <div className="mt-4 inline-flex gap-1 rounded-dav-pill bg-white/10 p-1">
                {(['annual', 'monthly'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPreviewCycle(c)}
                    className={`rounded-[15px] px-3.5 py-1.5 text-[12.5px] transition-colors ${
                      previewCycle === c ? 'bg-white font-semibold text-ink-dark' : 'font-medium text-white/60 hover:text-white'
                    }`}
                  >
                    {c === 'annual' ? <>Éves <span className={previewCycle === 'annual' ? 'text-[#8a6d12]' : 'text-gold'}>−{annualDiscountPct}%</span></> : 'Havi'}
                  </button>
                ))}
              </div>

              {/* Ár — áthúzott havi → kedvezményes (éves esetén) */}
              <div className="mt-4 flex items-end gap-2.5">
                {isAnnual && (
                  <span className="text-[26px] font-light leading-none text-white/30 line-through">{monthlyRaw.toLocaleString('hu-HU')}</span>
                )}
                <span className="text-[40px] font-light leading-none tracking-[-0.02em] text-gold">{effMonthly.toLocaleString('hu-HU')}</span>
                <span className="mb-1 text-[13px] font-medium text-white/55">Ft / hó</span>
              </div>
              <div className="mt-1.5 text-[12px] text-gold/80">{billingNote}</div>

              {/* CTA */}
              <button
                type="button"
                onClick={sameCycle ? undefined : selectPro}
                disabled={sameCycle || pending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-center text-sm font-semibold text-ink-dark transition-opacity hover:opacity-90 disabled:opacity-90"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {proCta}
              </button>

              <div className="my-5 border-t border-dashed border-white/15" />
              <div className="flex flex-col gap-3">
                {proFeats.map((f, i) => <Feat key={i} ok={f.ok} dark>{f.label}</Feat>)}
              </div>
            </div>
          </div>
        </div>

        {/* ── EGYEDI — üveges mappa-fül kártya (a Pro párja, VILÁGOS füllel) ── */}
        <div className="relative flex flex-col">
          {/* Mappa-fül (világos, sötét szöveg) — notch mask-kal, egybefolyik a kártyával */}
          <div
            className="relative z-10 -mb-px ml-auto flex w-max items-center gap-1.5 rounded-t-[20px] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink"
            style={{ background: '#EFEDE6' }}
          >
            Egyedi
            <span className="h-1.5 w-1.5 rounded-full bg-ink-soft2" />
            <span
              className="pointer-events-none absolute -left-[28px] bottom-0 h-[28px] w-[28px]"
              style={{
                background: '#EFEDE6',
                WebkitMaskImage: 'radial-gradient(circle at top left, transparent 27px, #000 27.5px)',
                maskImage: 'radial-gradient(circle at top left, transparent 27px, #000 27.5px)',
              }}
            />
          </div>

          <div
            className="flex flex-1 flex-col rounded-[30px] rounded-tr-none border border-line p-6 shadow-dav-card backdrop-blur-[14px] sm:p-7"
            style={{ background: 'var(--dav-glass)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-ink-dark">
                <MessagesSquare className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
              </div>
              <div className="text-[18px] font-semibold text-ink">{noun} Egyedi</div>
            </div>
            <div className="mt-2 text-[13px] text-ink-soft">Nagyobb vagy speciális igény · testreszabva</div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
              Ha kinőtted a Pro-t, vagy speciális folyamataid vannak — összerakunk egy rád szabott csomagot, és igény szerint fejlesztünk.
            </p>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink">Egyedi</span>
              <span className="mb-1 text-[13px] font-medium text-ink-soft">ajánlat</span>
            </div>
            <div className="mt-1.5 text-[12px] text-ink-soft2">a megrendelővel egyeztetve</div>

            <a
              href={`mailto:hello@davelopment.hu?subject=Egyedi%20${encodeURIComponent(noun.toLowerCase())}%20csomag`}
              className="mt-5 block rounded-2xl bg-ink-dark py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Kapcsolatfelvétel
            </a>

            <div className="my-5 border-t border-dashed border-line-strong" />
            <div className="flex flex-col gap-3">
              {customFeats.map((f, i) => <Feat key={i} ok={f.ok}>{f.label}</Feat>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
