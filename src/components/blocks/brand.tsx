import { Link2, Mail, MessageCircle, QrCode, Send, type LucideIcon } from 'lucide-react'
import { Button, Card, IconButton, IconCircle, Meta, Pill, StatusPill } from '@/components/ui-kit'
import { BrandLogo } from '@/components/BrandLogo'
import { APP_URL } from '@/lib/brand'

/* A márka a vendégnek szóló felületeken. Cél a terjedés: minden kimenő levél, utalvány és foglalóoldal alján ott a
 * davelopment booking jele — a /design minden ilyen mintája ezt használja. */

/** Az üzlet logója a mintákban — a példa kedvéért a davelopment booking ikonja (élesben az üzlet feltöltött logója). */
export const BIZ_LOGO = '/icons/favico_light.svg?v=2'

/** „Foglalási rendszer: davelopment booking” — kis sor a levél / utalvány / foglalóoldal / minden vendég-oldal alján;
 *  kattintható: a davelopment booking oldalára visz (új lapon — a vendég a foglalásnál marad; beágyazva is működik).
 *  `dark`: sötét alapon. */
export function PoweredBy({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <a href={`${APP_URL}/`} target="_blank" rel="noopener" title="davelopment booking — online foglalási rendszer"
      className={`inline-flex items-center gap-2 text-ui-label outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ui-yellow/60 ${dark ? 'text-white/55' : 'text-ui-muted'} ${className}`}>
      Foglalási rendszer:
      <BrandLogo variant={dark ? 'dark' : 'light'} className="h-4" alt="davelopment booking" />
    </a>
  )
}

export type ReferralRow = { key: string | number; name: string; date: string; status: 'credited' | 'subscribed' | 'trial' | 'registered' }
const REF_STATUS: Record<ReferralRow['status'], [string, 'ok' | 'pending' | 'neutral']> = {
  credited: ['Előfizetett · jóváírva', 'ok'], subscribed: ['Előfizetett · a te előfizetésedkor jár', 'pending'], trial: ['Próbaidőn', 'pending'], registered: ['Regisztrált', 'neutral'],
}
const SAMPLE_REF_ROWS: ReferralRow[] = [{ key: 1, name: 'Szépség Stúdió Debrecen', date: 'Okt. 28.', status: 'credited' }, { key: 2, name: 'Barber Bros', date: 'Okt. 30.', status: 'trial' }, { key: 3, name: 'Kék Köröm', date: 'Nov. 1.', status: 'registered' }]

/** „Ajánld egy ismerősnek” (design 16.16, roadmap 54): a saját link, megosztás, az eredmény (megnyitások, regisztrált,
 *  előfizetett), a következő szint, kiket hozott. Élőben `url` / `onCopy` / `share` / `stats` / `rows` (a mintán a minta). */
