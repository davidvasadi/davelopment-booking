'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion'
import { RevealText, Reveal } from '@/components/landing/Motion'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { FitCard } from '@/components/landing/FitCard'
import { GrainCanvas, DARK_SURFACE_BG } from '@/components/landing/GrainCanvas'
import { EASE, SPRING_SNAPPY } from '@/lib/motion'
import { FEATURE_GROUPS, groupHref, type FeatureGroupId, type LandingFeature } from '@/lib/landingFeatures'

/**
 * Főoldali „showcase” blokk egy funkció-csoporthoz. Egy család, négy változat (tónus × elrendezés),
 * hogy a blokkok ne legyenek egyformák:
 *  - tone: `dark` (rajzolt gradiens + grain) | `light` (fehér kártya)
 *  - layout: `split` (vonalas lista oldalt, app-ablak a másik oldalon kilógva; `flip` = tükrözve) |
 *            `bento` (nagy app-ablak + a funkciók ikonos kártyákként) |
 *            `stage` (középre zárt cím, vízszintes funkció-fülek, alul széles, kilógó app-ablak) |
 *            `cards` (fejléc + funkciókártyák saját képhellyel, léptetés nélkül)
 * Az aktív funkció látható állapotban magától lép (haladásjelzővel), kattintással is választható;
 * az ablakban az aktív funkció képe keresztáttűnéssel. Amíg nincs kép, helyettesítő panel.
 */
const STEP_MS = 5200

type Tone = 'dark' | 'light'

const TONE = {
  dark: {
    title: 'text-white', sub: 'text-white/55', on: 'text-white', off: 'text-white/45 hover:text-white/75',
    desc: 'text-white/55', line: 'border-white/10', bar: 'bg-white', tabOff: 'text-white/60 hover:text-white', tabPill: 'bg-white', tabOn: 'text-[#1D1C19]', tabTrack: 'bg-white/10',
  },
  light: {
    title: 'text-brand-ink', sub: 'text-brand-ink/55', on: 'text-brand-ink', off: 'text-brand-ink/40 hover:text-brand-ink/70',
    desc: 'text-brand-ink/55', line: 'border-black/[0.08]', bar: 'bg-brand-ink', tabOff: 'text-brand-ink/55 hover:text-brand-ink', tabPill: 'bg-brand-ink', tabOn: 'text-white', tabTrack: 'bg-[#F4F4F4]',
  },
} as const

function useAutoStep(n: number) {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const [touched, setTouched] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const reduce = useReducedMotion()
  const running = auto && inView && !reduce && n > 1
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => setActive((i) => (i + 1) % n), STEP_MS)
    return () => window.clearTimeout(t)
  }, [running, active, n])
  const pick = (i: number) => { setAuto(false); setTouched(true); setActive(i) }
  return { ref, active, pick, running, touched }
}

