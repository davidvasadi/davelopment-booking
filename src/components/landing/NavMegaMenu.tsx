'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, Scissors, UtensilsCrossed } from 'lucide-react'
import { SERVICES } from '@/lib/davelopmentServices'
import { EASE } from '@/lib/motion'
import { FEATURE_GROUPS, groupHref, type FeatureGroupId } from '@/lib/landingFeatures'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'

/**
 * Landing nav — „Funkciók” és „Kinek” lenyíló (desktop). Funkciók: balra a 6 csoport (fehér csúszó
 * kapszula), középen a kijelölt csoport funkciói, jobbra a világos csoport-borító; rámutatásra a
 * csoport vált. Egy sötét szín van: a nav aktív pilljéé (brand-ink), sárga nincs.
 * Kinek: Szakembereknek / Éttermeknek + az iparági aloldalak.
 */
export type MegaId = 'features' | 'audience' | 'studio'

// a „Csapatkezelés” téma-oldal, nem iparág — a Kinek menüből kimarad
const SALON_INDUSTRIES = Object.values(INDUSTRY_LANDINGS).filter((l) => l.segment === 'salon' && l.slug !== 'csapatkezeles-vallalkozasoknak')
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
  const width = mega.open === 'features' || mega.open === 'studio' ? 780 : 440
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

/** A lenyílók közös sora (Funkciók, davelopment — 2026-11-14, Dave referenciája alapján, a mi színeinkkel): sorszám,
 *  név, egy mondat; rámutatva / aktívan szürke háttér és jobbra sötét kerek nyíl. */
function MegaRow({ n, label, desc, href, external = false, active = false, onPick, onHover }: {
  n: number; label: string; desc: string; href: string; external?: boolean; active?: boolean; onPick: () => void; onHover?: () => void
}) {
  const cls = `group/row my-0.5 flex items-center gap-4 rounded-[12px] px-3.5 py-3 transition-colors duration-150 hover:bg-ui-cell ${active ? 'bg-ui-cell' : ''}`
  const body = (
    <>
      <span className="w-6 shrink-0 font-mono text-ui-meta text-ui-muted">{String(n).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-ui-row font-medium text-ui-text">{label}</span>
        <span className="mt-0.5 block text-ui-meta leading-snug text-ui-muted">{desc}</span>
      </span>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-dark text-white transition-opacity duration-150 group-hover/row:opacity-100 ${active ? 'opacity-100' : 'opacity-0'}`}> {/* ui-allow: a sor nyila */}
        <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
      </span>
    </>
  )
  return external
    ? <a href={href} target="_blank" rel="noopener" onClick={onPick} onMouseEnter={onHover} onFocus={onHover} className={cls}>{body}</a>
    : <Link href={href} onClick={onPick} onMouseEnter={onHover} onFocus={onHover} className={cls}>{body}</Link>
}

/** A lenyílók alsó sora a kép alatt: szöveges link + sötét kapszula-gomb sárga nyíllal — egy sorban, nem törhet. */
function MegaFoot({ link, button, external = false, onPick }: { link: [string, string]; button: [string, string]; external?: boolean; onPick: () => void }) {
  const ext = external ? { target: '_blank', rel: 'noopener' } : {}
  return (
    <div className="flex items-center justify-between gap-3 whitespace-nowrap px-1.5 pb-0.5 pt-1">
      <a href={link[0]} {...ext} onClick={onPick} className="text-ui-body font-medium text-ui-text underline-offset-4 hover:underline">{link[1]}</a>
      <a href={button[0]} {...ext} onClick={onPick} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ui-dark py-1.5 pl-4 pr-1.5 text-ui-body font-medium text-white transition-opacity hover:opacity-90">
        {button[1]}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-yellow text-ui-dark"><ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
      </a>
    </div>
  )
}

/** Funkciók: balra a hat csoport számozott sorokban, jobbra a rámutatott csoport kezes-telefonos fotója (a
 *  funkció-oldalak saját képei, átlátszó hátterűek — világos sárgás mezőn; mind a hat egyszer betöltve, csak áttűnnek),
 *  alatta „Összes funkció” és „Kipróbálom ingyen”. */
const HAND_IMG: Record<string, string> = { booking: 'foglalasok', calendar: 'naptar', guests: 'vendegek', money: 'penz', marketing: 'marketing', team: 'csapat' }
function FeaturesPanel({ onPick }: { onPick: () => void }) {
  const [groupId, setGroupId] = useState<FeatureGroupId>('booking')
  const group = FEATURE_GROUPS.find((g) => g.id === groupId) ?? FEATURE_GROUPS[0]
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-1.5 p-1.5">
      <ul className="flex flex-col py-0.5">
        {FEATURE_GROUPS.map((g, i) => (
          <li key={g.id} className={i < FEATURE_GROUPS.length - 1 ? 'border-b border-ui-divider' : ''}>
            <MegaRow n={i + 1} label={g.label} desc={g.tagline} href={groupHref(g)} active={g.id === groupId} onPick={onPick} onHover={() => setGroupId(g.id)} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5">
        <Link href={groupHref(group)} onClick={onPick} aria-label={`${group.label} — funkciók`} className="relative block min-h-[300px] flex-1 overflow-hidden rounded-[12px] bg-ui-yellow/15">
          {FEATURE_GROUPS.map((g) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={g.id} src={`/landing/hero/${HAND_IMG[g.id] ?? 'foglalasok'}-feature-davelopment-booking.webp`} alt="" width={2840} height={1894} loading="lazy" decoding="async"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out [will-change:opacity] ${g.id === group.id ? 'opacity-100' : 'opacity-0'}`} />
          ))}
        </Link>
        <MegaFoot link={['/funkciok', 'Összes funkció']} button={['/register', 'Kipróbálom ingyen']} onPick={onPick} />
      </div>
    </div>
  )
}

