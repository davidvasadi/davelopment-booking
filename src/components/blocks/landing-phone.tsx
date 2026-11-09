'use client'

import { Bell, CalendarDays, Plus, SlidersHorizontal, Users, Wallet } from 'lucide-react'
import { Avatar, IconButton, Kpi, Meta, SegmentBar, Segmented } from '@/components/ui-kit'
import { BrandLogo } from '@/components/BrandLogo'
import { FitCard } from '@/components/landing/FitCard'
import { DayShiftList } from './calendar'
import { StatNoShowCard } from './stats'
import { MobileStaffList } from './team'
import { ShareChannels } from './overview'
import { DayTimelineShot } from './landing-showcase'
import { MobileGuestList } from './guests'
import { VoucherExpiringCard, VoucherSalesCard } from './money'
import { CampaignResults } from './marketing'

/* A landing telefonos képei (iPhone-keret + a rendszer valódi mobilnézetei). Külön, kis fájl — a menü csak megnyitáskor
   tölti be (next/dynamic), a landing-koncepció és a tipp-borítók is innen veszik. */

/** iPhone-keret (átlátszó képernyővel): a képernyő helyén a rendszer valódi mobilnézete (393 px szélesre tervezve, a
 *  FitCard skálázza). A keret képe fölül ül, így a lekerekített sarkok és az állapotsor a keretből jönnek. */
export function PhoneFrameK2({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[1800/3680] ${className}`}>
      <div className="absolute bottom-[2.55%] left-[5.39%] right-[5.44%] top-[2.53%] overflow-hidden rounded-[13%/6.4%] bg-ui-page"> {/* ui-allow: a keret képernyő-kivágása */}
        <FitCard w={360}><div className="px-4 pt-[52px]">{children}</div></FitCard>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/landing/mock/iphone-keret-davelopment-booking.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  )
}

/** Az app mobil fejléce a telefonban — pontosan mint a design PhoneFrame-je (blocks/phone): balra a logó, jobbra az oldal
 *  saját eszköze (pl. szűrő), a sötét „+” (az oldal fő új-művelete), a csengő olvasatlan-pöttyel és a profil-avatar. */
export function AppTopK2({ tool }: { tool?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <BrandLogo variant="light" className="h-6 w-auto" />
      <span className="flex items-center gap-1.5">{tool}<IconButton icon={Plus} label="Új" variant="dark" size="lg" /><IconButton icon={Bell} label="Értesítések" size="lg" dot /><Avatar size="lg" src="/landing/funkciok/csapat/avatar/dave.webp" /></span>
    </div>
  )
}
/** a márkajel (app-ikon) kicsiben a telefonos képek sarkában */
export const BRAND_BADGE = <img src="/icons/icon-192.png" alt="" aria-hidden className="pointer-events-none absolute right-3 top-3 z-10 h-7 w-7 rounded-[8px] shadow-[0_6px_16px_-8px_rgba(0,0,0,.4)]" /> // eslint-disable-line @next/next/no-img-element
export const FILTER = <IconButton icon={SlidersHorizontal} label="Nézet és szűrők" size="lg" />
export const PAGE_TITLE = 'mt-5 text-ui-num font-light leading-none text-ui-text'

/** Az app mobil oldalai a landing telefonjaiba — a design mobil-nézeteinek felépítésével (5.3 Statisztikák, 6.11 Foglalások,
 *  11.7 Naptár, Csapat › Munkatársak, Áttekintés › Indulás). */
export const SCREEN = {
  statisztika: <div key="st"><AppTopK2 />
    <div className={PAGE_TITLE}>Statisztikák</div><Meta className="mt-1">Okt. 2. – Nov. 1. · Fodrászat Budapest</Meta>
    <Segmented full className="mt-3" options={['7 nap', '30 nap', 'Év', 'Egyedi']} active={1} />
    <SegmentBar size="md" className="mt-4" segments={[{ label: 'Teljesített', value: '78%', weight: 62, tone: 'dark' }, { label: 'Függő', value: '9%', weight: 18, tone: 'yellow' }, { label: 'Lemondva', value: '13%', weight: 20, tone: 'hatch' }]} />
    <div className="mt-5 flex justify-between gap-2 pr-6"><Kpi size="sm" icon={CalendarDays} value="412" label="foglalás" /><Kpi size="sm" icon={Wallet} value="4,1 M" label="bevétel (Ft)" /><Kpi size="sm" icon={Users} value="64%" label="visszatérő" /></div>
    <StatNoShowCard className="mt-4" />
  </div>,
  foglalasok: <div key="fo"><AppTopK2 />
    <div className="mt-5 flex items-center justify-between"><span className="text-ui-num font-light leading-none text-ui-text">Foglalások</span>{FILTER}</div>
    <SegmentBar size="md" className="mt-4" segments={[{ label: 'Megerősített', value: '12', weight: 50, tone: 'dark' }, { label: 'Függő', value: '2', weight: 18, tone: 'yellow' }, { label: 'Szabad', value: '5', weight: 32, tone: 'hatch' }]} />
    <div className="mt-4 [&>*]:!w-full"><DayTimelineShot /></div>
  </div>,
  naptar: <div key="na"><AppTopK2 tool={FILTER} />
    <div className={PAGE_TITLE}>Naptár</div><Meta className="mt-1">Nap · minden munkatárs</Meta>
    <DayShiftList />
  </div>,
  munkatarsak: <div key="mu"><AppTopK2 />
    <div className={PAGE_TITLE}>Munkatársak</div>
    <SegmentBar size="md" className="mt-4" segments={[{ label: 'Aktív', value: '4', weight: 66, tone: 'dark' }, { label: 'Meghívott', value: '1', weight: 17, tone: 'yellow' }, { label: 'Felf.', value: '1', weight: 17, tone: 'hatch' }]} />
    <MobileStaffList className="mt-4" />
  </div>,
  megosztas: <div key="me"><AppTopK2 />
    <div className={PAGE_TITLE}>Áttekintés</div><Meta className="mt-1">Indulás · oszd meg a foglalóoldalad</Meta>
    <ShareChannels className="mt-4" />
  </div>,
}

/** A funkció-csoportok telefonos képe (a menü „Funkciók” lenyílójába): a csoport odaillő mobilnézete, a telefon alja levágva. */
const GROUP_SCREENS: Record<string, React.ReactNode> = {
  booking: SCREEN.foglalasok,
  calendar: SCREEN.naptar,
  guests: <div><AppTopK2 /><MobileGuestList /></div>,
  money: <div><AppTopK2 /><div className={PAGE_TITLE}>Utalványok</div><Meta className="mt-1">Ajándékutalvány · eladások</Meta><div className="mt-4 space-y-2"><VoucherSalesCard /><VoucherExpiringCard /></div></div>,
  marketing: <div><AppTopK2 /><div className={PAGE_TITLE}>Marketing</div><Meta className="mt-1">Kampányok · eredmények</Meta><div className="mt-4"><CampaignResults mobile /></div></div>,
  team: SCREEN.munkatarsak,
}
export function GroupPhone({ id, className = '' }: { id: string; className?: string }) {
  return <PhoneFrameK2 className={className}>{GROUP_SCREENS[id] ?? SCREEN.foglalasok}</PhoneFrameK2>
}
