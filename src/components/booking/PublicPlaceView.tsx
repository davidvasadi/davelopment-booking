'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent, type PointerEvent } from 'react'
import Image from 'next/image'
import { ArrowRight, Clock, MapPin, Phone } from 'lucide-react'
import { DAYS_OF_WEEK, dayLabels } from '@/lib/restaurantTemplates'
import { displayCloseTime } from '@/lib/utils'
import { Button } from '@/components/ui-kit'
import { ACCENT, BookingPausedCard, DefaultCover, GalleryStrip, GalleryViewer, GoodToKnow, InfoList, PageNav, RatingBadges, SocialIcons, VoucherPill, type HoursInfo, type InfoItem, type RatingItem } from '@/components/blocks/public'
import { PageLangPills } from '@/components/booking/PageLangPills'
import { iconByKey } from '@/components/settings/goodToKnowIcons'
import { ProfileCard, type ProfileCardProps, type EditorView } from '@/components/booking/ProfileCard'
import { RestaurantCard, type RestaurantCardProps } from '@/components/restaurant/RestaurantCard'
import { SalonCtaWrapper } from '@/components/booking/SalonCtaWrapper'
import { cn, nextImageSrc } from '@/lib/utils'
import { t, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToEditor, type EditorToPreview } from '@/lib/editorBridge'
import { accentForeground, type GalleryItem, type PublicPageStyle } from '@/lib/publicPageView'

/**
 * Egy üzlet külső foglalóoldala (borító, felső sáv, hős-blokk, foglaló kártya) — KÖZÖS a
 * szalonnak (`ProfileCard`) és az étteremnek (`RestaurantCard`); csak a kártya és a CTA más.
 *
 * Ugyanezt a komponenst használja az éles oldal (`/[slug]`) és a Beállítások → Foglalóoldal
 * szerkesztő előnézete (`/[slug]?editor=1` iframe-ben) — így a kettő nem tud elcsúszni.
 * Szerkesztő módban:
 *  - a szerkesztő `postMessage`-dzsel küldi a még nem mentett változásokat (`draft`), ezek
 *    a szerveroldali adatra rakódnak;
 *  - minden kattintást elkapunk: a legközelebbi `data-edit-id` elemet jelezzük vissza
 *    (`pick`), a link/gomb nem hajtódik végre (kivéve `data-edit-pass` elemeken);
 *  - a kijelölt elem körül sárga keret, az egér alatti körül halvány keret jelenik meg.
 */
type PlaceViewBase = {
  slug: string
  locale: Locale
  available: Locale[]
  embed: boolean
  name: string
  address: string | null
  city: string | null
  /** A teljes leírás — a hős-blokk 160, az étterem-kártya 220 karakternél vágja. */
  description: string | null
  coverUrl: string | null
  coverFocalX: number
  coverFocalY: number
  coverZoom: number
  /** Külön mobil (álló kivágás) fókuszpont — null = a desktop fókusz. */
  coverFocalMobileX: number | null
  coverFocalMobileY: number | null
  logoUrl: string | null
  showServiceCount: boolean
  showStaffCount: boolean
  serviceCount: number
  staffCount: number
  rating: { average: number; count: number | null; source?: string } | null
  /** a megjelenés (design 21.x): márkaszín, kártya, sötétítés, borító-elemek, gomb — `lib/publicPageView` */
  page: PublicPageStyle
  /** a galéria (legfeljebb 12 kép felirattal) — az első 3 a borítón */
  gallery: GalleryItem[]
  /** közösségi linkek (a platform a linkből) — a borítón */
  socialLinks: string[]
  /** „Jó tudni” pontok — a borítón az első 3, a többi a „+N” mögött */
  goodToKnow: { id?: string | null; icon?: string | null; title?: string | null; body?: string | null }[]
  phone: string | null
  /** az online foglalás szünetel (az üzlet előfizetése lejárt / szünetel — design 21.13): a foglaló kártya és a CTA helyén
   *  a BookingPausedCard; az oldal többi része marad */
  paused?: boolean
  /** a heti nyitvatartás — a „Jó tudni” lista alján (a régi kezdő nézetből ide került) */
  openingHours: { day_of_week: string; is_open?: boolean | null; open_time?: string | null; close_time?: string | null }[]
}
export type SalonCardData = Omit<ProfileCardProps, 'nextSlotNode' | 'salonName' | 'salonDescription' | 'salonAddress' | 'salonCity' | 'locale' | 'slug' | 'embed'>
export type RestaurantCardData = Omit<RestaurantCardProps, 'restaurantName' | 'restaurantDescription' | 'restaurantAddress' | 'restaurantCity' | 'locale' | 'slug' | 'embed'>
export type PlaceViewData = PlaceViewBase & (
  | { kind: 'salon'; card: SalonCardData }
  | { kind: 'restaurant'; card: RestaurantCardData }
)

