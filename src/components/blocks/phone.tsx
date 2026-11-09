import { BarChart3, Bell, CalendarDays, LayoutDashboard, MapPin, MoreHorizontal, Plus } from 'lucide-react'
import { Avatar, IconButton } from '@/components/ui-kit'
import { BrandLogo } from '@/components/BrandLogo'

/** Telefon-keret (mint a Foglalások mobil, 6.11): fejléc logóval, +, csengő és a profil-avatar (Fiók menü); alul az app pill-menüje
 *  (a menü első 4 pontja + Több), az aktív sötét. */
export function PhoneFrame({ children, nav = 0, plus = 'Új foglalás', tool, className = '' }: { children: React.ReactNode; nav?: number; plus?: string; tool?: React.ReactNode; className?: string }) {
  return (
    <div data-phone className={`flex w-[360px] shrink-0 flex-col overflow-hidden rounded-ui-container bg-ui-page px-4 pb-5 pt-4 ${className}`}>
      <div className="flex items-center justify-between">
        <BrandLogo variant="light" className="h-6" />
        <span className="flex items-center gap-1.5">
          {/* az oldal saját eszköze (pl. szűrő) a felső ikonok között */}
          {tool}
          {/* a + az oldal fő „új” művelete (alapból új foglalás; pl. a Szolgáltatásokon új szolgáltatás) */}
          <IconButton icon={Plus} label={plus} variant="dark" size="lg" />
          <IconButton icon={Bell} label="Értesítések" size="lg" dot />
          <Avatar size="lg" src="/landing/funkciok/csapat/avatar/dave.webp" />
        </span>
      </div>
      {/* fix magasságú keretben (className="h-[…]") a tartalom levágódik, mint egy görgethető képernyő — az alsó menü a helyén marad */}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <div className="mt-4 flex items-center justify-between rounded-full bg-white/80 p-1.5">
        {[LayoutDashboard, BarChart3, CalendarDays, MapPin, MoreHorizontal].map((I, i) => (
          <span key={i} className={`flex h-11 flex-1 items-center justify-center rounded-full ${i === nav ? 'bg-ui-dark text-white' : 'text-ui-muted'}`}><I className="h-5 w-5" /></span>
        ))}
      </div>
    </div>
  )
}
