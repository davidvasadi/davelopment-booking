'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Users, Star, Repeat, Check, ChevronDown, ExternalLink, type LucideIcon } from 'lucide-react'

/**
 * FOGLALÁSI FUNKCIÓK — kapcsolható modulok (Crextio design, 1:1 a
 * `docs/design_handoff_davelopment/Schedulio Csomag.dc.html` „Foglalási funkciók"
 * képernyője szerint). Ez váltja fel a Tippek oldal tartalmát.
 *
 * A modul-állapotok a VALÓS `feature_modules` group-mezőbe mentődnek AUTO-SAVE módon:
 * minden toggle-váltás azonnal PATCH-eli az endpointot (`apiBase`), finom „Mentve ✓"
 * visszajelzéssel — nincs külön mentés-gomb.
 */

type Variant = 'restaurant' | 'salon'

/** A VALÓS `feature_modules` group (payload-types) — a PATCH body ezt küldi. */
export type FeatureModules = {
  reminders_on: boolean
  reminder_ch_email: boolean; reminder_ch_push: boolean
  reminder_t_24h: boolean; reminder_t_3h: boolean; reminder_t_1h: boolean
  waitlist_on: boolean; waitlist_auto_promote: boolean
  recurring_on: boolean
  reviews_on: boolean
  /** Ha megadva, a visszajelzés-email a Google értékelő-oldalra visz (különben belső /review). */
  google_review_url?: string | null
}

const EASE = [0.22, 1, 0.36, 1] as const

/* ── Crextio toggle: 46×27 sín, aktív=ink-dark + gold knob jobbra, inaktív=#DAD5C6 + fehér knob balra ── */
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: on ? '#1D1C19' : '#DAD5C6' }}
    >
      <span
        className="absolute top-[3px] h-[21px] w-[21px] rounded-full transition-all duration-200"
        style={{
          left: on ? '22px' : '3px',
          background: on ? '#F1CE45' : '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }}
      />
    </button>
  )
}