type StaffEdit = { name?: string; bio?: string | null; role_title?: string | null; social_links?: { url: string }[] }
type Patch = Partial<PlaceViewBase> & {
  card?: Partial<SalonCardData> & Partial<RestaurantCardData>
  /** Munkatársankénti, még nem mentett módosítások (id → mezők). */
  staffEdits?: Record<string, StaffEdit>
}

export function PublicPlaceView({ data, nextSlotNode, editor = false }: { data: PlaceViewData; nextSlotNode?: ReactNode; editor?: boolean }) {
  const [patch, setPatch] = useState<Patch>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [editorView, setEditorView] = useState<EditorView | null>(null)

  useEffect(() => {
    if (!editor) return
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage<EditorToPreview>(e)) return
      if (e.data.type === 'draft') setPatch(e.data.patch as Patch)
      else if (e.data.type === 'select') setSelected(e.data.id)
      else if (e.data.type === 'view') setEditorView(e.data.view as EditorView)
    }
    window.addEventListener('message', onMessage)
    postToEditor({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [editor])

  const { staffEdits, card: cardPatch, ...topPatch } = patch
  const d = { ...data, ...topPatch, card: { ...data.card, ...(cardPatch ?? {}) } } as PlaceViewData
  if (staffEdits && d.kind === 'salon') d.card = { ...d.card, staff: d.card.staff.map((m) => ({ ...m, ...(staffEdits[String(m.id)] ?? {}) })) }
  const { slug, locale, available, embed } = d
  const hasCover = !!d.coverUrl
  const coverFocal = `${d.coverFocalX}% ${d.coverFocalY}%`
  const coverFocalMobile = `${d.coverFocalMobileX ?? d.coverFocalX}% ${d.coverFocalMobileY ?? d.coverFocalY}%`
  const place = [d.address, d.city].filter(Boolean).join(', ')

  const onClickCapture = (e: MouseEvent) => {
    if (!editor) return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-edit-id], [data-edit-pass], [data-edit-step]')
    if (el?.hasAttribute('data-edit-pass')) return
    e.preventDefault()
    e.stopPropagation()
    // Foglalás-indító gomb: nem kijelöl, hanem a szerkesztő a folyamat adott lépésére vált.
    const stepTo = el?.getAttribute('data-edit-step')
    if (stepTo) { postToEditor({ type: 'step', view: stepTo }); return }
    const id = el?.getAttribute('data-edit-id') ?? 'cover'
    setSelected(id)
    postToEditor({ type: 'pick', id })
  }
  // Csak valódi egérnél — érintésnél a „hover” keret a koppintás után ottragadna.
  const onPointerOver = (e: PointerEvent) => {
    if (!editor || e.pointerType !== 'mouse') return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-edit-id]')
    setHovered(el?.getAttribute('data-edit-id') ?? null)
  }

  // ── a design 21.1 elemei, élő adattal ──
  const pg = d.page
  const initials = d.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•'
  const counts: [string, string][] = [
    // szalon: szolgáltatás / munkatárs; étterem: asztal / férőhely (design 21.10)
    ...(d.showServiceCount && d.serviceCount > 0 ? [[String(d.serviceCount), t(locale, d.kind === 'salon' ? 'booking.step.service' : 'public.tables')] as [string, string]] : []),
    ...(d.showStaffCount && d.staffCount > 0 ? [[String(d.staffCount), t(locale, d.kind === 'salon' ? 'booking.step.staff' : 'public.seats')] as [string, string]] : []),
  ]
  const voucherOn = !d.paused && !!d.card.voucherEnabled
  const openVoucher = () => window.dispatchEvent(new CustomEvent('davelopment:openVoucher'))
  const galleryItems = d.gallery.map((g) => ({ src: g.url, t: g.caption }))
  // „Jó tudni”: az üzlet pontjai; a telefonszám (az Elérhetőségből) a harmadik helyre kerül, hívható
  const gtk = (d.goodToKnow ?? []).filter((x) => x?.title?.trim())
  const info: InfoItem[] = gtk.map((x) => ({ icon: iconByKey(x.icon), t: x.title!.trim(), d: x.body?.trim() || x.title!.trim() }))
  if (d.phone) info.splice(Math.min(2, info.length), 0, { icon: Phone, t: d.phone, d: d.phone, href: `tel:${d.phone.replace(/\s+/g, '')}` })
  // nyitvatartás: a pillek között egy „Nyitvatartás” (a listát nyitja), a lista alján a heti rend a most-állapottal
  const hasHours = (d.openingHours ?? []).some((h) => h.is_open)
  const pills: InfoItem[] = hasHours ? [...info, { icon: Clock, t: t(locale, 'openingHours.title'), d: t(locale, 'openingHours.title') }] : info
  const hours = useHoursInfo(d.openingHours ?? [], locale)
  const ratingItems: RatingItem[] = d.rating ? [{ score: d.rating.average, source: d.rating.source ? 'Google' : 'davelopment', count: d.rating.count }] : []
  const googleUrl = d.kind === 'salon' ? d.card.google?.mapsUrl ?? null : d.card.google?.mapsUrl ?? null
  const ctaLabel = pg.ctaLabel ?? t(locale, d.kind === 'salon' ? 'public.bookCta' : 'public.bookTable')
  const [infoOpen, setInfoOpen] = useState(false)
  const [galleryAt, setGalleryAt] = useState<number | null>(null)
  // a borító sötétítése (Beállítások › Foglalóoldal › Borítókép): nincs / enyhe (alap) / erős — a szöveg mindig olvasható
  const dimTop = pg.dim === 'none' ? 'from-ui-dark/45' : 'from-ui-dark/70'
  const dimBottom = pg.dim === 'none' ? 'h-2/5 from-ui-dark/75' : 'h-3/5 from-ui-dark/90'

  return (
    <div
      data-edit-id={editor ? 'cover' : undefined}
      onClickCapture={editor ? onClickCapture : undefined}
      onPointerOver={editor ? onPointerOver : undefined}
      onMouseLeave={editor ? () => setHovered(null) : undefined}
      className={`font-onest relative overflow-hidden ${embed ? 'min-h-[640px]' : 'min-h-[100dvh] bg-ui-dark'}`}
      style={{
        ...(embed ? { background: 'transparent' } : {}),
        // az üzlet márkaszíne: minden kiemelés (fő gomb, kiválasztott sor, időpont) — `ui-accent`
        ...(pg.accent || pg.buttonText !== 'auto' ? { ['--biz-accent' as string]: pg.accent ?? '#FFD85F', ['--biz-accent-fg' as string]: accentForeground(pg.accent, pg.buttonText) } : {}),
      }}
    >
      {/* A globals.css `html` elemnek van egy kemény krém háttérszíne — embed módban ez
          átütne az átlátszó oldal mögött, ezt írjuk itt felül. */}
      {embed && <style>{'html, body { background: transparent !important; }'}</style>}

      {/* Borító — a kép (fókuszponttal, desktop / mobil), vagy az alap arculat: semleges mély sötét, halvány fénnyel (21.5) */}
      {!embed && (hasCover ? (
        <Image
          src={nextImageSrc(d.coverUrl!)}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          // Mobilon (lg alatt) a mobil fókuszpont, desktopon a desktop — CSS-változóval, hogy a
          // szerver által renderelt kép is rögtön a jó kivágással jelenjen meg.
          className="z-0 object-cover [object-position:var(--cover-focal-m)] [transform-origin:var(--cover-focal-m)] lg:[object-position:var(--cover-focal-d)] lg:[transform-origin:var(--cover-focal-d)]"
          style={{ ['--cover-focal-d' as string]: coverFocal, ['--cover-focal-m' as string]: coverFocalMobile, transform: `scale(${d.coverZoom})` }}
        />
      ) : <DefaultCover />)}
      {!embed && (
        <>
          <div className={`pointer-events-none absolute inset-x-0 top-0 z-[1] h-1/4 bg-gradient-to-b ${dimTop} to-transparent`} />
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t ${dimBottom} to-transparent`} />
          {pg.dim === 'strong' && <div className="pointer-events-none absolute inset-0 z-[1] bg-ui-dark/35" />}
        </>
      )}

      {!embed && (
        <>
          {/* Felső sáv: logó (vagy monogram), számlálók, ajándékutalvány, nyelvek — mobilon számlálók nélkül */}
          <nav className="relative z-50 lg:hidden">
            <PageNav mobile logo={d.logoUrl} logoAlt={d.name} letters={initials} counts={counts}
              voucher={voucherOn ? <VoucherPill mobile label={t(locale, 'public.voucher')} onClick={openVoucher} /> : null}
              langs={<PageLangPills mobile current={locale} available={available} />} editIds={{ logo: 'logo', counts: 'counts', langs: 'langs' }} />
          </nav>
          <nav className="relative z-50 hidden lg:block">
            <PageNav logo={d.logoUrl} logoAlt={d.name} letters={initials} counts={counts}
              voucher={voucherOn ? <VoucherPill label={t(locale, 'public.voucher')} onClick={openVoucher} /> : null}
              langs={<PageLangPills current={locale} available={available} />} editIds={{ logo: 'logo', counts: 'counts', langs: 'langs' }} />
          </nav>

          {/* Az üzlet — EGY H1 (mobil és desktop közös): galéria-képsor, név, cím, értékelés + közösségi, leírás, jó tudni,
              desktopon a fő gomb és a legközelebbi szabad időpont (mobilon a gomb a foglaló kártyáé, alul tapad) */}
          <div className="absolute inset-x-5 bottom-[calc(max(2.5rem,env(safe-area-inset-bottom))+5rem)] z-20 text-white lg:inset-x-auto lg:bottom-10 lg:left-8 lg:max-w-[46%]">
            {galleryItems.length > 0 && <div data-edit-id="gallery" className="mb-4 w-fit"><GalleryStrip items={galleryItems} onOpen={(i) => setGalleryAt(Math.min(i, galleryItems.length - 1))} /></div>}
            <h1 data-edit-id="name" className="line-clamp-2 break-words text-ui-num font-light leading-none lg:text-ui-page">{d.name}</h1>
            {place && <p data-edit-id="address" className="mt-2 flex items-center gap-1.5 text-ui-meta text-white/65"><MapPin className="h-3.5 w-3.5 shrink-0" />{place}</p>}
            {((pg.showRating && ratingItems.length > 0) || (pg.showSocial && d.socialLinks.length > 0)) && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {pg.showRating && ratingItems.length > 0 && <span data-edit-id="rating"><RatingBadges dark items={ratingItems} onOpen={pg.ratingOpens && googleUrl ? () => window.open(googleUrl, '_blank', 'noopener') : undefined} /></span>}
                {pg.showRating && ratingItems.length > 0 && pg.showSocial && d.socialLinks.length > 0 && <span className="h-4 w-px bg-white/20" />}
                {pg.showSocial && d.socialLinks.length > 0 && <span data-edit-id="social"><SocialIcons links={d.socialLinks} /></span>}
              </div>
            )}
            {(d.description || info.length > 0) && (
              <div className="mt-3">
                {d.description && <p data-edit-id="desc" className="mb-3 line-clamp-2 max-w-[460px] text-ui-body text-white/70 lg:line-clamp-none">{d.kind === 'restaurant' ? d.description.slice(0, 220) : d.description}</p>}
                {info.length > 0 && (
                  <div data-edit-id="gtk" className="relative">
                    <GoodToKnow items={pills} onMore={() => setInfoOpen(true)} />
                    {infoOpen && <InfoList items={info} hours={hours} title={t(locale, 'goodToKnow.title')} onClose={() => setInfoOpen(false)} className="absolute bottom-full left-0 z-30 mb-2 hidden w-[400px] shadow-ui-popup lg:block" />}
                  </div>
                )}
              </div>
            )}
            {!d.paused && <div data-edit-id="cta" className="mt-5 hidden w-fit flex-wrap items-center gap-2 lg:flex">
              {d.kind === 'salon' ? (
                <SalonCtaWrapper>
                  <span data-edit-step="datetime" className="contents">
                    <Button size="lg" href={`/${slug}/book`} className={cn('px-6', ACCENT)}>{ctaLabel}<ArrowRight className="h-4 w-4" /></Button>
                  </span>
                </SalonCtaWrapper>
              ) : (
                <span data-edit-step="datetime" className="contents">
                  <Button size="lg" href={`/${slug}?book=1`} className={cn('px-6', ACCENT)}>{ctaLabel}<ArrowRight className="h-4 w-4" /></Button>
                </span>
              )}
              {pg.ctaNextFree && nextSlotNode && (d.kind === 'salon' ? <SalonCtaWrapper>{nextSlotNode}</SalonCtaWrapper> : nextSlotNode)}
            </div>}
          </div>

          {/* „Jó tudni” mobilon: felcsúszó lap */}
          {infoOpen && (
            <div className="fixed inset-0 z-[120] lg:hidden" onClick={() => setInfoOpen(false)}>
              <div className="absolute inset-0 bg-ui-dark/40" />
              <div className="absolute inset-x-0 bottom-0" onClick={(e) => e.stopPropagation()}><InfoList items={info} hours={hours} title={t(locale, 'goodToKnow.title')} onClose={() => setInfoOpen(false)} className="rounded-b-none pb-[max(1.25rem,env(safe-area-inset-bottom))]" /></div>
            </div>
          )}
          {galleryAt !== null && <GalleryViewer fixed mobile={false} items={galleryItems} active={galleryAt} onPick={setGalleryAt} onClose={() => setGalleryAt(null)} />}
        </>
      )}

      {/* Interaktív foglaló kártya — szalonnál a ProfileCard, étteremnél a RestaurantCard */}
      {d.paused ? (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-8 lg:top-1/2 lg:w-[420px] lg:-translate-y-1/2 lg:p-0">
          <BookingPausedCard restaurant={d.kind === 'restaurant'} phone={d.phone} l={{ title: t(locale, d.kind === 'restaurant' ? 'public.paused.titleRestaurant' : 'public.paused.title'), text: t(locale, d.kind === 'restaurant' ? 'public.paused.textRestaurant' : 'public.paused.text') }} />
        </div>
      ) : d.kind === 'salon' ? (
        <ProfileCard
          {...d.card}
          slug={slug}
          locale={locale}
          embed={embed}
          salonName={d.name}
          salonDescription={d.description?.slice(0, 160) ?? null}
          salonAddress={d.address}
          salonCity={d.city}
          nextSlotNode={nextSlotNode}
          editorView={editor ? editorView : null}
          cardStyle={pg.card}
          ctaLabel={ctaLabel}
          servicesDisplay={{ filter: pg.servicesFilter, images: pg.servicesImages, price: pg.servicesPrice }}
        />
      ) : (
        <RestaurantCard
          {...d.card}
          slug={slug}
          locale={locale}
          embed={embed}
          restaurantName={d.name}
          restaurantDescription={d.description}
          restaurantAddress={d.address}
          restaurantCity={d.city}
          editorView={editor ? editorView : null}
          cardStyle={pg.card}
          ctaLabel={ctaLabel}
        />
      )}

      {editor && <SelectionRing id={hovered && hovered !== selected ? hovered : null} soft />}
      {editor && <SelectionRing id={selected} />}
    </div>
  )
}

/** Keret a `data-edit-id` elem körül — fix pozíciójú réteg, így semmi nem vágja le
 *  (overflow, telefonkeret). Animációk és görgetés miatt képkockánként követi az elemet. */
function SelectionRing({ id, soft = false }: { id: string | null; soft?: boolean }) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const raf = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (!id) { setRect(null); return }
    const tick = () => {
      // Egy azonosító mobil- és desktop-változatban is szerepelhet — a látható példányt keressük.
      const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-edit-id="${CSS.escape(id)}"]`))
      const el = els.find((x) => x.offsetParent !== null || x.getClientRects().length > 0)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect((prev) => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height)
          ? prev : { top: r.top, left: r.left, width: r.width, height: r.height })
      } else setRect(null)
      raf.current = requestAnimationFrame(tick)
    }
    tick()
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [id])

  if (!id || !rect) return null
  const isCover = id === 'cover'
  const pad = isCover ? -3 : 4
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[200] rounded-[10px]"
      style={{
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        border: soft ? '1.5px dashed rgba(241,206,69,.7)' : '2px solid #F1CE45',
        boxShadow: soft ? undefined : '0 0 0 4px rgba(241,206,69,.18)',
      }}
    />
  )
}

