'use client'

import { IconCircle } from '@/components/ui-kit'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Scissors, UtensilsCrossed } from 'lucide-react'
import { SERVICES } from '@/lib/davelopmentServices'
import { EASE, SHEET_SPRING } from '@/lib/motion'
import { FEATURE_GROUPS, featureHref, groupCoverImage, groupHref, type FeatureGroupId } from '@/lib/landingFeatures'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { CoverStage } from '@/components/landing/CoverStage'
import { GROUP_COVERS } from '@/components/blocks/covers'

/**
 * Landing nav — „Funkciók” és „Kinek” lenyíló (desktop). Funkciók: balra a 6 csoport (fehér csúszó
 * kapszula), középen a kijelölt csoport funkciói, jobbra a világos csoport-borító; rámutatásra a
 * csoport vált. Egy sötét szín van: a nav aktív pilljéé (brand-ink), sárga nincs.
 * Kinek: Szakembereknek / Éttermeknek + az iparági aloldalak.
 */
export type MegaId = 'features' | 'audience'

// a „Csapatkezelés” téma-oldal, nem iparág — a Kinek menüből kimarad
const SALON_INDUSTRIES = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'salon' && l.slug !== 'csapatkezeles-kisvallalkozasoknak')
const RESTAURANT_INDUSTRIES = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'restaurant')

export function useMegaMenu() {
  const [open, setOpen] = useState<MegaId | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  // kis késleltetés, hogy a gombról a panelre átvitt egér ne zárja be
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(null), 80) }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    // kívülre kattintva bezár (a homályos réteg átengedi a kattintást, ezért itt figyeljük)
    const onDown = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('[data-mega-root]')) setOpen(null) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  return { open, setOpen, cancelClose, scheduleClose }
}

