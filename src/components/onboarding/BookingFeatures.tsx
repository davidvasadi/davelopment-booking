'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, type LucideIcon } from 'lucide-react'
import { Toggle } from '@/components/settings/SettingsToggle'
import { EASE, DUR } from '@/lib/motion'

/**
 * FOGLALÁSI FUNKCIÓK — kapcsolható modulok (Crextio design, 1:1 a
 * `docs/design_handoff_davelopment/Schedulio Csomag.dc.html` „Foglalási funkciók"
 * képernyője szerint). Ez váltja fel a Tippek oldal tartalmát.
 *
 * A modul-állapotok a VALÓS `feature_modules` group-mezőbe mentődnek — a Beállítások közös
 * lebegő mentés-sávján keresztül (`onDirtyChange`/`registerApi`, ugyanaz a szerződés, mint a
 * profil-form `SettingsFormApi`-ja): a kapcsolók csak a helyi állapotot váltják, a tényleges
 * PATCH a sáv „Mentés" gombjára történik.
 */

type Variant = 'restaurant' | 'salon'

/** A VALÓS `feature_modules` group (payload-types) — a PATCH body ezt küldi. */
export type FeatureModules = {
  reminders_on: boolean
  reminder_ch_email: boolean; reminder_ch_push: boolean
  reminder_t_24h: boolean; reminder_t_3h: boolean; reminder_t_1h: boolean
  reminder_t_48h?: boolean | null
  reminder_custom_hours?: number | null
  waitlist_on: boolean; waitlist_auto_promote: boolean
  recurring_on: boolean
  reviews_on: boolean
  google_review_url?: string | null
  review_delay_hours?: number | null
  google_booking_confirmed?: boolean | null
}

