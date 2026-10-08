'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent, type PointerEvent } from 'react'
import Image from 'next/image'
import { MapPin, Tag, Users } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { BrandLogo } from '@/components/BrandLogo'
import { ProfileCard, type ProfileCardProps, type EditorView } from '@/components/booking/ProfileCard'
import { RestaurantCard, type RestaurantCardProps } from '@/components/restaurant/RestaurantCard'
import { SalonCtaWrapper } from '@/components/booking/SalonCtaWrapper'
import { nextImageSrc } from '@/lib/utils'
import { t, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToEditor, type EditorToPreview } from '@/lib/editorBridge'

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
  const heroText = hasCover ? 'text-white' : 'text-[#1D1C19]'
  const heroSub = hasCover ? 'text-white/60' : 'text-[#86826F]'
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

  const counts = (d.showServiceCount || d.showStaffCount) && (
    <>
      {d.showServiceCount && <div className="flex items-center gap-1.5 lg:gap-2">
        <Tag className={`h-3.5 w-3.5 lg:h-[15px] lg:w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
        <span className={`text-sm font-semibold lg:text-base ${hasCover ? 'text-white' : 'text-ink'}`}>{d.serviceCount}</span>
        <span className={`text-[11px] lg:text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.service')}</span>
      </div>}
      {d.showServiceCount && d.showStaffCount && <div className={`h-4 w-px ${hasCover ? 'bg-white/15' : 'bg-ink/12'}`} />}
      {d.showStaffCount && <div className="flex items-center gap-1.5 lg:gap-2">
        <Users className={`h-3.5 w-3.5 lg:h-[15px] lg:w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
        <span className={`text-sm font-semibold lg:text-base ${hasCover ? 'text-white' : 'text-ink'}`}>{d.staffCount}</span>
        <span className={`text-[11px] lg:text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.staff')}</span>
      </div>}
    </>
  )
  const rating = (className?: string) => d.rating && (
    <RatingStars rating={d.rating.average} count={d.rating.count} source={d.rating.source} className={className} dark={hasCover} />
  )

  return (
    <div
      data-edit-id={editor ? 'cover' : undefined}
      onClickCapture={editor ? onClickCapture : undefined}
      onPointerOver={editor ? onPointerOver : undefined}
      onMouseLeave={editor ? () => setHovered(null) : undefined}
      className={`font-onest relative overflow-hidden ${embed ? 'min-h-[640px]' : 'min-h-[100dvh]'}`}
      style={embed ? { background: 'transparent' } : hasCover ? { background: '#111' } : {
        background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)',
      }}
    >
      {/* A globals.css `html` elemnek van egy kemény krém háttérszíne — embed módban ez
          átütne az átlátszó oldal mögött, ezt írjuk itt felül. */}
      {embed && <style>{'html, body { background: transparent !important; }'}</style>}

      {/* Cover image + overlay — embed módban nem jelenik meg (kevesebb navigáció/fejléc). */}
      {!embed && hasCover && (
        <>
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
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.35) 100%)' }}
          />
          {/* Dedikált felső árnyék — a navbar (logó, jelvények, nyelvváltó) mindig olvasható
              maradjon, függetlenül attól, hogy a borítókép teteje éppen világos-e */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 z-[2]"
            style={{ height: '22%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
          />
          {/* Erős alul-gradient — fehér/világos borítóképnél is olvasható marad a cím és a
              Google-értékelés (magasabb + sötétebb, hogy a csillagok/szám is mindig kiolvasható) */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2]"
            style={{ height: '70%', background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%)' }}
          />
        </>
      )}

      {!embed && (
        <>
          {/* Navbar — mobilon KÉT sor (logó+nyelvváltó felül, szolgáltatás/munkatárs-számláló
              alatta középre), mert az abszolút-középre-pozicionált számláló szűk kijelzőn
              rááfedett a logóra. Desktopon (lg+) marad az eredeti, egysoros elrendezés. */}
          <nav className="relative z-50 flex flex-col gap-3 px-5 py-5 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-6" />
                {d.logoUrl && <div className={`h-7 w-px ${hasCover ? 'bg-white/20' : 'bg-black/15'}`} />}
                {d.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img data-edit-id="logo" src={d.logoUrl} alt={d.name} className="h-9 w-auto max-w-[140px] rounded-[6px] object-contain" />
                )}
              </div>
              {available.length > 1 && <div data-edit-id="langs"><LangSwitcher current={locale} available={available} variant={hasCover ? 'dark' : 'light'} /></div>}
            </div>
            {counts && <div data-edit-id="counts" className="flex items-center justify-center gap-3">{counts}</div>}
          </nav>

          {/* Desktop navbar — eredeti egysoros elrendezés, abszolút-középre pozicionált számlálóval. */}
          <nav className="relative z-50 hidden items-center justify-between px-8 py-6 lg:flex">
            <div className="flex items-center gap-3">
              <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-7" />
              {d.logoUrl && <div className={`h-8 w-px ${hasCover ? 'bg-white/20' : 'bg-black/15'}`} />}
              {d.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img data-edit-id="logo" src={d.logoUrl} alt={d.name} className="h-10 w-auto max-w-[150px] rounded-[6px] object-contain" />
              )}
            </div>
            {counts && (
              <div data-edit-id="counts" className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-5">{counts}</div>
            )}
            {available.length > 1 && <div data-edit-id="langs"><LangSwitcher current={locale} available={available} variant={hasCover ? 'dark' : 'light'} /></div>}
          </nav>

          {/* Szalon neve + cím — mobil hero (kártya megnyitása előtt) */}
          <div className="absolute bottom-[calc(max(2.5rem,env(safe-area-inset-bottom))+5rem)] left-0 right-0 z-10 px-6 lg:hidden">
            <h1 data-edit-id="name" className={`line-clamp-2 break-words text-[2.75rem] font-light leading-tight tracking-[-0.02em] ${heroText}`}>
              {d.name}
            </h1>
            {place && (
              <p data-edit-id="address" className={`mt-1 flex items-center gap-1.5 text-sm ${heroSub}`}>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {place}
              </p>
            )}
            {d.rating && <div className="mt-2">{rating()}</div>}
            {d.description && (
              <p data-edit-id="desc" className={`mt-2 line-clamp-2 text-[13px] leading-relaxed ${heroSub}`}>{d.description.slice(0, 160)}</p>
            )}
          </div>

          {/* Szalon neve + CTA — desktop, bal alul */}
          <div className="absolute bottom-10 left-8 z-20 hidden max-w-[50%] lg:block">
            <h1 data-edit-id="name" className={`line-clamp-2 break-words text-[3rem] font-light leading-tight tracking-[-0.02em] mb-2 ${heroText}`}>
              {d.name}
            </h1>
            {place && (
              <p data-edit-id="address" className={`flex items-center gap-1.5 text-sm mb-4 ${heroSub}`}>
                <MapPin className="h-3.5 w-3.5" />
                {place}
              </p>
            )}
            {rating('mb-5')}
            {d.kind === 'salon' ? (
              <div className="flex flex-wrap items-center gap-3">
                <SalonCtaWrapper>
                  <span data-edit-step="datetime" className="contents">
                    <BookCtaMorph href={`/${slug}/book`} label={t(locale, 'public.bookCta')} />
                  </span>
                </SalonCtaWrapper>
                {nextSlotNode && (
                  <SalonCtaWrapper>
                    {nextSlotNode}
                  </SalonCtaWrapper>
                )}
              </div>
            ) : (
              <span data-edit-step="datetime" className="contents">
                <BookCtaMorph href={`/${slug}?book=1`} label={t(locale, 'public.bookTable')} />
              </span>
            )}
          </div>
        </>
      )}

      {/* Interaktív foglaló kártya — szalonnál a ProfileCard, étteremnél a RestaurantCard */}
      {d.kind === 'salon' ? (
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