/** A világos app-ablak (fejléc pöttyökkel + az aktív funkció képe, keresztáttűnéssel). */
function AppWindow({ label, item, Icon, className, visual }: { label: string; item: LandingFeature; Icon: React.ElementType; className: string; visual?: React.ReactNode }) {
  const ItemIcon = item.icon
  return (
    <div className={`overflow-hidden bg-[#F4F4F4] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-black/[0.06] bg-white px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E3DC]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E3DC]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E3DC]" />
        <span className="ml-3 flex min-w-0 items-center gap-1.5 truncate text-[12px] font-medium text-brand-ink/45">
          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} /> {label} · {item.title}
        </span>
      </div>
      {/* a képernyőképek valódi arányában (≈1,69:1) — nincs levágott szél */}
      <div className="relative aspect-[1600/948]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={item.slug}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="absolute inset-0"
          >
            {visual ? (
              <FitCard fit="contain" w={560} className="h-full w-full bg-ui-page p-4">{visual}</FitCard>
            ) : item.image ? (
              <img src={item.image} alt={`${item.title} — davelopment booking`} loading="lazy" decoding="async" className="h-full w-full object-cover object-left-top" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-3 text-brand-ink/20">
                <ItemIcon className="h-14 w-14" strokeWidth={1.1} />
                <span className="text-[13px] font-medium">Képernyőkép: {item.title}</span>
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export function FeatureGroupSection({ groupId, title, subtitle, flip = false, tone = 'dark', layout = 'split', visuals }: {
  /** A funkciók képei helyén a design-kártyák (slug szerint, src/components/blocks). */
  visuals?: Record<string, React.ReactNode>
  groupId: FeatureGroupId
  /** `\n` = sortörés sm felett */
  title: string
  subtitle: string
  flip?: boolean
  tone?: Tone
  layout?: 'split' | 'stage' | 'bento' | 'cards'
}) {
  const group = FEATURE_GROUPS.find((g) => g.id === groupId)
  // a kártyasorban nincs léptetés → 0 elemmel az időzítő sem fut
  const { ref, active, pick, running, touched } = useAutoStep(layout === 'cards' ? 0 : (group?.items.length ?? 0))
  if (!group) return null
  const t = TONE[tone]
  const Icon = group.icon
  const item = group.items[active]
  const dark = tone === 'dark'

  const eyebrow = (
    <span className={`inline-flex self-start items-center gap-2 rounded-[8px] px-3 py-1.5 font-onest text-[14px] font-medium ${dark ? 'bg-white/10 text-white' : 'bg-[#F4F4F4] text-[#1D1C19]'}`}>
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      {group.label}
    </span>
  )
  const button = <HeroButton href={groupHref(group)} label={`${group.label} részletesen`} light={dark} />

  return (
    <section id={`funkcio-${group.slug}`} className="mx-auto max-w-7xl px-4 py-10 lg:px-5 lg:py-14">
      <Reveal>
        <div ref={ref} className={`relative isolate overflow-hidden rounded-[30px] ${dark ? '' : 'bg-white'}`} style={dark ? { background: DARK_SURFACE_BG } : undefined}>
          {dark && <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />}

          {layout === 'bento' ? (
            /* „Bento”: nagy app-ablak az egyik oldalon, a funkciók kártyákként a másikon */
            <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-4 lg:p-4">
              <AppWindow label={group.label} item={item} visual={visuals?.[item.slug]} Icon={Icon} className="self-center rounded-[18px] border border-black/[0.06]" />
              <div className="flex flex-col p-3 sm:p-5">
                {eyebrow}
                <RevealText text={title} className={`mt-4 font-medium text-[clamp(1.75rem,3vw,40px)] leading-[1.04] tracking-[-0.045em] ${t.title}`} />
                <p className={`mt-3 text-[15px] leading-[1.55] ${t.sub}`}>{subtitle}</p>
                <div className="mt-5 flex flex-col gap-1">
                  {group.items.map((f, i) => {
                    const on = i === active
                    const FIcon = f.icon
                    return (
                      <button key={f.slug} type="button" aria-expanded={on} onClick={() => pick(i)} className={`relative overflow-hidden rounded-[14px] px-3 py-2.5 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-brand-ink/25 ${on ? 'bg-[#F4F4F4]' : 'hover:bg-[#FAFAFA]'}`}>
                        <span className="flex items-center gap-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-300 ${on ? 'bg-brand-ink text-white' : 'bg-[#F4F4F4] text-brand-ink/60'}`}>
                            <FIcon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                          </span>
                          <span className={`text-[15px] font-medium ${on ? 'text-brand-ink' : 'text-brand-ink/60'}`}>{f.title}</span>
                        </span>
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="block overflow-hidden">
                              <span className="block pl-11 pt-1 text-[13.5px] leading-[1.5] text-brand-ink/55">{f.desc}</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {on && running && (
                          <motion.span key={active} className="absolute bottom-0 left-0 h-[2px] bg-brand-ink/70" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: STEP_MS / 1000, ease: 'linear' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-6">{button}</div>
              </div>
            </div>
          ) : layout === 'cards' ? (
            /* „Kártyasor”: fejléc (cím balra, gomb jobbra), alatta funkciókártyák saját képhellyel */
            <div className="p-3 lg:p-4">
              <div className="flex flex-col gap-5 p-3 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  {eyebrow}
                  <RevealText text={title} className={`mt-4 font-medium text-[clamp(1.75rem,3vw,40px)] leading-[1.04] tracking-[-0.045em] ${t.title}`} />
                  <p className={`mt-3 max-w-lg text-[15px] leading-[1.55] ${t.sub}`}>{subtitle}</p>
                </div>
                <div className="shrink-0">{button}</div>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((f, i) => {
                  const FIcon = f.icon
                  return (
                    <Reveal key={f.slug} delay={i * 0.05} className="group/fc flex flex-col rounded-[20px] bg-[#F7F7F7] p-2 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(30,28,20,.3)]">
                      <span className="relative block aspect-[1600/948] overflow-hidden rounded-[14px] bg-white">
                        {visuals?.[f.slug] ? (
                          <FitCard fit="contain" w={560} className="h-full w-full bg-ui-page p-3">{visuals[f.slug]}</FitCard>
                        ) : f.image ? (
                          <img src={f.image} alt={`${f.title} — davelopment booking`} loading="lazy" decoding="async" className="h-full w-full object-cover object-left-top transition-transform duration-700 group-hover/fc:scale-[1.04]" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-brand-ink/15"><FIcon className="h-12 w-12" strokeWidth={1.1} /></span>
                        )}
                      </span>
                      <span className="block p-3.5">
                        <span className="block text-[16px] font-semibold tracking-[-0.02em] text-brand-ink">{f.title}</span>
                        <span className="mt-1 block text-[13.5px] leading-[1.5] text-brand-ink/55">{f.desc}</span>
                      </span>
                    </Reveal>
                  )
                })}
              </div>
            </div>
          ) : layout === 'split' ? (
            <div className={`grid lg:min-h-[480px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${flip ? 'lg:[direction:rtl]' : ''}`}>
              {/* Szöveg + interaktív funkciólista */}
              <div className="flex flex-col justify-between gap-7 p-6 [direction:ltr] sm:p-8 lg:p-10">
                <div>
                  {eyebrow}
                  <RevealText text={title} className={`mt-4 font-medium text-[clamp(1.75rem,3vw,40px)] leading-[1.04] tracking-[-0.045em] ${t.title}`} />
                  <p className={`mt-3 max-w-md text-[15px] leading-[1.55] ${t.sub}`}>{subtitle}</p>
                </div>
                <div>
                  <ul className="flex flex-col">
                    {group.items.map((f, i) => {
                      const on = i === active
                      return (
                        <li key={f.slug} className={`border-t ${t.line}`}>
                          <button type="button" aria-expanded={on} onClick={() => pick(i)} className="w-full rounded-[6px] py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-current/30">
                            <span className={`block text-[15px] font-medium transition-colors duration-300 ${on ? t.on : t.off}`}>{f.title}</span>
                            <AnimatePresence initial={false}>
                              {on && (
                                <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="block overflow-hidden">
                                  <span className={`block pt-1 text-[13.5px] leading-[1.5] ${t.desc}`}>{f.desc}</span>
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </button>
                          <span className="relative -mt-px block h-px overflow-hidden">
                            {on && (
                              <motion.span key={`${active}-${running}`} className={`absolute inset-y-0 left-0 ${t.bar}`} initial={{ width: running ? '0%' : '100%' }} animate={{ width: '100%' }} transition={{ duration: running ? STEP_MS / 1000 : 0, ease: 'linear' }} />
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="mt-6">{button}</div>
                </div>
              </div>

              {/* Kilógó app-ablak */}
              <div className="relative px-5 [direction:ltr] lg:px-0 lg:pt-10">
                <AppWindow
                  label={group.label}
                  item={item}
                  visual={visuals?.[item.slug]}
                  Icon={Icon}
                  className={`relative rounded-t-[18px] shadow-[0_-10px_60px_-24px_rgba(0,0,0,.45)] lg:absolute lg:bottom-0 ${flip ? 'lg:-left-[8%] lg:right-12' : 'lg:left-12 lg:-right-[8%]'}`}
                />
              </div>
            </div>
          ) : (
            /* „Színpad”: középre zárt fejléc, vízszintes fülek, alul széles kilógó ablak */
            <div className="flex flex-col items-center px-5 pt-10 text-center sm:px-8 lg:pt-14">
              {eyebrow}
              <RevealText text={title} className={`mt-4 max-w-3xl font-medium text-[clamp(1.75rem,3vw,40px)] leading-[1.04] tracking-[-0.045em] ${t.title}`} />
              <p className={`mt-3 max-w-xl text-[15px] leading-[1.55] ${t.sub}`}>{subtitle}</p>

              <div role="tablist" aria-label={`${group.label} funkciók`} className={`mt-7 inline-flex max-w-full flex-wrap justify-center gap-1 rounded-[22px] p-1 ${t.tabTrack}`}>
                {group.items.map((f, i) => {
                  const on = i === active
                  return (
                    <button key={f.slug} type="button" role="tab" aria-selected={on} onClick={() => pick(i)} className="relative overflow-hidden rounded-full px-4 py-2 text-[13.5px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-current/30">
                      {on && <motion.span layoutId={touched ? `stage-${group.id}` : undefined} transition={SPRING_SNAPPY} className={`absolute inset-0 rounded-full ${t.tabPill}`} />}
                      <span className={`relative transition-colors ${on ? t.tabOn : t.tabOff}`}>{f.title}</span>
                      {on && running && (
                        <motion.span key={active} className={`absolute bottom-0 left-0 h-[2px] ${dark ? 'bg-[#1D1C19]/30' : 'bg-white/40'}`} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: STEP_MS / 1000, ease: 'linear' }} />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 h-[44px] max-w-xl">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={item.slug} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }} className={`text-[14px] leading-[1.5] ${t.desc}`}>
                    {item.desc}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="mt-4">{button}</div>

              <AppWindow
                label={group.label}
                item={item}
                visual={visuals?.[item.slug]}
                Icon={Icon}
                className={`mt-10 w-full max-w-[980px] rounded-t-[18px] ${dark ? 'shadow-[0_-10px_60px_-24px_rgba(0,0,0,.45)]' : 'border border-b-0 border-black/[0.06]'}`}
              />
            </div>
          )}
        </div>
      </Reveal>
    </section>
  )
}
