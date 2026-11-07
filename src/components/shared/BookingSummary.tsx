import { Check } from 'lucide-react'
import { Card, ListRow, MarqueeText } from '@/components/ui-kit'

/**
 * Az új / szerkesztett foglalás jobb oszlopa (a /design 6.9 / 6.18): a vendég, a kiválasztott időpont sötét
 * kártyán, a választások, az összeg (ha van), a visszaigazolás és a gombok (`actions`). Mobilon (6.12) csak a gombok, a lap alján.
 */
export function BookingSummary({ title = 'Összegzés', name, sub, day, time, until, rows, total, confirmNote, actions }: {
  /** a felső felirat (a Szolgáltatásoknál „Összefoglaló”) */
  title?: string
  name: string
  sub?: string
  day: string
  time: string
  until?: string
  rows: [string, React.ReactNode][]
  total?: string
  /** pl. „Visszaigazoló e-mail megy a vendégnek” — ha van e-mail cím */
  confirmNote?: string
  actions: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-5 lg:bg-ui-cell lg:pb-6">
      <div className="max-lg:hidden">
      <div className="text-ui-body text-ui-muted">{title}</div>
      <div className="mt-3 text-ui-sub font-light leading-tight text-ui-text">{name}</div>
      {sub && <div className="text-ui-meta text-ui-muted">{sub}</div>}
      <Card tone="dark" inner pad="sm" className="mt-4">
        <div className="text-ui-meta text-white/55">{day}</div>
        <div className="text-ui-num font-light leading-none">{time || '—'}</div>
        {until && <div className="mt-1 text-ui-meta text-white/70">{until}</div>}
      </Card>
      <div className="mt-1">
        {rows.map(([k, v]) => <ListRow key={k} className="px-0" title={<span className="text-ui-muted">{k}</span>} trailing={<MarqueeText className="max-w-[160px] text-right text-ui-body text-ui-text">{v}</MarqueeText>} />)}
      </div>
      {total && <div className="mt-3 flex items-baseline justify-between"><span className="text-ui-meta text-ui-muted">Összesen</span><span className="text-ui-sub font-light text-ui-text">{total}</span></div>}
      {confirmNote && <div className="mt-2 flex items-center gap-1.5 text-ui-label text-ui-muted"><Check className="h-3.5 w-3.5 text-ui-ok" />{confirmNote}</div>}
      </div>
      <div className="mt-auto flex flex-col gap-2 lg:pt-6">{actions}</div>
    </div>
  )
}
