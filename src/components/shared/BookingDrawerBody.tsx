import { Pencil, X, type LucideIcon } from 'lucide-react'
import { GUEST_TIER_LABEL, GuestTierPill, guestTierOf } from '@/components/blocks/guest-tier'
import { Button, IconButton, MarqueeText, Meta, Pill, StatusPill, type Status } from '@/components/ui-kit'

export type DrawerAction = { label: string; icon?: LucideIcon; variant?: 'dark' | 'glass' | 'cell' | 'danger'; onClick?: () => void; href?: string; disabled?: boolean }
export type GuestProfile = { visits: number; since: string; country: string | null; history: { d: string; w: string }[] }

/** A megnyitott foglalás tartalma (design 6.7 desktop / 6.12 mobil) — a lap (BookingDrawer) és a design oldal is ezt mutatja. */
export function BookingDrawerBody({ desktop, onClose, onEdit, edit = !!onEdit, when, title, pills, alert, actions, profile, city, children }: {
  desktop: boolean
  onClose?: () => void
  onEdit?: () => void
  /** a ceruza látszik-e (alapból: ha van onEdit) */
  edit?: boolean
  when: string
  title: string
  pills?: React.ReactNode
  alert?: { tone: Extract<Status, 'bad' | 'warn' | 'pending'>; text: string } | null
  actions?: DrawerAction[]
  profile?: GuestProfile | null
  city?: string | null
  children?: React.ReactNode
}) {
  const buttons = actions && actions.length > 0 && (
    <div className={`${desktop ? 'mt-2.5' : 'mt-3'} grid grid-cols-2 gap-1.5`}>
      {actions.map((a) => <Button key={a.label} variant={a.variant ?? (desktop && alert ? 'glass' : 'cell')} icon={a.icon} onClick={a.onClick} href={a.href} disabled={a.disabled}>{a.label}</Button>)}
    </div>
  )
  const ALERT_BG = { bad: 'bg-ui-bad-bg text-ui-bad', warn: 'bg-ui-warn-bg text-ui-warn', pending: 'bg-ui-yellow/40 text-ui-dark' } as const
  const DOT = { bad: 'bg-ui-bad-dot', warn: 'bg-ui-warn-dot', pending: 'bg-ui-dark' } as const

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {/* mobilon (6.12) balra a teendő, jobbra az időpont */}
        {desktop ? <Meta>Foglalás</Meta> : alert ? <StatusPill status={alert.tone}>{alert.text}</StatusPill> : <span />}
        <span className="flex items-center gap-1.5">
          {desktop && <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} />}
        </span>
      </div>
      {/* a vendég neve és az időpont: telefonon egy sorban (19px), szélesebb képernyőn egymás alatt — a név nagyban, alatta az
          időpont kisebben (egy sorban a hosszú név elúszott, és az időpont levágta) */}
      <div className="mt-3 flex items-baseline gap-3 text-ui-title font-light leading-tight text-ui-text sm:flex-col sm:gap-1">
        <MarqueeText className="flex-1 sm:w-full sm:text-ui-sub">{title}</MarqueeText>
        {when && <span className="shrink-0 whitespace-nowrap sm:text-ui-muted">{when}</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {/* design 6.7: hányadik alkalommal jön, honnan */}
        {/* a vendég szintje — ugyanaz a pill, mint a Vendégeknél: Új sárga, Visszatérő sötét, Törzsvendég (4+) sötét + csillag */}
        {profile && <GuestTierPill tier={guestTierOf(profile.visits)}>{profile.visits >= 2 ? `${GUEST_TIER_LABEL[guestTierOf(profile.visits)]} · ${profile.visits}. alkalom` : 'Új vendég'}</GuestTierPill>}
        {(city || profile?.country) && <Pill tone="cell" size="sm">{profile?.country ? `${flag(profile.country)} ` : ''}{city ?? ''}</Pill>}
        {pills}
      </div>
      {alert && desktop ? (
        <div className={`mt-4 rounded-ui-inner p-3.5 ${ALERT_BG[alert.tone]}`}>
          <div className="flex items-center gap-2 text-ui-body font-medium"><span className={`h-2 w-2 animate-pulse rounded-full ${DOT[alert.tone]}`} />{alert.text}</div>
          {buttons}
        </div>
      ) : buttons}
      <div className={desktop ? 'mt-4' : 'mt-3'}>{children}</div>
      {profile && profile.history.length > 0 && (
        <>
          <div className="mt-3 flex items-baseline justify-between"><span className="text-ui-meta text-ui-muted">Előzmények</span>{profile.since && <span className="text-ui-label text-ui-muted">{profile.since}</span>}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {profile.history.slice(0, 8).map((h, i) => {
              const bad = /nem jött|no.?show/i.test(h.w)
              const warn = /lemond|késett/i.test(h.w)
              return <span key={i} title={h.w}><StatusPill status={bad ? 'bad' : warn ? 'warn' : 'neutral'}>{h.d}{bad ? ' · nem jött' : warn ? (/késett/i.test(h.w) ? ' · késett' : ' · lemondva') : ''}</StatusPill></span>
            })}
          </div>
        </>
      )}
      {/* a foglalás szerkesztése: fő gomb a lap alján, teljes szélességben */}
      {edit && <Button icon={Pencil} className="mt-5 w-full" onClick={onEdit}>Szerkesztés</Button>}
    </>
  )
}

/** ISO-2 országkód → zászló. */
const flag = (iso: string) => (/^[A-Za-z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : '')
