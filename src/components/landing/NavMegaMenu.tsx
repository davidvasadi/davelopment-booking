'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Scissors, UtensilsCrossed } from 'lucide-react'
import { SERVICES } from '@/lib/davelopmentServices'
import { EASE } from '@/lib/motion'
import { FEATURE_GROUPS, featurePath, groupCoverImage, groupHref, type FeatureGroupId } from '@/lib/landingFeatures'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { CoverStage } from '@/components/landing/CoverStage'
import { GROUP_COVERS } from '@/components/blocks/covers'
// a telefonos kép statikusan importálva: a főoldal úgyis betölti (landing-concepts), így lenyitáskor azonnal ott van
import { GroupPhone } from '@/components/blocks/landing-phone'

/**
 * Landing nav — „Funkciók” és „Kinek” lenyíló (desktop). Funkciók: balra a 6 csoport (fehér csúszó
 * kapszula), középen a kijelölt csoport funkciói, jobbra a világos csoport-borító; rámutatásra a
 * csoport vált. Egy sötét szín van: a nav aktív pilljéé (brand-ink), sárga nincs.
 * Kinek: Szakembereknek / Éttermeknek + az iparági aloldalak.
 */
export type MegaId = 'features' | 'audience' | 'studio'

// a „Csapatkezelés” téma-oldal, nem iparág — a Kinek menüből kimarad
const SALON_INDUSTRIES = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'salon' && l.slug !== 'csapatkezeles-kisvallalkozasoknak')
const RESTAURANT_INDUSTRIES = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'restaurant')