/** A pill-menü egy lenyíló gombja (rámutatásra és kattintásra is nyit). */
export function MegaTrigger({ id, label, mega, layoutId = 'nav-active-pill', activeCls = 'bg-white ', className = '', activeTextCls = 'text-ui-text', inactiveTextCls = 'text-ui-text' }: {
  id: MegaId; label: string; mega: ReturnType<typeof useMegaMenu>
  layoutId?: string; activeCls?: string; className?: string; activeTextCls?: string; inactiveTextCls?: string
}) {
  const isOpen = mega.open === id
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={isOpen ? `mega-${id}` : undefined}
      onMouseEnter={() => { mega.cancelClose(); mega.setOpen(id) }}
      onMouseLeave={mega.scheduleClose}
      onClick={() => mega.setOpen(isOpen ? null : id)}
      className={`relative flex items-center gap-1 rounded-full ${className} ${isOpen ? activeTextCls : inactiveTextCls}`}
    >
      {isOpen && (
        <motion.span aria-hidden layoutId={layoutId} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className={`absolute inset-0 rounded-full ${activeCls}`} />
      )}
      <span className="relative">{label}</span>
      <ChevronDown className={`relative h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
    </button>
  )
}

/** A lenyíló panel — body-ra portálozva, fix pozícióban a menüsor alatt (`top`), hogy a hero
 *  overflow-ja ne vágja le. */
export function MegaPanel({ mega, top, anchorRef }: { mega: ReturnType<typeof useMegaMenu>; top: number; anchorRef?: React.RefObject<HTMLElement | null> }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const mask = useHoleMask(!!mega.open, anchorRef)
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {mega.open && (
        // Háttér-homályosítás az EGÉSZ oldalon; csak a menü-pill körül marad egy kerekített „lyuk”
        // (SVG maszk), így a pill éles és a hover nem szakad meg. Csak az opacity animál (a blur mértéke fix → olcsó); ahol nincs
        // backdrop-filter, sima sötétítés marad. Kattintásra bezár; képernyőolvasónak rejtett.
        <motion.div
          key="mega-backdrop"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}
          className="pointer-events-none fixed inset-0 z-[65] hidden bg-ui-dark/25 [will-change:opacity] supports-[backdrop-filter]:bg-ui-dark/15 supports-[backdrop-filter]:backdrop-blur-[6px] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none min-[1033px]:block"
        />
      )}
      {mega.open && (
        // Az admin értesítés/avatar popoverének „genie” rugója: scale-ugrás + enyhe túllendülés,
        // felülről kinőve. Funkciók ↔ Kinek váltáskor a doboz NEM indul újra: nyitva marad, a
        // magassága folyamatosan igazodik (mért magasság), a tartalom keresztáttűnéssel vált.
        <motion.div
          key="mega"
          variants={{
            hidden: { opacity: 0, scale: 0.92, y: -12 },
            show: { opacity: 1, scale: 1, y: 0, transition: SHEET_SPRING },
            exit: { opacity: 0, scale: 0.98, y: -6, transition: { duration: 0.12, ease: 'easeIn' } },
          }}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseEnter={mega.cancelClose}
          onMouseLeave={mega.scheduleClose}
          data-mega-root
          style={{ top, transformOrigin: '50% 0%' }}
          className="fixed inset-x-0 z-[70] hidden px-5 pt-2 font-onest min-[1033px]:block"
        >
          <MegaBody>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={mega.open}
                id={`mega-${mega.open}`}
                role="region"
                aria-label={mega.open === 'features' ? 'Funkciók' : 'Kinek'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30, delay: 0.05 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                {mega.open === 'features' ? <FeaturesPanel onPick={() => mega.setOpen(null)} /> : <AudiencePanel onPick={() => mega.setOpen(null)} />}
              </motion.div>
            </AnimatePresence>
          </MegaBody>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function FeaturesPanel({ onPick }: { onPick: () => void }) {
  const [groupId, setGroupId] = useState<FeatureGroupId>('booking')
  const group = FEATURE_GROUPS.find((g) => g.id === groupId) ?? FEATURE_GROUPS[0]
  return (
    <div>
      <div className="grid grid-cols-[210px_1fr_300px]">
        {/* Csoportok — az aktív fekete kapszula, arany ikonnal */}
        <div className="border-r border-black/[0.06] bg-ui-cell p-3">
          {FEATURE_GROUPS.map((g) => {
            const on = g.id === groupId
            const Icon = g.icon
            return (
              <Link
                key={g.id}
                href={groupHref(g)}
                onMouseEnter={() => setGroupId(g.id)}
                onFocus={() => setGroupId(g.id)}
                onClick={onPick}
                className="relative flex w-full items-center gap-2.5 rounded-ui-inner px-3 py-2.5 text-left text-ui-row font-medium"
              >
                {on && <motion.span aria-hidden layoutId="mega-group-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-ui-inner bg-white shadow-ui-float" />}
                <Icon className={`relative h-[18px] w-[18px] shrink-0 transition-colors ${on ? 'text-ui-text' : 'text-ui-muted'}`} strokeWidth={1.8} />
                <span className={`relative transition-colors ${on ? 'text-ui-text' : 'text-ui-muted hover:text-ui-text'}`}>{g.label}</span>
                {on && <ChevronRight className="relative ml-auto h-4 w-4 text-ui-muted" strokeWidth={2} />}
              </Link>
            )
          })}
        </div>

        {/* A csoport funkciói — rámutatásra az ikon-négyzet fekete + arany */}
        <div className="p-4">
          <p className="px-3 pb-2 text-ui-meta font-medium uppercase text-ui-muted">{group.label}</p>
          <div className="grid grid-cols-2 gap-1">
            {group.items.map((f) => {
              const Icon = f.icon
              return (
                <Link key={f.slug} href={featureHref(f)} onClick={onPick} className="group flex items-start gap-3 rounded-ui-inner p-3 transition-colors duration-200 hover:bg-ui-cell">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-ui-cell text-ui-text transition-colors duration-200 group-hover:bg-ui-dark group-hover:text-white">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-ui-row font-medium text-ui-text">
                      {f.title}
                      <ChevronRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-50" strokeWidth={2.4} />
                    </span>
                    <span className="mt-0.5 block text-ui-body leading-snug text-ui-muted">{f.desc}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Csoport-borító — világos kártya: fent a kép (amíg nincs: ikonos helyőrző), alatta név,
            mottó és „Összes funkció” a nav sötétjében; csoportváltáskor finoman átúszik */}
        <div className="p-3 pl-0">
          <Link href={groupHref(group)} onClick={onPick} className="group/cover flex h-full flex-col rounded-ui-card bg-ui-cell p-2 transition-colors hover:bg-ui-cell">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="flex h-full flex-col"
              >
                <div className="relative aspect-[1600/948] overflow-hidden rounded-ui-inner bg-white">
                  {GROUP_COVERS[group.id] ? (
                    <CoverStage>{GROUP_COVERS[group.id]}</CoverStage>
                  ) : groupCoverImage(group) ? (
                    <img src={groupCoverImage(group)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover/cover:scale-[1.03]" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ui-grey">
                      <group.icon className="h-14 w-14" strokeWidth={1.1} />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col px-3 pb-2 pt-4">
                  <p className="text-ui-row font-medium text-ui-text">{group.label}</p>
                  <p className="mt-1 text-ui-body leading-snug text-ui-muted">{group.tagline}</p>
                  {/* a landing sötét HeroButton-ja, kisebben (a kártya maga a link, ezért itt span);
                      rámutatásra ugyanúgy átcsúszik a nyíl */}
                  <span className="mt-auto self-start pt-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-ui-dark py-1.5 pl-4 pr-1.5 font-onest text-ui-body font-medium text-white">
                      Összes funkció
                      <IconCircle tone="yellow" size="sm" className="relative overflow-hidden">
                        <ArrowRight className="absolute h-4 w-4 transition-transform duration-300 ease-out group-hover/cover:translate-x-7" strokeWidth={2.2} />
                        <ArrowRight className="absolute h-4 w-4 -translate-x-7 transition-transform duration-300 ease-out group-hover/cover:translate-x-0" strokeWidth={2.2} />
                      </IconCircle>
                    </span>
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </Link>
        </div>
      </div>

      {/* A davelopment ügynökségi szolgáltatásai — külön sáv, hogy ne keveredjen az app funkcióival */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-black/[0.06] bg-ui-cell px-5 py-3">
        <span className="mr-2 text-ui-meta font-medium text-ui-muted"><span className="text-ui-text">[davelopment]©</span> szolgáltatások</span>
        {SERVICES.filter((sv) => sv.label !== 'Időpontfoglaló rendszer').map((sv) => (
          <a key={sv.label} href={sv.href} target="_blank" rel="noopener noreferrer" onClick={onPick} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-ui-body font-medium text-ui-muted transition-colors hover:bg-white hover:text-ui-text">{/* ui-allow: menü-link, hoverre kapszula */}
            {sv.label}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-40" strokeWidth={2} />
          </a>
        ))}
      </div>
    </div>
  )
}

function AudiencePanel({ onPick }: { onPick: () => void }) {
  const cols = [
    { title: 'Szakembereknek', desc: 'Szalonok, rendelők, stúdiók — egyedül vagy csapattal.', icon: Scissors, items: SALON_INDUSTRIES },
    { title: 'Éttermeknek', desc: 'Asztalfoglalás termekre és asztalokra, előleggel.', icon: UtensilsCrossed, items: RESTAURANT_INDUSTRIES },
  ]
  return (
    <div className="grid grid-cols-[1.6fr_1fr] divide-x divide-black/[0.06]">
      {cols.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.title} className="p-5">
            <div className="flex items-start gap-3 px-1">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-control bg-ui-cell text-ui-text">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-ui-row font-medium text-ui-text">{c.title}</p>
                <p className="text-ui-body text-ui-muted">{c.desc}</p>
              </div>
            </div>
            <div className={`mt-4 grid gap-1 ${c.items.length > 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {c.items.map((l) => (
                <Link key={l.slug} href={`/${l.slug}`} onClick={onPick} className="flex items-center justify-between rounded-ui-control px-3 py-2 text-ui-body font-medium text-ui-text transition-colors hover:bg-ui-cell hover:text-ui-text">
                  {INDUSTRY_SHORT_LABEL[l.slug] ?? l.slug}
                  <ChevronRight className="h-4 w-4 opacity-40" strokeWidth={2} />
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Mobil: kétszintes („drill-down”) menü, ahogy a Framer-sablonokban. Az 1. szinten a Funkciók /
 * Kinek sor `›` jellel; koppintásra jobbról becsúszik a saját képernyője (‹ Vissza + cím + kompakt
 * lista). A logó és a bezáró X (z-90) felette marad. Saját görgetés, a Lenis nem nyeli el.
 */
export function MobileMegaAccordion({ onPick }: { onPick: () => void }) {
  const [sub, setSub] = useState<MegaId | null>(null)
  const reduce = useReducedMotion()
  const head = 'flex w-full items-center justify-between rounded-ui-inner px-4 py-1.5 text-left text-ui-sub lg:text-ui-page font-medium text-ui-text'
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
  return (
    <>
      {([['features', 'Funkciók'], ['audience', 'Kinek']] as const).map(([id, label]) => (
        <motion.button key={id} type="button" variants={item} transition={{ duration: 0.35, ease: EASE }} whileTap={{ scale: 0.98 }} onClick={() => setSub(id)} aria-haspopup="true" aria-expanded={sub === id} className={head}>
          <span>{label}</span>
          <ChevronRight className="h-7 w-7 text-ui-muted" strokeWidth={2} />
        </motion.button>
      ))}

      <AnimatePresence>
        {sub && (
          <motion.div
            key="mobile-sub"
            role="dialog"
            aria-label={sub === 'features' ? 'Funkciók' : 'Kinek'}
            data-lenis-prevent
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain bg-white"
          >
            <div className="h-[76px] shrink-0" />
            <div className="px-5">
              <button type="button" onClick={() => setSub(null)} className="-ml-1 flex items-center gap-1 py-2 text-ui-row font-medium text-ui-muted active:text-ui-text">
                <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={2.2} /> Vissza
              </button>
              <p className="mt-1 text-ui-num lg:text-ui-page font-light leading-none text-ui-text">
                {sub === 'features' ? 'Funkciók' : 'Kinek'}
              </p>
            </div>
            <motion.div
              className="flex-1 px-3 pb-10 pt-5"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: 0.12 } } }}
            >
              {sub === 'features' ? (
                <>
                  <ul className="divide-y divide-black/[0.06]">
                    {FEATURE_GROUPS.map((g) => {
                      const Icon = g.icon
                      return (
                        <motion.li key={g.id} variants={SUB_ITEM}>
                          <Link href={groupHref(g)} onClick={onPick} className="flex items-center gap-3.5 rounded-ui-inner px-2 py-3 active:bg-black/[0.03]">
                            {/* borítókép (group.cover), amíg nincs: sötét csempe arany ikonnal */}
                            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-ui-inner bg-ui-cell text-ui-text">
                              {GROUP_COVERS[g.id] ? (
                                <CoverStage>{GROUP_COVERS[g.id]}</CoverStage>
                              ) : groupCoverImage(g) ? (
                                <img src={groupCoverImage(g)} alt="" width={112} height={112} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              ) : (
                                <Icon className="h-6 w-6" strokeWidth={1.8} />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-ui-row font-medium text-ui-text">{g.label}</span>
                              <span className="block truncate text-ui-body text-ui-muted">{g.tagline}</span>
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-ui-grey" strokeWidth={2} />
                          </Link>
                        </motion.li>
                      )
                    })}
                  </ul>
                  <motion.div variants={SUB_ITEM} className="px-2 pt-4">
                    <Link href={'/funkciok'} onClick={onPick} className="flex w-full items-center justify-between rounded-full bg-ui-dark py-3.5 pl-6 pr-3 font-onest text-ui-row font-medium text-white">
                      Összes funkció egy helyen
                      <IconCircle icon={ChevronRight} tone="yellow" size="md" />
                    </Link>
                  </motion.div>
                </>
              ) : (
                ([['Szakembereknek', Scissors, SALON_INDUSTRIES], ['Éttermeknek', UtensilsCrossed, RESTAURANT_INDUSTRIES]] as const).map(([title, Icon, items]) => (
                  <div key={title} className="mb-6">
                    <motion.p variants={SUB_ITEM} className="flex items-center gap-2 px-2 pb-1 text-ui-meta font-medium uppercase text-ui-muted">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {title}
                    </motion.p>
                    <ul className="divide-y divide-black/[0.06]">
                      {items.map((l) => (
                        <motion.li key={l.slug} variants={SUB_ITEM}>
                          <Link href={`/${l.slug}`} onClick={onPick} className="flex items-center justify-between rounded-ui-control px-2 py-3 text-ui-row font-medium text-ui-text active:bg-black/[0.03]">
                            {INDUSTRY_SHORT_LABEL[l.slug] ?? l.slug}
                            <ChevronRight className="h-4 w-4 text-ui-grey" strokeWidth={2} />
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const SUB_ITEM = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 34 } },
}

/** Teljes képernyős maszk egy kerekített lyukkal az `anchor` elem körül (a homályosítás alól
 *  kivágva). Megnyitáskor, görgetéskor és átméretezéskor (rAF-fel ritkítva) mér újra. */
function useHoleMask(active: boolean, anchorRef?: React.RefObject<HTMLElement | null>) {
  const [mask, setMask] = useState<string | undefined>(undefined)
  // layout effect: a maszk a homályosítás első képkockáján már kész (különben a menü is
  // elhomályosulna egy pillanatra, és villanna)
  useLayoutEffect(() => {
    if (!active || !anchorRef?.current) { setMask(undefined); return }
    let raf = 0
    const measure = () => {
      raf = 0
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const W = window.innerWidth, H = window.innerHeight, rad = r.height / 2
      const hole = `M${r.left + rad},${r.top}h${r.width - 2 * rad}a${rad},${rad} 0 0 1 0,${r.height}h${-(r.width - 2 * rad)}a${rad},${rad} 0 0 1 0,${-r.height}z`
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'><path fill-rule='evenodd' d='M0,0H${W}V${H}H0Z${hole}'/></svg>`
      setMask(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active, anchorRef])
  return mask
}

/** A panel doboza: a tartalom magasságát méri (ResizeObserver), és arra animál folyamatosan —
 *  Funkciók ↔ Kinek váltáskor nincs layout-ugrás, a régi tartalom kiúszik, az új beúszik. */
function MegaBody({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    setH(el.offsetHeight)
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div
      initial={false}
      animate={{ height: h ?? 'auto' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      className="mx-auto max-w-[1120px] overflow-hidden rounded-ui-card border border-black/[0.06] bg-white shadow-ui-float"
    >
      <div ref={inner} className="relative">{children}</div>
    </motion.div>
  )
}
