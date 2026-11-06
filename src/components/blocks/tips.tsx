import { ArrowRight, Bell, Check, FileText, Gift, Image as ImageIcon, Star, Users, Zap, type LucideIcon } from 'lucide-react'
import { Button, Card, CardTitle, IconCircle, Meta, Pill } from '@/components/ui-kit'
import { Ring } from './charts'

/* A Tippek kártyái — a /design 14.x mutatja őket. Az élő TipsView (lib/tipsAdvisor) is ezeket rendereli:
 * „E heti tipp” sötét kártya, az oldal egészség-pontszáma a teendő-listával, alatta a javaslat-kártyák kategóriával. */

export type WeeklyTipVM = { title: string; body: string; metric?: string; actionLabel: string }

/** E heti tipp: sötét kártya, a tipp a saját adataidból, lapozható (1/3), azonnali művelettel. Élőben `tip` (null: nincs
 *  több tipp — a kártya a lenti javaslatokra terel), `onAction` / `onNext`. */
export function WeeklyTipCard({ restaurant = false, tip, index = 0, total = 3, onAction, onNext, busy = false, className = '' }: {
  restaurant?: boolean; tip?: WeeklyTipVM | null; index?: number; total?: number; onAction?: () => void; onNext?: () => void; busy?: boolean; className?: string
}) {
  const t: WeeklyTipVM | null = tip === undefined
    ? { title: restaurant ? 'Péntek este minden 8. asztal üresen marad egy elmaradt foglalás miatt.' : 'Péntek délután minden 6. vendég nem jön el.', body: `Kapcsold be az emlékeztetőt 3 órával a foglalás előtt — a hasonló ${restaurant ? 'éttermeknél' : 'szalonoknál'} ez felére csökkenti az elmaradást.`, actionLabel: 'Bekapcsolom' }
    : tip
  if (!t) {
    return (
      <Card tone="dark" pad="lg" className={`flex flex-col justify-center ${className}`}>
        <Pill tone="onDark" size="sm" className="self-start text-ui-yellow"><Zap className="h-3 w-3" />E heti tipp</Pill>
        <div className="mt-4 text-ui-sub font-light leading-tight">{total ? 'Minden heti tippet átnéztél.' : 'Nincs sürgős tipp a héten.'}</div>
        <p className="mt-3 text-ui-body leading-relaxed text-white/60">A további javaslatokat lent találod, kategóriánként.</p>
      </Card>
    )
  }
  return (
    <Card tone="dark" pad="lg" className={`relative flex flex-col overflow-hidden ${className}`}>
      <Pill tone="onDark" size="sm" className="self-start text-ui-yellow"><Zap className="h-3 w-3" />E heti tipp{total > 1 ? ` · ${index + 1}/${total}` : ''}</Pill>
      <div className="mt-4 max-w-[460px] text-ui-sub font-light leading-tight">{t.title}</div>
      <p className="mt-3 max-w-[460px] text-ui-body leading-relaxed text-white/60">{t.body}</p>
      {t.metric && <div className="mt-3 text-ui-meta text-ui-yellow">{t.metric}</div>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-6">
        {(onAction || tip === undefined) && <Button variant="yellow" icon={tip === undefined ? Bell : undefined} onClick={onAction} loading={busy}>{t.actionLabel}</Button>}
        {(total > 1 || tip === undefined) && <Button variant="onDark" icon={ArrowRight} onClick={onNext}>Következő tipp</Button>}
      </div>
    </Card>
  )
}

export type HealthItem = { id: string; label: string; done: boolean }
const SAMPLE_HEALTH: HealthItem[] = ([['Borítókép feltöltve', true], ['Logó feltöltve', true], ['Bemutatkozás kitöltve', false], ['Cím és telefonszám megadva', true], ['„Jó tudni” pontok', false]] as const).map(([t, done]) => ({ id: t, label: t, done }))

/** Az oldal egészsége: pontszám a gyűrűben (Gyenge / Közepes / Jó / Kiváló) és az első 5 teendő a listából —
 *  a kész áthúzva sárga pipával, a nyitottra kattintva a beállításhoz visz. */
export function HealthScoreCard({ score = 72, label = 'Jó', missing, items = SAMPLE_HEALTH, onItem, className = '' }: { score?: number; label?: string; missing?: number; items?: HealthItem[]; onItem?: (id: string) => void; className?: string }) {
  const miss = missing ?? items.filter((i) => !i.done).length
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-4">
        <Ring pct={score} size={104}><span className="text-ui-sub font-light leading-none text-ui-text">{score}</span></Ring>
        <span><CardTitle>Foglalóoldal-egészség</CardTitle><span className="mt-1 flex items-center gap-1.5"><Pill tone="yellow" size="sm">{label}</Pill><Meta>{miss ? `${miss} teendő hiányzik` : 'Minden kész'}</Meta></span></span>
      </div>
      <div className="mt-4 space-y-1.5">
        {items.slice(0, 5).map((it) => {
          const row = (
            <>
              <IconCircle size="xs" tone={it.done ? 'yellow' : 'cell'}>{it.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}</IconCircle>
              <span className={it.done ? 'text-ui-muted line-through' : 'text-ui-text'}>{it.label}</span>
            </>
          )
          return onItem && !it.done
            ? <button key={it.id} type="button" onClick={() => onItem(it.id)} className="ui-press flex w-full items-center gap-2.5 rounded-ui-control text-left text-ui-body outline-none hover:opacity-70 focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button>
            : <div key={it.id} className="flex items-center gap-2.5 text-ui-body">{row}</div>
        })}
      </div>
    </Card>
  )
}