/* ── Kis kapcsolható „chip" (pl. időzítés / csatorna) ── */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-[13px] border px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-[0.97] ${
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
  children,
}: {
  icon: LucideIcon
  title: string
  desc: string
  on: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-[26px] bg-white p-5 shadow-dav-card lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#F7F3E4] text-[#9A7B12]">
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{desc}</p>
          </div>
        </div>
        <Toggle on={on} onClick={onToggle} label={`${title} be/ki`} />
      </div>

      <AnimatePresence initial={false}>
        {on && children && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-5 border-t border-[#efebdf] pt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A29B82]">{children}</div>
}

/* ── al-sor: „automatikus előléptetés" stílusú beágyazott toggle-sor ── */
function InlineToggleRow({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string
  desc: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-line bg-[#FBF9F2] px-4 py-3.5">
      <div>
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[11.5px] text-ink-soft">{desc}</div>
      </div>
      <Toggle on={on} onClick={onToggle} label={`${title} be/ki`} />
    </div>
  )
}

type Feats = {
  reminders: { on: boolean; times: { h24: boolean; h3: boolean; h1: boolean }; channels: { email: boolean; push: boolean } }
  waitlist: { on: boolean; autoPromote: boolean }
  recurring: { on: boolean; freq: 'weekly' | 'biweekly' | 'monthly' }
  reviews: { on: boolean; delay: 'h1' | 'h2' | 'next'; googleUrl: string }
}

function featsFrom(fm: FeatureModules): Feats {
  return {
    reminders: {
      on: fm.reminders_on,
      times: { h24: fm.reminder_t_24h, h3: fm.reminder_t_3h, h1: fm.reminder_t_1h },
      channels: { email: fm.reminder_ch_email, push: fm.reminder_ch_push },
    },
    waitlist: { on: fm.waitlist_on, autoPromote: fm.waitlist_auto_promote },
    // freq/delay-nek nincs séma-mezője → lokális UI-state alapérték.
    recurring: { on: fm.recurring_on, freq: 'weekly' },
    reviews: { on: fm.reviews_on, delay: 'h2', googleUrl: fm.google_review_url ?? '' },
  }
}

function featsToModules(f: Feats): FeatureModules {
  return {
    reminders_on: f.reminders.on,
    reminder_ch_email: f.reminders.channels.email,
    reminder_ch_push: f.reminders.channels.push,
    reminder_t_24h: f.reminders.times.h24,
    reminder_t_3h: f.reminders.times.h3,
    reminder_t_1h: f.reminders.times.h1,
    waitlist_on: f.waitlist.on,
    waitlist_auto_promote: f.waitlist.autoPromote,
    recurring_on: f.recurring.on,
    reviews_on: f.reviews.on,
    google_review_url: f.reviews.googleUrl.trim() || null,
  }
}

export function BookingFeatures({
  variant,
  apiBase,
  initial,
  embedded = false,
}: {
  variant: Variant
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase?: string
  /** `feature_modules` kezdőérték; ha nincs, alapértelmezett (mentés csak apiBase-szel). */
  initial?: FeatureModules
  /** Beágyazott mód (Beállítások-panel): nincs saját nagy fejléc + külső padding —
   *  a szekció-cím a HUB-ból jön, csak a modul-kártyák + egy finom „Mentve ✓" látszik. */
  embedded?: boolean
}) {
  const router = useRouter()
  const [feats, setFeats] = useState<Feats>(
    initial ? featsFrom(initial) : {
      reminders: { on: true, times: { h24: true, h3: true, h1: false }, channels: { email: true, push: false } },
      waitlist: { on: true, autoPromote: true },
      recurring: { on: true, freq: 'weekly' },
      reviews: { on: true, delay: 'h2', googleUrl: '' },
    },
  )
  const [saved, setSaved] = useState(false)
  // A Google-link szöveges mező draftja — csak blur-kor (nem minden leütésre) mentünk.
  const [googleUrlDraft, setGoogleUrlDraft] = useState(feats.reviews.googleUrl)
  const [googleHelpOpen, setGoogleHelpOpen] = useState(false)
  // Halk visszajelzés: Google-linknek tűnik-e? Elfogadjuk a rövid `g.page/…/review`-t, a
  // `writereview` linket, ÉS a sima Google Kereső/Maps üzlet-linket is (amit a „Vélemény írása"
  // után a címsorból másolnak) — ezek mind az adott üzlethez viszik a vendéget.
  const looksLikeGoogleReview = /(g\.page\/r\/|\/local\/writereview|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/(search|maps)|g\.co\/)/i.test(googleUrlDraft.trim())

  // AUTO-SAVE: minden toggle-váltás után PATCH-eli a `feature_modules` groupot.
  const update = (mutator: (f: Feats) => Feats) => {
    setFeats((prev) => {
      const next = mutator(prev)
      if (apiBase) {
        void fetch(apiBase, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ feature_modules: featsToModules(next) }),
        })
          .then((res) => {
            if (!res.ok) throw new Error()
            setSaved(true)
            setTimeout(() => setSaved(false), 1600)
            router.refresh()
          })
          .catch(() => toast.error('Hiba történt'))
      }
      return next
    })
  }

  const isSalon = variant === 'salon'
  const visitWord = isSalon ? 'kezelés' : 'látogatás'

  return (
    <div className={embedded ? 'space-y-4 font-onest' : 'space-y-6 p-5 font-onest lg:p-0'}>
      {/* ── Fejléc (csak önálló oldalon; beágyazva a HUB adja a címet) ── */}
      {!embedded && (
        <div className="rounded-[26px] bg-white p-6 shadow-dav-card lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[32px] font-light leading-[1.1] tracking-[-0.02em] text-ink lg:text-[42px]">
                Foglalási funkciók
              </h1>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-soft lg:text-sm">
                Emlékeztetők, várólista, értékelések és több — kapcsolható modulok.
              </p>
            </div>
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#2E9E63]"
                >
                  <Check className="h-4 w-4" strokeWidth={2.2} /> Mentve
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Beágyazott módban finom mentés-visszajelzés a kártyák felett. */}
      {embedded && (
        <div className="flex h-5 items-center justify-end">
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2E9E63]"
              >
                <Check className="h-4 w-4" strokeWidth={2.2} /> Mentve
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4">
        {/* ── Automata emlékeztetők ── */}
        <ModuleCard
          icon={Bell}
          title="Automata emlékeztetők"
          desc={`E-mail / push a foglalás előtt, „értékeld minket" a ${visitWord} után`}
          on={feats.reminders.on}
          onToggle={() => update((f) => ({ ...f, reminders: { ...f.reminders, on: !f.reminders.on } }))}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
            <div>
              <GroupLabel>Időzítés a foglalás előtt</GroupLabel>
              <div className="flex flex-wrap gap-2.5">
                {([
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

        {/* ── Várólista ── */}
        <ModuleCard
          icon={Users}
          title="Várólista"
          desc="Telt házkor automatikus sorba állítás"
          on={feats.waitlist.on}
          onToggle={() => update((f) => ({ ...f, waitlist: { ...f.waitlist, on: !f.waitlist.on } }))}
        >
          <InlineToggleRow
            title="Automatikus előléptetés"
            desc="Lemondáskor értesíti a következőt a listáról"
            on={feats.waitlist.autoPromote}
            onToggle={() =>
              update((f) => ({ ...f, waitlist: { ...f.waitlist, autoPromote: !f.waitlist.autoPromote } }))
            }
          />
        </ModuleCard>

        {/* ── Ismétlődő foglalás ── */}
        <ModuleCard
          icon={Repeat}
          title="Ismétlődő foglalás"
          desc={isSalon ? 'Rendszeres időpontok visszatérő vendégeknek' : 'Rendszeres asztalfoglalás törzsvendégeknek'}
          on={feats.recurring.on}
          onToggle={() => update((f) => ({ ...f, recurring: { ...f.recurring, on: !f.recurring.on } }))}
        >
          <GroupLabel>Alapértelmezett gyakoriság</GroupLabel>
          <div className="flex flex-wrap gap-2.5">
            {([
              ['weekly', 'Hetente'],
              ['biweekly', 'Kéthetente'],
              ['monthly', 'Havonta'],
            ] as const).map(([k, l]) => (
              <Chip
                key={k}
                on={feats.recurring.freq === k}
                onClick={() => update((f) => ({ ...f, recurring: { ...f.recurring, freq: k } }))}
              >
                {l}
              </Chip>
            ))}
          </div>
        </ModuleCard>

        {/* ── Értékelések ── */}
        <ModuleCard
          icon={Star}
          title="Értékelések"
          desc={`Automatikus értékeléskérés ${visitWord} után`}
          on={feats.reviews.on}
          onToggle={() => update((f) => ({ ...f, reviews: { ...f.reviews, on: !f.reviews.on } }))}
        >
          <GroupLabel>Kérés a {visitWord} után</GroupLabel>
          <div className="flex flex-wrap gap-2.5">
            {([
              ['h1', '1 órával'],
              ['h2', '2 órával'],
              ['next', 'Másnap'],
            ] as const).map(([k, l]) => (
              <Chip
                key={k}
                on={feats.reviews.delay === k}
                onClick={() => update((f) => ({ ...f, reviews: { ...f.reviews, delay: k } }))}
              >
                {l}
              </Chip>
            ))}
          </div>

          {/* Google értékelés link — ha kitöltve, a visszajelzés-email a Google-re visz (különben belső /review). */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <GroupLabel>Google értékelés link</GroupLabel>
              <button
                type="button"
                onClick={() => setGoogleHelpOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                Hogyan találom meg?
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${googleHelpOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
            </div>
            <input
              type="url"
              inputMode="url"
              value={googleUrlDraft}
              onChange={(e) => setGoogleUrlDraft(e.target.value)}
              onBlur={() => {
                const v = googleUrlDraft.trim()
                if (v !== feats.reviews.googleUrl) update((f) => ({ ...f, reviews: { ...f.reviews, googleUrl: v } }))
              }}
              placeholder="https://g.page/r/…/review"
              className="h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink placeholder:text-ink-soft2/60 outline-none transition-colors focus:border-gold/60 focus:ring-2 focus:ring-gold/25"
            />

            {/* Halk visszajelzés: jó linknek tűnik-e (csak ha van beírva valami) */}
            {googleUrlDraft.trim() !== '' && (
              looksLikeGoogleReview ? (
                <p className="inline-flex items-center gap-1 text-[12px] font-medium text-ok">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Ez Google értékelés-linknek tűnik.
                </p>
              ) : (
                <p className="text-[12px] font-medium text-warn">
                  Ez nem úgy néz ki, mint egy Google értékelés-link. Nézd meg a „Hogyan találom meg?" lépéseket.
                </p>
              )
            )}

            {/* Súgó — hogyan szerzi meg a linket (lépések + közvetlen Cégprofil-link) */}
            <AnimatePresence initial={false}>
              {googleHelpOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 rounded-[14px] border border-line bg-paper/50 p-4">
                    <ol className="space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
                      <li>
                        <b className="font-semibold text-ink">1.</b>{' '}
                        <b className="font-semibold text-ink">Keresd rá az üzleted nevére a Google-ban.</b>
                      </li>
                      <li>
                        <b className="font-semibold text-ink">2.</b> A „Vélemények" résznél kattints a{' '}
                        <b className="font-semibold text-ink">„+ Vélemény írása"</b> gombra — megnyílik a csillagozó ablak.
                      </li>
                      <li>
                        <b className="font-semibold text-ink">3.</b> Másold ki a böngésző{' '}
                        <b className="font-semibold text-ink">címsorából a linket</b>, és illeszd be ide.
                      </li>
                    </ol>
                    <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-soft2">
                      Még tisztább link (a vendégnek egy kattintás): a Cégprofil <b className="font-medium text-ink-soft">„Értékelések kérése"</b> kártyája ad egy rövid{' '}
                      <span className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-ink">g.page/…/review</span> linket.
                    </p>
                    <a
                      href="https://support.google.com/business/answer/3474122"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-ink-dark px-3.5 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Google súgó: értékelések kérése
                      <ExternalLink className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-[12px] leading-relaxed text-ink-soft">
              Ha megadod, a visszajelzés-email a <b className="font-semibold text-ink-soft">Google csillagozó-oldalára</b> visz; üresen a belső értékelés marad.
            </p>
          </div>
        </ModuleCard>
      </div>
    </div>
  )
}