export function useMegaMenu() {
  const [open, setOpen] = useState<MegaId | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  // kis késleltetés, hogy a gombról a panelre átvitt egér ne zárja be
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpen(null), 180) }
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
export function MegaTrigger({ id, label, mega, layoutId = 'nav-active-pill', activeCls = 'bg-white shadow-sm', className = '', activeTextCls = 'text-brand-ink', inactiveTextCls = 'text-brand-ink' }: {
  id: MegaId; label: React.ReactNode; mega: ReturnType<typeof useMegaMenu>
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
      data-mega-trigger={id}
      className={`relative flex items-center gap-1 rounded-full ${className} ${isOpen ? activeTextCls : inactiveTextCls}`}
    >
      {isOpen && (
        <motion.span aria-hidden layoutId={layoutId} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className={`absolute inset-0 rounded-full ${activeCls}`} />
      )}
      <span className="relative">{label}</span>
      <ChevronDown className={`relative h-3.5 w-3.5 opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.8} />
    </button>
  )
}

/** A lenyíló panel — body-ra portálozva, fix pozícióban a menüsor alatt (`top`), hogy a hero
 *  overflow-ja ne vágja le. */
export function MegaPanel({ mega, top, anchorRef }: { mega: ReturnType<typeof useMegaMenu>; top: number; anchorRef?: React.RefObject<HTMLElement | null> }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // a telefon-keret képe előre betöltődik (az oldal után, ráérősen), hogy az első lenyitáskor ne ugorjon be később
  useEffect(() => {
    const t = setTimeout(() => {
      const img = new Image(); img.src = '/landing/mock/iphone-keret-davelopment-booking.webp'
    }, 2500)
    return () => clearTimeout(t)
  }, [])
  // a panel a menü-pill közepe alá kerül (a képernyő széleihez igazítva, hogy sose lógjon ki)
  // Framer-minta: a panel a megnyitó gomb alá, a gomb bal széléhez igazodik (a képernyő szélén belül tartva)
  const [anchorLeft, setAnchorLeft] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!mega.open) return
    const el = document.querySelector<HTMLElement>(`[data-mega-trigger="${mega.open}"]`) ?? anchorRef?.current
    if (el) setAnchorLeft(el.getBoundingClientRect().left)
  }, [mega.open, anchorRef])
  if (!mounted) return null
  const width = mega.open === 'features' ? 600 : mega.open === 'studio' ? 520 : 440
  const left = anchorLeft == null ? undefined : Math.min(Math.max(16, anchorLeft - 12), window.innerWidth - width - 16)
  return createPortal(
    <AnimatePresence>
      {mega.open && (
        <motion.div
          key="mega"
          // a külső rétegen CSAK mozgás (transform) — opacity/clip itt kikapcsolná az üveg-blurt (backdrop root),
          // ettől volt egy pillanatig teljesen átlátszó, majd hirtelen homályos. Az áttűnést a MegaBody rétegei viszik.
          // lenyíláskor finom rugó (enyhe túllendülés), záráskor gyors, rugó nélkül
          variants={{ hidden: { y: -10, scale: 0.98, transition: { duration: 0.12, ease: 'easeIn' } }, show: { y: 0, scale: 1, transition: { type: 'spring', stiffness: 460, damping: 24, mass: 0.7 } } }}
          initial="hidden"
          animate="show"
          exit="hidden"
          onMouseEnter={mega.cancelClose}
          onMouseLeave={mega.scheduleClose}
          data-mega-root
          // pt-3: láthatatlan „híd” a menü és a panel között — átvitt egérrel nem zár be
          style={{ top: top - 4, left, width, transformOrigin: '30% 0%' }}
          className="fixed z-[70] hidden pt-3 font-onest min-[1033px]:block"
        >
          <MegaBody>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mega.open}
                id={`mega-${mega.open}`}
                role="region"
                aria-label={mega.open === 'features' ? 'Funkciók' : mega.open === 'studio' ? 'davelopment szolgáltatások' : 'Kinek'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.14 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
              >
                {mega.open === 'features' ? <FeaturesPanel onPick={() => mega.setOpen(null)} /> : mega.open === 'studio' ? <StudioPanel onPick={() => mega.setOpen(null)} /> : <AudiencePanel onPick={() => mega.setOpen(null)} />}
              </motion.div>
            </AnimatePresence>
          </MegaBody>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Funkciók — két tábla (duopane, Framer-minta): balra a hat csoport (kis ikon-csempe, név, egy sor), jobbra a
 *  rámutatott csoport telefonos képe a rendszerből, sarokban nyíllal. */
function FeaturesPanel({ onPick }: { onPick: () => void }) {
  const [groupId, setGroupId] = useState<FeatureGroupId>('booking')
  const group = FEATURE_GROUPS.find((g) => g.id === groupId) ?? FEATURE_GROUPS[0]
  // a hat telefon egyszer épül fel: rámutatáskor a panel újrarenderel, de ugyanaz az elem-referencia → nem rajzolja újra
  const phones = useMemo(() => FEATURE_GROUPS.map((g) => (
    <GroupPhone key={g.id} id={g.id} className="absolute left-1/2 top-6 w-[176px] -translate-x-1/2 transition-transform duration-300 ease-out group-hover/cover:-translate-y-1" />
  )), [])
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-1.5 p-1.5">
        <div className="py-0.5">
          {FEATURE_GROUPS.map((g) => {
            const Icon = g.icon
            const on = g.id === groupId
            return (
              <Link key={g.id} href={groupHref(g)} onClick={onPick} onMouseEnter={() => setGroupId(g.id)} onFocus={() => setGroupId(g.id)}
                className={`flex items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors duration-150 ${on ? 'bg-ui-cell/60' : ''}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 ${on ? 'bg-ui-dark text-white' : 'bg-ui-cell/60 text-ui-text'}`}> {/* ui-allow: Framer-féle ikon-csempe */}
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-ui-body font-medium text-ui-text">{g.label}</span>
                  <span className="block truncate text-ui-meta text-ui-muted">{g.tagline}</span>
                </span>
              </Link>
            )
          })}
        </div>
        {/* a kép: a csoport telefonos nézete a rendszerből (a telefon alja levágva); rámutatásra vált — mind a hat egyszer
            renderelve, csak az átlátszóság vált (nem szaggat). A sarokban nyíl: a csoport oldalára visz. */}
        <Link href={groupHref(group)} onClick={onPick} aria-label={`${group.label} — funkciók`} className="group/cover relative min-h-[300px] overflow-hidden rounded-[12px] bg-ui-yellow/15">
          {FEATURE_GROUPS.map((g) => (
            // saját réteg (will-change): a váltás csak áttűnés a GPU-n, nem rajzol újra
            <div key={g.id} className={`absolute inset-0 transition-opacity duration-200 ease-out [contain:paint] [will-change:opacity] ${g.id === group.id ? 'opacity-100' : 'opacity-0'}`}>
              {phones[FEATURE_GROUPS.indexOf(g)]}
            </div>
          ))}
          <span className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ui-text shadow-[0_4px_12px_-6px_rgba(0,0,0,.3)] transition-colors group-hover/cover:bg-ui-dark group-hover/cover:text-white">
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(to_top,#FFF9E7_0%,#FFF9E7_45%,rgba(255,249,231,.85)_65%,rgba(255,249,231,0)_100%)] px-3 pb-3 pt-16"><span className="inline-flex rounded-full bg-white px-3 py-1.5 text-ui-body font-medium text-ui-text">{group.label}</span></span>
        </Link>
      </div>
    </div>
  )
}

/** davelopment — az anyacég szolgáltatásai: balra a davelopment.hu füstös háttere a logóval, jobbra a lista (külső linkek). */
function StudioPanel({ onPick }: { onPick: () => void }) {
  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-1.5 p-1.5">
      <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" onClick={onPick} aria-label="davelopment.hu" className="group/studio relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[12px] bg-ui-cell p-3.5"> {/* ui-allow: mega-menü kártya */}
        <img src="/landing/hero/davelopment-fust-hatter-davelopment-booking.webp" alt="" width={640} height={640} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/studio:scale-105" />
        <span className="relative self-end flex h-8 w-8 items-center justify-center rounded-full bg-white text-ui-text shadow-[0_4px_12px_-6px_rgba(0,0,0,.3)] transition-colors group-hover/studio:bg-ui-dark group-hover/studio:text-white"> {/* ui-allow */}
          <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="relative">
          <img src="/logo_davelopment_dark.svg" alt="davelopment" width={2034} height={526} className="h-[26px] w-auto" /> {/* ui-allow */}
          <span className="mt-1.5 block text-ui-meta text-ui-text/70">Webes ügynökség — a davelopment booking mögött.</span>
        </span>
      </a>
      <div className="flex flex-col py-0.5">
        <p className="px-2.5 pb-1.5 pt-1 text-ui-label uppercase tracking-[0.06em] text-ui-muted">davelopment szolgáltatások</p>
        {SERVICES.filter((sv) => sv.label !== 'Időpontfoglaló rendszer').map((sv) => (
          <a key={sv.label} href={sv.href} target="_blank" rel="noopener noreferrer" onClick={onPick} className="group/sv flex items-center justify-between rounded-[10px] px-2.5 py-2 text-ui-body text-ui-text transition-colors duration-150 hover:bg-ui-cell/60"> {/* ui-allow */}
            {sv.label}
            <ArrowUpRight className="h-3.5 w-3.5 text-ui-muted transition-colors group-hover/sv:text-ui-text" strokeWidth={2} />
          </a>
        ))}
      </div>
    </div>
  )
}

/** Kinek — két hasáb, kis felirattal; egyszerű, sűrű sorok (Framer-minta). */
function AudiencePanel({ onPick }: { onPick: () => void }) {
  const cols = [
    { title: 'Szakembereknek', items: SALON_INDUSTRIES },
    { title: 'Vendéglátóknak', items: RESTAURANT_INDUSTRIES },
  ]
  return (
    <div className="grid grid-cols-[1fr_0.8fr] gap-1.5 p-1.5">
      {cols.map((c) => (
        <div key={c.title} className="py-1">
          <p className="px-2.5 pb-1.5 pt-1 text-ui-label uppercase tracking-[0.06em] text-ui-muted">{c.title}</p>
          {c.items.map((l) => (
            <Link key={l.slug} href={`/${l.slug}`} onClick={onPick} className="block rounded-[10px] px-2.5 py-1.5 text-ui-body text-ui-text transition-colors duration-150 hover:bg-ui-cell/60">
              {INDUSTRY_SHORT_LABEL[l.slug] ?? l.slug}
            </Link>
          ))}
        </div>
      ))}
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
  const head = 'flex w-full items-center justify-between rounded-[12px] px-1 py-2 text-left text-[clamp(1.75rem,8vw,2.125rem)] font-medium tracking-[-0.035em] text-ui-text'
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }
  return (
    <>
      {([['features', 'Funkciók']] as const).map(([id, label]) => (
        <motion.button key={id} type="button" variants={item} transition={{ duration: 0.35, ease: EASE }} whileTap={{ scale: 0.98 }} onClick={() => setSub(id)} aria-haspopup="true" aria-expanded={sub === id} className={head}>
          <span>{label}</span>
          <ChevronRight className="h-6 w-6 text-ui-muted/60" strokeWidth={1.8} />
        </motion.button>
      ))}

      {/* body-ra portálozva: a főmenü üvegrétegén belül a blur nem hatna (élesen átlátszana a főmenü) */}
      {typeof document !== 'undefined' && createPortal(<AnimatePresence>
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
            className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain font-onest text-ui-text"
      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)' }}
          >
            <div className="h-[76px] shrink-0" />
            <div className="px-5">
              <button type="button" onClick={() => setSub(null)} className="-ml-1 flex items-center gap-1 py-2 text-ui-row font-medium text-ui-muted active:text-ui-text">
                <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={2.2} /> Vissza
              </button>
              <p className="mt-1 text-[clamp(1.75rem,8vw,2.125rem)] font-medium leading-none tracking-[-0.035em] text-ui-text">
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
                  <ul>
                    {FEATURE_GROUPS.map((g) => {
                      const Icon = g.icon
                      return (
                        <motion.li key={g.id} variants={SUB_ITEM}>
                          <Link href={groupHref(g)} onClick={onPick} className="flex items-center gap-3.5 rounded-[12px] px-2 py-2.5 active:bg-ui-cell/60">
                            {/* ikon-csempe, mint a desktop menüben */}
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-ui-cell/60 text-ui-text"> {/* ui-allow */}
                              <Icon className="h-5 w-5" strokeWidth={1.8} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-ui-row font-medium text-ui-text">{g.label}</span>
                              <span className="block truncate text-ui-body text-ui-muted">{g.tagline}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-ui-muted/60" strokeWidth={1.8} />
                          </Link>
                        </motion.li>
                      )
                    })}
                  </ul>
                  <motion.div variants={SUB_ITEM} className="px-2 pt-4">
                    <Link href={featurePath('/funkciok')} onClick={onPick} className="flex h-12 w-full items-center justify-center rounded-full bg-ui-dark text-ui-row font-medium text-white">
                      Összes funkció egy helyen
                    </Link>
                  </motion.div>
                </>
              ) : (
                ([['Szakembereknek', Scissors, SALON_INDUSTRIES], ['Éttermeknek', UtensilsCrossed, RESTAURANT_INDUSTRIES]] as const).map(([title, Icon, items]) => (
                  <div key={title} className="mb-6">
                    <motion.p variants={SUB_ITEM} className="flex items-center gap-2 px-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-brand-ink/40">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {title}
                    </motion.p>
                    <ul className="divide-y divide-black/[0.06]">
                      {items.map((l) => (
                        <motion.li key={l.slug} variants={SUB_ITEM}>
                          <Link href={`/${l.slug}`} onClick={onPick} className="flex items-center justify-between rounded-[12px] px-2 py-3 text-[16px] font-medium text-brand-ink/85 active:bg-black/[0.03]">
                            {INDUSTRY_SHORT_LABEL[l.slug] ?? l.slug}
                            <ChevronRight className="h-4 w-4 text-brand-ink/25" strokeWidth={2} />
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
      </AnimatePresence>, document.body)}
    </>
  )
}

const SUB_ITEM = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 34 } },
}

/** A panel doboza — kisebb lekerekítés, finom árnyék; magasság-animáció nélkül (az szaggatott). */
// üveg-réteg: a háttér áttetszősége és a blur együtt úszik be (nem az opacity), így folyamatos
const GLASS: Variants = {
  hidden: { backgroundColor: 'rgba(255,255,255,0)', borderColor: 'rgba(255,255,255,0)', backdropFilter: 'blur(0px) saturate(100%)', boxShadow: '0 20px 50px -24px rgba(0,0,0,0)', transition: { duration: 0.14, ease: 'easeIn' as const } },
  show: { backgroundColor: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(40px) saturate(150%)', boxShadow: '0 20px 50px -24px rgba(0,0,0,0.28)', transition: { duration: 0.22, ease: EASE } },
}
const BODY_CONTENT: Variants = {
  hidden: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
  show: { opacity: 1, transition: { duration: 0.18, ease: EASE, delay: 0.03 } },
}
function MegaBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <motion.div aria-hidden variants={GLASS} className="absolute inset-0 rounded-ui-inner border [will-change:backdrop-filter]" />
      <motion.div variants={BODY_CONTENT} className="relative overflow-hidden rounded-ui-inner border border-transparent [transform:translateZ(0)]">{children}</motion.div>
    </div>
  )
}