/** davelopment — az anyacég szolgáltatásai: balra számozott sorok (a közös MegaRow), jobbra a davelopment
 *  „Weboldal készítés” borítója (középen a logóval), alatta „Összes szolgáltatás” és „Kérj ajánlatot”. Minden link a davelopment.hu-ra,
 *  forrás-jelöléssel. */
const NAV_UTM = 'utm_source=booking&utm_medium=nav'
const navUtm = (href: string) => `${href}${href.includes('?') ? '&' : '?'}${NAV_UTM}`
function StudioPanel({ onPick }: { onPick: () => void }) {
  const services = SERVICES.filter((sv) => sv.label !== 'Időpontfoglaló rendszer')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-1.5 p-1.5">
      <ul className="flex flex-col py-0.5">
        {services.map((sv, i) => (
          <li key={sv.label} className={i < services.length - 1 ? 'border-b border-ui-divider' : ''}>
            <MegaRow n={i + 1} label={sv.label} desc={sv.desc} href={navUtm(sv.href)} external onPick={onPick} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1.5">
        <a href={navUtm('https://davelopment.hu')} target="_blank" rel="noopener" onClick={onPick} aria-label="davelopment.hu — webes ügynökség"
          className="group/studio relative block min-h-[300px] flex-1 overflow-hidden rounded-[12px] bg-ui-dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/hero/davelopment-weboldal-keszites-davelopment-booking.webp" alt="Weboldal készítés — davelopment" width={640} height={800} loading="lazy" decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/studio:scale-[1.04]" />
          {/* középen a davelopment logó (enyhe sötétítés a kép fölött, hogy a világos logó jól olvasható legyen) */}
          <span aria-hidden className="absolute inset-0 bg-black/25" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_davelopment_light.svg" alt="" width={2034} height={526} className="absolute left-1/2 top-1/2 h-9 w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_12px_rgba(0,0,0,.35)]" />
        </a>
        <MegaFoot link={[navUtm('https://davelopment.hu/hu/szolgaltatasok'), 'Összes szolgáltatás']} button={[navUtm('https://davelopment.hu/hu/kapcsolat'), 'Kérj ajánlatot']} external onPick={onPick} />
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
                    <Link href={'/funkciok'} onClick={onPick} className="flex h-12 w-full items-center justify-center rounded-full bg-ui-dark text-ui-row font-medium text-white">
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