/* ── Kis kapcsolható „chip" (pl. időzítés / csatorna) ── */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-dav-chip border px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-[0.97] ${
        on
          ? 'border-transparent bg-ink-dark text-white'
          : 'border-line bg-white text-ink-soft2 hover:border-line-strong'
      }`}
    >
      {children}
    </button>
  )
}

/* ── Modul-kártya váz: fő-toggle + kinyíló al-beállítások ── */
function ModuleCard({
  icon: Icon,
  title,
  desc,
  on,
  onToggle,
  disabled,
  children,
}: {
  icon: LucideIcon
  title: string
  desc: string
  on: boolean
  onToggle: () => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-dav-lg dav-card-glass p-5 lg:p-6 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-dav-sm bg-gold/15 text-ink-dark">
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{desc}</p>
          </div>
        </div>
        <Toggle checked={on} onChange={disabled ? () => {} : onToggle} label={`${title} be/ki`} disabled={disabled} />
      </div>

      <AnimatePresence initial={false}>
        {on && children && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.base, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-5 border-t border-line pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft2">{children}</div>
}


type Feats = {
  reminders: { on: boolean; times: { h48: boolean; h24: boolean; h3: boolean; h1: boolean }; customHours: number | null; channels: { email: boolean; push: boolean } }
}

function featsFrom(fm: FeatureModules): Feats {
  return {
    reminders: {
      on: fm.reminders_on,
      times: { h48: !!fm.reminder_t_48h, h24: fm.reminder_t_24h, h3: fm.reminder_t_3h, h1: fm.reminder_t_1h },
      customHours: fm.reminder_custom_hours ?? null,
      channels: { email: fm.reminder_ch_email, push: fm.reminder_ch_push },
    },
  }
}

/**
 * A `waitlist_on`/`waitlist_auto_promote`/`recurring_on` ÉS a `reviews_on`/`google_review_url`/
 * `review_delay_hours` mezőknek NINCS UI-ja ezen a panelen (utóbbi három a Beállítások → Google
 * fülre költözött, `GoogleSettingsPanel.tsx`) — ezért ITT sose szabad kitalált értéket küldeni
 * rájuk, mindig a szerverről érkezett `initial`-ból megőrzött, ÉRINTETLEN értéket írjuk vissza.
 * Enélkül minden emlékeztető-kapcsoló mentés csendben lenullázná a várólista/ismétlődés/
 * Google-értékelés beállítást, bármi is volt korábban elmentve — a Payload group mező PATCH-nél
 * nem deep-mergel, a küldött objektum a teljes csoportot lecseréli.
 */
function featsToModules(
  f: Feats,
  preserve: Pick<FeatureModules, 'waitlist_on' | 'waitlist_auto_promote' | 'recurring_on' | 'reviews_on' | 'google_review_url' | 'review_delay_hours' | 'google_booking_confirmed'>,
): FeatureModules {
  return {
    reminders_on: f.reminders.on,
    reminder_ch_email: f.reminders.channels.email,
    reminder_ch_push: f.reminders.channels.push,
    reminder_t_48h: f.reminders.times.h48,
    reminder_t_24h: f.reminders.times.h24,
    reminder_t_3h: f.reminders.times.h3,
    reminder_t_1h: f.reminders.times.h1,
    reminder_custom_hours: f.reminders.customHours,
    waitlist_on: preserve.waitlist_on,
    waitlist_auto_promote: preserve.waitlist_auto_promote,
    recurring_on: preserve.recurring_on,
    reviews_on: preserve.reviews_on,
    google_review_url: preserve.google_review_url,
    review_delay_hours: preserve.review_delay_hours,
    google_booking_confirmed: preserve.google_booking_confirmed,
  }
}

export function BookingFeatures({
  variant,
  apiBase,
  initial,
  embedded = false,
  onDirtyChange,
  registerApi,
}: {
  variant: Variant
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase?: string
  /** `feature_modules` kezdőérték; ha nincs, alapértelmezett (mentés csak apiBase-szel). */
  initial?: FeatureModules
  /** Beágyazott mód (Beállítások-panel): nincs saját nagy fejléc + külső padding —
   *  a szekció-cím a HUB-ból jön. */
  embedded?: boolean
  /** A panel felfelé jelenti a mentetlen-állapotát a hub közös lebegő sávjának. */
  onDirtyChange?: (dirty: boolean) => void
  /** A hub ezen regisztrálja a mentés/elvetés műveletet (a közös sáv ezt hívja). */
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}) {
  const baseline = useMemo<Feats>(
    () => (initial ? featsFrom(initial) : {
      reminders: { on: true, times: { h48: false, h24: true, h3: true, h1: false }, customHours: null, channels: { email: true, push: false } },
    }),
    [initial],
  )
  const [feats, setFeats] = useState<Feats>(baseline)

  const dirty = JSON.stringify(feats) !== JSON.stringify(baseline)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (mutator: (f: Feats) => Feats) => setFeats(mutator)

  // A save/discard mindig a LEGFRISSEBB `feats`-et lássa a registerApi egyszeri regisztrációja
  // után is (a hub csak mountkor hívja registerApi-t) — ezért ref-en át olvassuk.
  const featsRef = useRef(feats)
  featsRef.current = feats
  useEffect(() => {
    registerApi?.({
      save: async () => {
        if (!apiBase) return false
        try {
          const res = await fetch(apiBase, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              feature_modules: featsToModules(featsRef.current, {
                waitlist_on: initial?.waitlist_on ?? false,
                waitlist_auto_promote: initial?.waitlist_auto_promote ?? false,
                recurring_on: initial?.recurring_on ?? false,
                reviews_on: initial?.reviews_on ?? false,
                google_review_url: initial?.google_review_url ?? null,
                review_delay_hours: initial?.review_delay_hours ?? 1,
                google_booking_confirmed: initial?.google_booking_confirmed ?? false,
              }),
            }),
          })
          if (!res.ok) throw new Error()
          return true
        } catch {
          toast.error('Hiba történt')
          return false
        }
      },
      discard: () => {
        setFeats(baseline)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline])

  return (
    <div className={embedded ? 'space-y-4 font-onest' : 'space-y-6 p-5 font-onest lg:p-0'}>
      {/* ── Fejléc (csak önálló oldalon; beágyazva a HUB adja a címet) ── */}
      {!embedded && (
        <div className="rounded-dav-lg dav-card-glass p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-light leading-[1.1] tracking-[-0.02em] text-ink lg:text-[42px]">
                Foglalási funkciók
              </h1>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-soft lg:text-sm">
                Emlékeztetők, várólista és több — kapcsolható modulok.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4">
        {/* ── Automata emlékeztetők ── */}
        <ModuleCard
          icon={Bell}
          title="Automata emlékeztetők"
          desc="E-mail / push a foglalás előtt"
          on={feats.reminders.on}
          onToggle={() => update((f) => ({ ...f, reminders: { ...f.reminders, on: !f.reminders.on } }))}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
            <div>
              <GroupLabel>Időzítés a foglalás előtt</GroupLabel>
              <div className="flex flex-wrap gap-2.5">
                {([
                  ['h48', '2 nappal'],
                  ['h24', '24 órával'],
                  ['h3', '3 órával'],
                  ['h1', '1 órával'],
                ] as const).map(([k, l]) => (
                  <Chip
                    key={k}
                    on={feats.reminders.times[k]}
                    onClick={() =>
                      update((f) => ({
                        ...f,
                        reminders: { ...f.reminders, times: { ...f.reminders.times, [k]: !f.reminders.times[k] } },
                      }))
                    }
                  >
                    {l}
                  </Chip>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
                Egyedi:
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={336}
                  value={feats.reminders.customHours ?? ''}
                  onChange={(e) => {
                    const n = e.target.value === '' ? null : Math.max(1, Math.min(336, Math.round(Number(e.target.value))))
                    update((f) => ({ ...f, reminders: { ...f.reminders, customHours: Number.isFinite(n as number) ? n : null } }))
                  }}
                  placeholder="pl. 72"
                  className="h-9 w-20 rounded-[10px] border border-line-strong bg-white px-2.5 text-[16px] text-ink focus:outline-none lg:text-[13px]"
                />
                órával előtte
              </label>
            </div>
            <div>
              <GroupLabel>Csatorna</GroupLabel>
              <div className="flex flex-wrap gap-2.5">
                {([
                  ['email', 'E-mail'],
                  ['push', 'Push'],
                ] as const).map(([k, l]) => (
                  <Chip
                    key={k}
                    on={feats.reminders.channels[k]}
                    onClick={() =>
                      update((f) => ({
                        ...f,
                        reminders: { ...f.reminders, channels: { ...f.reminders.channels, [k]: !f.reminders.channels[k] } },
                      }))
                    }
                  >
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </ModuleCard>

      </div>
    </div>
  )
}
