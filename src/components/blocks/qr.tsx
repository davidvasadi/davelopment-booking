import { Fragment } from 'react'
import { socialIconDataUri, type SocialPlatform } from '@/lib/socialLinks'
import { BIZ_LOGO, PoweredBy } from './brand'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { Button, Card, CardTitle, Checkbox, Meta, MarqueeText } from '@/components/ui-kit'

/* A foglalóoldal QR-kódja (a /design 16.11, a landing Marketing oldala). Külön fájl, hogy a qrcode
 * könyvtár csak ott töltődjön be, ahol QR van (pl. ne a nav borítóival minden oldalra). */

/** Valódi, beolvasható QR (szinkron, SVG) a foglalóoldal linkjére — a BusinessQrCard is ezt a linket kódolja. Ha van
 *  beállított logó (`logo`), középre kerül fehér keretben; ilyenkor H-szintű hibajavítás, hogy a logó mellett is olvasható. */
export function QrSvg({ url, logo, className = '' }: { url: string; logo?: React.ReactNode; className?: string }) {
  const q = QRCode.create(url, { errorCorrectionLevel: logo ? 'H' : 'M' })
  const n = q.modules.size
  const hole = logo ? Math.round(n * 0.26) : 0
  const lo = Math.floor((n - hole) / 2), hi = lo + hole
  const cells: React.ReactNode[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (logo && x >= lo && x < hi && y >= lo && y < hi) continue
    if (q.modules.get(x, y)) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
  }
  return (
    <span className={`relative block ${className}`}>
      <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="h-full w-full" fill="var(--ui-dark)" shapeRendering="crispEdges" role="img" aria-label="QR-kód a foglalóoldalhoz">{cells}</svg>
      {logo && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-[24%] w-[24%] items-center justify-center rounded-ui-control bg-white p-[3%]">{logo}</span></span>}
    </span>
  )
}

const BOOKING_URL = 'https://booking.davelopment.hu/fodraszat-budapest'
const SAMPLE_HOURS: QrHoursRow[] = [['H–P', '9:00–19:00'], ['Szo', '9:00–14:00'], ['V', 'zárva']]
const SAMPLE_SOCIALS: QrSocial[] = [{ platform: 'instagram', handle: '@fodraszatbudapest' }, { platform: 'facebook', handle: '@fodraszatbudapest' }, { platform: 'tiktok', handle: '@fodraszatbudapest' }]

export type QrHoursRow = [string, string]
export type QrSocial = { platform: SocialPlatform; handle: string }

// eslint-disable-next-line @next/next/no-img-element
const logoImg = (src: string) => <img src={src} alt="" className="h-full w-full object-contain" />

/** QR-kód a foglalóoldalhoz (Foglalóoldal-szerkesztő › Link & QR): előnézet a logóval, mi kerüljön a nyomtatott lapra
 *  (nyitvatartás, közösségi oldalak), letöltés PNG-ben, nyomtatás. Élőben a szerkesztő adataival; a mintán a minta. */
export function BusinessQr({ url = BOOKING_URL, logo = BIZ_LOGO, hours = true, onHours, socials = true, onSocials, hasHours = true, hasSocials = true, onDownload, onPrint, busy = false, withPreview = false, className = '' }: {
  url?: string; logo?: string | null
  /** a nyomtatott lapra kerül-e a nyitvatartás / a közösségi oldalak */
  hours?: boolean; onHours?: (v: boolean) => void; socials?: boolean; onSocials?: (v: boolean) => void
  /** van-e egyáltalán mit rátenni (nincs beállított nyitvatartás / link → a jelölő nem látszik) */
  hasHours?: boolean; hasSocials?: boolean
  onDownload?: () => void; onPrint?: () => void; busy?: boolean; className?: string
  /** mellette a nyomtatott lap előnézete is látszik: mobilon (md alatt) a saját kis QR és a cím-leírás nem kell (az előnézet
   *  mutatja), és a kártya kerete / térköze sem (a felugró lap ad) — csak a jelölők és a gombok maradnak */
  withPreview?: boolean
}) {
  const m = withPreview ? 'max-md:hidden' : ''
  const box = (label: string, on: boolean, set?: (v: boolean) => void) => <Checkbox label={label} {...(set ? { checked: on, onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.checked) } : { defaultChecked: on })} />
  return (
    <Card tone="white" className={`flex flex-col gap-4 sm:flex-row sm:items-center ${withPreview ? 'max-md:bg-transparent max-md:p-0' : ''} ${className}`}>
      <Card tone="cell" inner pad="sm" className={`h-36 w-36 shrink-0 self-center sm:self-auto ${m}`}><QrSvg url={url} logo={logo ? logoImg(logo) : undefined} className="h-full w-full" /></Card>
      <div className="min-w-0 flex-1">
        <CardTitle className={m}>QR-kód a foglaló oldalhoz</CardTitle>
        <Meta className={`mt-1 leading-relaxed ${m}`}>Tedd ki a pultra, kirakatba vagy névjegyre — beolvasva rögtön a foglaló oldal nyílik meg.{logo ? ' A közepén a logód.' : ' Ha feltöltesz logót, a közepére kerül.'}</Meta>
        {(hasHours || hasSocials) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-ui-meta text-ui-text">
            {hasHours && box('Nyitvatartás a lapon', hours, onHours)}
            {hasSocials && box('Közösségi oldalak', socials, onSocials)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5 max-lg:[&>*]:min-w-0 max-lg:[&>*]:flex-1"><Button variant="glass" icon={Download} onClick={onDownload} disabled={busy}>Letöltés (PNG)</Button><Button icon={Printer} onClick={onPrint} disabled={busy}>Nyomtatás</Button></div>
      </div>
    </Card>
  )
}

/** A nyomtatott A5-ös lap: logó, üzletnév, alcím, QR, a link egy sorban (https:// nélkül), és — ha van / be van
 *  kapcsolva — a nyitvatartás és a közösségi oldalak; legalul a rendszer jele. `print`: a valódi A5-ös lap mérete
 *  (148 × 210 mm), nagyobb QR-ral és betűkkel. */
export function QrPrintSheet({ name = 'Fodrászat Budapest', subtitle = 'Foglalj időpontot online', url = BOOKING_URL, logo = BIZ_LOGO, hours = SAMPLE_HOURS, socials = SAMPLE_SOCIALS, extras = true, print = false, className = '' }: {
  name?: string; subtitle?: string; url?: string; logo?: string | null; hours?: QrHoursRow[]; socials?: QrSocial[]
  /** a mintán: nyitvatartás + közösségi egyszerre ki/be */
  extras?: boolean; print?: boolean; className?: string
}) {
  const short = url.replace(/^https?:\/\//, '')
  const h = extras ? hours : [], so = extras ? socials : []
  const handle = so[0]?.handle
  return (
    <Card tone="white" className={print
      ? `flex h-[210mm] w-[148mm] flex-col items-center justify-center gap-3 rounded-none p-[14mm] text-center shadow-none ${className}`
      : `flex aspect-[148/210] w-full max-w-[300px] flex-col items-center justify-center gap-2 text-center ${className}`}>
      <div className={print ? 'text-[26pt] font-medium leading-tight text-ui-text' : 'text-ui-sub font-medium text-ui-text'}>{name}</div>
      <Meta className={print ? 'text-[14pt]' : 'text-ui-body'}>{subtitle}</Meta>
      <QrSvg url={url} logo={logo ? logoImg(logo) : undefined} className={print ? 'my-[6mm] h-[80mm] w-[80mm]' : 'my-2 h-36 w-36'} />
      <MarqueeText className={`max-w-full whitespace-nowrap text-ui-text ${print ? 'text-[11pt]' : 'text-ui-label'}`}>{short}</MarqueeText>
      {(h.length > 0 || so.length > 0) && (
        <div className={`w-full border-t border-dashed border-ui-divider ${print ? 'mt-[4mm] pt-[5mm]' : 'mt-2 pt-3'}`}>
          {h.length > 0 && (
            <div className={`mx-auto grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-left ${print ? 'text-[11pt]' : 'text-ui-label'}`}>
              {h.map(([d, t]) => <Fragment key={d}><span className="text-ui-muted">{d}</span><span className="text-ui-text">{t}</span></Fragment>)}
            </div>
          )}
          {so.length > 0 && (
            <div className={`flex items-center justify-center gap-2 ${h.length ? 'mt-3' : ''}`}>
              {so.slice(0, 5).map((x, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${x.platform}-${i}`} src={socialIconDataUri(x.platform)} alt="" className={print ? 'h-[8mm] w-[8mm] rounded-full' : 'h-6 w-6 rounded-full'} />
              ))}
              {handle && <span className={`text-ui-muted ${print ? 'text-[11pt]' : 'text-ui-label'}`}>{handle}</span>}
            </div>
          )}
        </div>
      )}
      <PoweredBy className="mt-2" />
    </Card>
  )
}
