import { Check, CalendarX2, Gift, Star, X, type LucideIcon } from 'lucide-react'
import { Button, Card, IconCircle, Meta, StatusPill, Textarea } from '@/components/ui-kit'
import { PoweredBy } from './brand'
import { VCODE, VoucherCard, type VoucherBiz } from './money'
import { VoucherFit } from './voucher-template-picker'
import { DEFAULT_VOUCHER_DESIGN, type VoucherDesign } from '@/lib/voucherDesign'

/*
 * A vendég kis oldalai (design 21.20) — amire egy e-mail linkje visz: lemondás (megerősítés + kész), foglalás sikeres,
 * értékelés, foglalási feltételek, ajándékutalvány, hírlevél-leiratkozás. Egy kinézet: az oldal háttere, felül az
 * üzlet logója és neve, középen egy fehér kártya, alul a „Foglalási rendszer: davelopment booking”.
 */

export type GuestBiz = { name?: string | null; logo?: string | null }

/** A vendég-oldal kerete. `wide`: hosszabb szöveghez (feltételek). */
export function GuestShell({ biz = { name: 'Fodrászat Budapest' }, wide = false, page = true, children, className = '' }: { biz?: GuestBiz | null; wide?: boolean; /** élőben a teljes képernyő; a mintán keretben */ page?: boolean; children: React.ReactNode; className?: string }) {
  const initials = (biz?.name ?? '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`flex flex-col items-center bg-ui-page px-4 pb-8 pt-10 ${page ? 'min-h-dvh' : 'rounded-ui-container'} ${className}`}>
      {biz?.name && (
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {biz.logo ? <img src={biz.logo} alt="" className="h-9 w-auto max-w-[120px] rounded-ui-control object-contain" /> : <IconCircle tone="dark" size="md">{initials}</IconCircle>}
          <span className="text-ui-body text-ui-text">{biz.name}</span>
        </div>
      )}
      <Card tone="white" pad="lg" className={`mt-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>{children}</Card>
      <div className="mt-auto pt-10"><PoweredBy /></div>
    </div>
  )
}

export type GuestRow = [string, string]
/** Egy állapot a kártyán: kör-ikon, cím, egy-két mondat, a foglalás sorai, alatta a gombok (`children`). */
export function GuestResult({ tone = 'ok', icon, title, text, rows, children }: {
  tone?: 'ok' | 'bad' | 'warn' | 'cell'; icon?: LucideIcon; title: string; text?: React.ReactNode; rows?: GuestRow[]; children?: React.ReactNode
}) {
  const I = icon ?? (tone === 'ok' ? Check : tone === 'bad' ? X : CalendarX2)
  return (
    <div className="text-center">
      <IconCircle tone={tone} size="lg" icon={I} className="mx-auto" />
      <div className="mt-4 text-ui-sub font-light text-ui-text">{title}</div>
      {text && <Meta className="mx-auto mt-1.5 max-w-[340px] text-ui-body leading-relaxed">{text}</Meta>}
      {rows && rows.length > 0 && (
        <div className="mt-5 space-y-1.5 rounded-ui-inner bg-ui-cell p-4 text-left">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-ui-body"><span className="text-ui-muted">{k}</span><span className="text-right text-ui-text">{v}</span></div>)}
        </div>
      )}
      {children && <div className="mt-6 flex flex-col gap-2">{children}</div>}
    </div>
  )
}

/** Az értékelés: 5 csillag (kattintásra), szöveg, Elküldöm. Élőben `rating` / `onRating`, `comment` / `onComment`. */
export type ReviewLabels = { title: string; subtitle: string; placeholder: string; submit: string; pick: string }
const REVIEW_HU: ReviewLabels = { title: 'Milyen volt nálunk?', subtitle: 'Egy perc az egész — minden visszajelzést elolvasunk.', placeholder: 'Mi tetszett, min javíthatnánk? (nem kötelező)', submit: 'Elküldöm', pick: 'Válassz csillagot' }
export function ReviewForm({ rating = 4, onRating, comment = '', onComment, onSubmit, busy = false, l = REVIEW_HU }: {
  rating?: number; onRating?: (n: number) => void; comment?: string; onComment?: (v: string) => void; onSubmit?: () => void; busy?: boolean
  /** a vendég nyelvén (a megszólítással együtt) */
  l?: ReviewLabels
}) {
  return (
    <div className="text-center">
      <div className="text-ui-sub font-light text-ui-text">{l.title}</div>
      <Meta className="mt-1.5 text-ui-body">{l.subtitle}</Meta>
      <div className="mt-5 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= rating
          const star = <Star className={`h-9 w-9 ${on ? 'fill-ui-yellow text-ui-yellow' : 'text-ui-grey'}`} strokeWidth={1.4} />
          return onRating ? <button key={n} type="button" aria-label={`${n} csillag`} aria-pressed={on} onClick={() => onRating(n)} className="ui-press rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{star}</button> : <span key={n} className="p-1">{star}</span>
        })}
      </div>
      <Textarea className="mt-5" rows={4} placeholder={l.placeholder} {...(onComment ? { value: comment, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onComment(e.target.value) } : { defaultValue: comment })} />
      <Button className="mt-4 w-full" loading={busy} disabled={!!onRating && rating < 1} onClick={onSubmit}>{rating < 1 ? l.pick : l.submit}</Button>
    </div>
  )
}

/** Az ajándékutalvány oldala: a kártya, az állapot és a lejárat, és ha még érvényes, a beváltás a foglalóoldalon. */
export function VoucherView({ amount = '20 000 Ft', code = VCODE, to, status = 'Érvényes', active = true, expires = '2027. Márc. 31.', bookHref, restaurant = false, photo, design = DEFAULT_VOUCHER_DESIGN, qr, biz, tone, lang }: {
  amount?: string; code?: string; to?: string; status?: string; active?: boolean; expires?: string; bookHref?: string; restaurant?: boolean; photo?: string | null
  /** a típus sablonja (lib/voucherDesign) és a QR (lib/voucherQr) — ugyanaz a jegy, amit a vendég kapott */
  design?: VoucherDesign; qr?: string; biz?: VoucherBiz
  /** az állapot színe (pill, mint a vezérlőpulton): érvényes zöld, beváltva sötét, lejárt / visszatérítve piros */
  tone?: 'ok' | 'confirmed' | 'bad'
  /** a jegy nyelve (a vásárlóé) */
  lang?: string | null
}) {
  return (
    <div>
      <VoucherFit><VoucherCard amount={amount} code={code} to={to} expires={expires} restaurant={restaurant} photo={photo} design={design} qr={qr} biz={biz} lang={lang} /></VoucherFit>
      <div className="mt-4 space-y-1.5 rounded-ui-inner bg-ui-cell p-4 text-ui-body">
        <div className="flex justify-between gap-3"><span className="text-ui-muted">Állapot</span><StatusPill status={tone ?? (active ? 'ok' : 'confirmed')}>{status}</StatusPill></div>
        <div className="flex justify-between gap-3"><span className="text-ui-muted">Érvényes</span><span className="text-ui-text">{expires}-ig</span></div>
        <div className="flex justify-between gap-3"><span className="text-ui-muted">Kód</span><span className="font-mono text-ui-text">{code}</span></div>
      </div>
      {active && <Button className="mt-5 w-full" icon={Gift} href={bookHref}>Beváltás foglaláskor</Button>}
      <Meta className="mt-3 text-center text-ui-label">{active ? 'Foglaláskor add meg a kódot, vagy mutasd fel a helyszínen.' : 'Ez az utalvány már nem váltható be.'}</Meta>
    </div>
  )
}