export function ReferralCard({ wide = false, empty = false, labeled = false, badge, className = '', url = 'booking.davelopment.hu/r/anna-7k2', onCopy, share, stats, rows, tier = 3 }: {
  wide?: boolean; empty?: boolean
  /** feliratos megosztó gombok (az Ajánló aloldalon) — a Telephelyeken a kis ikonok maradnak */
  labeled?: boolean
  /** a kártya jobb alsó sarkába (az aloldalon: „+1 hónap ingyen előfizetőnként”) */
  badge?: React.ReactNode
  className?: string
  url?: string; onCopy?: () => void
  /** megosztás: WhatsApp / e-mail link, a telefon megosztója, a QR */
  share?: { whatsapp?: string; email?: string; onShare?: () => void; onQr?: () => void }
  stats?: { clicks: number; registered: number; subscribed: number }
  rows?: ReferralRow[]
  /** ennyi előfizető egy szint (a csík) */
  tier?: number
}) {
  // `wide`: széles helyre (a Telephelyek lap közepe) két hasábban — bal: link, megosztás, eredmény; jobb: jutalom, kiket hoztál
  // `empty`: még senkit nem hívott meg — nullák, üres csík, a lista helyén egy mondat, mit tegyen
  const st = stats ?? (empty ? { clicks: 0, registered: 0, subscribed: 0 } : { clicks: 5, registered: 3, subscribed: 1 })
  const list = rows ?? (empty ? [] : SAMPLE_REF_ROWS)
  // ingyen hónapok: előfizetőnként +1, felső határ nélkül — a csíkon hónaponként egy sárga szakasz, és egy üres a következőnek
  void tier
  const earned = st.subscribed, shown = Math.min(earned, 11)
  const btn = (I: LucideIcon, l: string, href?: string, onClick?: () => void) => labeled
    ? <Button key={l} icon={I} variant="onDark" size="sm" href={href} onClick={onClick}>{l}</Button>
    : <IconButton key={l} icon={I} label={l} variant="onDark" size="sm" href={href} onClick={onClick} />
  return (
    <Card tone="dark" className={`${wide ? 'grid gap-x-8 md:grid-cols-2' : 'flex flex-col'} ${className}`}>
      <div className="flex flex-col">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BIZ_LOGO} alt="" className="h-9 w-auto shrink-0" />
        <BrandLogo variant="dark" className="h-5" />
      </div>
      <div className="mt-4 text-ui-title font-light leading-tight">Ajánld egy ismerősnek</div>
      <Meta dark className="mt-1.5 leading-relaxed">Ha egy vállalkozás a linkeddel regisztrál, és a próbaidő után előfizet, te kapsz egy hónapot ingyen.</Meta>
      <div className="mt-4 flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-4 pr-1 text-ui-meta text-white/80"><span className="min-w-0 flex-1 truncate">{url.replace(/^https?:\/\//, '')}</span><IconButton icon={Link2} label="Link másolása" variant="yellow" size="sm" onClick={onCopy} /></div>
      {/* megosztás: ahol a legtöbben továbbküldik */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {btn(MessageCircle, 'WhatsApp', share?.whatsapp)}
        {btn(Mail, 'E-mail', share?.email)}
        {btn(Send, 'Megosztás', undefined, share?.onShare)}
        {btn(QrCode, 'QR-kód', undefined, share?.onQr)}
      </div>

      {/* az eddigi eredmény */}
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {([[st.clicks, 'megnyitotta'], [st.registered, 'regisztrált'], [st.subscribed, 'előfizetett']] as const).map(([v, l]) => (
          <span key={l}><span className="block text-ui-sub font-light leading-none">{v}</span><span className="mt-1 block text-ui-label text-white/55">{l}</span></span>
        ))}
      </div>
      {/* a Telephelyeken marad a sárga pill (az aloldalon a csík már kiírja) */}
      {!labeled && st.subscribed > 0 && <Pill tone="yellow" size="sm" className="mt-3 self-start">{st.subscribed} hónap ingyen eddig</Pill>}
      </div>

      <div className={wide ? 'flex flex-col md:pt-1' : 'flex flex-col'}>
      {/* az ingyen hónapok — nincs felső határ: ahány előfizető, annyi hónap */}
      <div className="mt-5 flex items-baseline justify-between text-ui-meta"><span>{earned ? `Eddig ${earned} hónap ingyen` : 'Még nincs ingyen hónapod'}</span><span className="text-white/55">+1 a következő előfizetővel</span></div>
      <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full">{Array.from({ length: shown + 1 }, (_, i) => <span key={i} className={`flex-1 rounded-full ${i < shown ? 'bg-ui-yellow' : 'ui-hatch-over'}`} />)}</div>

      {/* kiket hoztál */}
      <div className="mt-5 text-ui-label text-white/55">Kiket hoztál</div>
      {list.length === 0 ? (
        <div className="mt-1.5 rounded-ui-control border border-dashed border-white/20 px-4 py-5 text-center text-ui-meta text-white/60">Még senkit nem hívtál meg. Küldd el a linked egy ismerős vállalkozásnak — amint regisztrál, itt látod, hol tart.</div>
      ) : (
      <div className="mt-1.5 space-y-1">
        {list.map((r) => (
          <div key={r.key} className="flex items-center gap-2.5 rounded-ui-control bg-white/[0.06] px-3 py-2" /* ui-allow: sor sötét kártyán */>
            <IconCircle tone="onDark" size="sm">{r.name[0]}</IconCircle>
            <span className="min-w-0 flex-1"><span className="block truncate text-ui-meta">{r.name}</span><span className="block text-ui-label text-white/45">{r.date}</span></span>
            <StatusPill status={REF_STATUS[r.status][1]}>{REF_STATUS[r.status][0]}</StatusPill>
          </div>
        ))}
      </div>
      )}
      {/* az aloldalon: a jutalom-pill a kártya jobb alsó sarkában (a Telephelyeken nincs) */}
      {badge && <div className="mt-auto flex justify-end pt-5">{badge}</div>}
      </div>
    </Card>
  )
}