export type Tip = { icon: LucideIcon; cat: string; t: string; d: string; impact?: string; on?: boolean; action?: string }
export const TIPS: Tip[] = [
  { icon: Star, cat: 'Vendégélmény', t: 'Kérj értékelést', d: 'Foglalás után a vendég egy kattintással értékel a Google-on.', impact: 'több új vendég', action: 'Bekapcsolom' },
  { icon: Users, cat: 'Foglalás', t: 'Kapcsold be a várólistát', d: 'Ha betelt a nap, a vendég feliratkozik — lemondáskor szólunk neki.', action: 'Bekapcsolom' },
  { icon: Bell, cat: 'Foglalás', t: 'Állíts be emlékeztetőt', d: 'E-mail és push a foglalás előtt — kevesebb elmaradó vendég.', on: true },
  { icon: ImageIcon, cat: 'Profil', t: 'Tölts fel borítóképet', d: 'A képes foglalóoldalak jóval több foglalást hoznak.', impact: 'akár 2× foglalás', on: true },
  { icon: Gift, cat: 'Marketing', t: 'Hirdesd meg az ajándékutalványt', d: 'Advent előtt a legtöbben ilyenkor vesznek ajándékot.', action: 'Megnyitás' },
  { icon: FileText, cat: 'Profil', t: 'Írj rövid bemutatkozást', d: 'Pár mondat a helyről — szívesebben foglalnak ismerős helyre.', action: 'Megnyitás' },
]
export const TIP_CATS = ['Összes', 'Profil', 'Foglalás', 'Vendégélmény', 'Marketing'] as const

/** Javaslat-kártya: ikon-kör (bekapcsoltnál sárga), kategória, cím, leírás, a hatás, és a művelet — vagy
 *  „Bekapcsolva”, ha már él. */
export function TipCard({ tip, onAction, busy = false, className = '' }: { tip: Tip; /** élőben: a művelet (nélküle „Nincs jogosultság”, ha a tippnek lenne művelete) */ onAction?: () => void; busy?: boolean; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <IconCircle tone={tip.on ? 'yellow' : 'dark'} size="lg" icon={tip.icon} />
        <Pill tone="cell" size="sm">{tip.cat}</Pill>
      </div>
      <div className="mt-4 text-ui-row text-ui-text">{tip.t}</div>
      <div className="mt-1 text-ui-meta leading-relaxed text-ui-muted">{tip.d}</div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        {tip.impact ? <Meta className="text-ui-label">{tip.impact}</Meta> : <span />}
        {tip.on ? <Pill tone="yellow" size="sm"><Check className="h-3 w-3" strokeWidth={3} />Bekapcsolva</Pill>
          : tip.action ? <Button variant={tip.action === 'Bekapcsolom' ? 'dark' : 'glass'} size="sm" onClick={onAction} loading={busy}>{tip.action}</Button>
          : <Meta className="text-ui-label">Nincs jogosultság</Meta>}
      </div>
    </Card>
  )
}