/** A „Jó tudni” nyitvatartása: a heti rend hétfőtől, a mai kiemelve, felül a most-állapot (percenként frissül). A „most”
 *  csak a böngészőben számolódik (a szerver-render más időzónában lehet). Nincs megadva: null. */
const JS_DAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const toMin = (x?: string | null) => { if (!x) return null; const [h, m] = x.split(':').map(Number); return Number.isNaN(h) ? null : h * 60 + (m || 0) }
function useHoursInfo(rows: PlaceViewBase['openingHours'], locale: Locale): HoursInfo | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()); const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id) }, [])
  if (!rows.some((h) => h.is_open)) return null
  const byDay = new Map(rows.map((h) => [h.day_of_week, h]))
  const lbl = dayLabels(locale)
  const todayKey = now ? JS_DAY[now.getDay()] : null
  const range = (h?: { open_time?: string | null; close_time?: string | null }) => `${h?.open_time ?? ''} – ${h?.close_time ? displayCloseTime(h.close_time) : ''}`
  let status = t(locale, 'openingHours.title'), open = false
  const today = todayKey ? byDay.get(todayKey) : undefined
  if (now) {
    const cur = now.getHours() * 60 + now.getMinutes()
    const o = toMin(today?.open_time); let c = toMin(today?.close_time)
    if (today?.is_open && o != null && c != null) {
      if (c <= o) c += 24 * 60 // „00:00” záróra = éjfélig
      open = cur >= o && cur < c
      status = open ? t(locale, 'openingHours.closeAt', { time: displayCloseTime(today.close_time!) }) : cur < o ? t(locale, 'openingHours.openAt', { time: today.open_time! }) : t(locale, 'openingHours.nowClosed')
    } else status = t(locale, 'openingHours.nowClosed')
  }
  return {
    status, open, todayLabel: t(locale, 'openingHours.today'),
    rows: DAYS_OF_WEEK.map((k) => { const h = byDay.get(k); return { day: lbl[k], time: h?.is_open ? range(h) : t(locale, 'openingHours.closed'), closed: !h?.is_open, today: k === todayKey } }),
  }
}
