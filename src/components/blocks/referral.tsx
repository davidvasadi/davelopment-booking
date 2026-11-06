import { Check, Copy, Gift, Link2, Mail, MessageCircle, MousePointerClick, QrCode, Send, UserPlus, BadgeCheck, type LucideIcon } from 'lucide-react'
import { Button, Card, CardTitle, FieldRow, IconButton, IconCircle, Meta, Pill, StatusPill, Table, Td, Th, Tr } from '@/components/ui-kit'
import { ReferralCard } from './brand'

/* Ajánló program — saját aloldal (design 20.x, végleges terv): /dashboard/ajanlo és /restaurant/ajanlo. A szabály FIX:
 * minden vállalkozás, aki a linkkel regisztrál és a próbaidő után előfizet → az AJÁNLÓ kap +1 hónapot ingyen, felső határ
 * nélkül (nem nyereményjáték). A meghívott a szokásos 30 napos próbával indul; ingyen hónapot ő is ajánlással kap. Kis, önálló fájl. Minta-adattal a design-oldalon; élőben a referralSummary adja. */

export type ReferralStatus = 'credited' | 'subscribed' | 'trial' | 'registered'
export type ReferralListRow = { key: string | number; name: string; date: string; status: ReferralStatus; credit?: string | null }
export type ReferralPageData = {
  url: string
  stats: { clicks: number; registered: number; subscribed: number }
  /** a már megkapott ingyen hónapok (pl. „2026. Dec.”), és ha van, a következő, ami már jár, csak még nincs jóváírva */
  freeMonths: string[]
  pendingMonths?: number
  rows: ReferralListRow[]
}

export const SAMPLE_REFERRAL: ReferralPageData = {
  url: 'booking.davelopment.hu/r/anna-7k2',
  stats: { clicks: 14, registered: 4, subscribed: 2 },
  freeMonths: ['2026. Dec.', '2027. Jan.'],
  pendingMonths: 0,
  rows: [
    { key: 1, name: 'Szépség Stúdió Debrecen', date: 'Okt. 28.', status: 'credited', credit: 'Dec. 1.' },
    { key: 2, name: 'Barber Bros', date: 'Okt. 30.', status: 'credited', credit: 'Jan. 1.' },
    { key: 3, name: 'Kék Köröm', date: 'Nov. 2.', status: 'trial' },
    { key: 4, name: 'Bistro Andrássy', date: 'Nov. 4.', status: 'registered' },
  ],
}
export const EMPTY_REFERRAL: ReferralPageData = { url: 'booking.davelopment.hu/r/anna-7k2', stats: { clicks: 0, registered: 0, subscribed: 0 }, freeMonths: [], rows: [] }

// a meghívott útja: megnyitotta → regisztrált → próbaidőn → előfizetett (jóváírva)
const STEP: Record<ReferralStatus, { label: string; tone: 'ok' | 'pending' | 'neutral'; reward: string }> = {
  registered: { label: 'Regisztrált', tone: 'neutral', reward: 'akkor jár, ha előfizet' },
  trial: { label: 'Próbaidőn', tone: 'pending', reward: 'akkor jár, ha előfizet' },
  subscribed: { label: 'Előfizetett', tone: 'pending', reward: 'jár — a következő számládon írjuk jóvá' },
  credited: { label: 'Előfizetett', tone: 'ok', reward: 'jóváírva' },
}

/** Fent, sötét: mit kap, a saját link (másolás) és a megosztás — ahol a legtöbben továbbküldik. */
export function ReferralHero({ url, onCopy, share, className = '' }: { url: string; onCopy?: () => void; share?: { whatsapp?: string; email?: string; onShare?: () => void; onQr?: () => void }; className?: string }) {
  // a sötét kártyán a sötét felületre való gomb (halvány fehér kitöltés) — nem a világos üveg
  const btn = (I: LucideIcon, l: string, href?: string, onClick?: () => void) => <Button key={l} variant="onDark" size="sm" icon={I} href={href} onClick={onClick}>{l}</Button>
  return (
    <Card tone="dark" pad="lg" className={`flex flex-col ${className}`}>
      <div className="text-ui-sub font-light leading-tight">Ajánld egy vállalkozónak —<br />minden előfizetőért +1 hónap ingyen.</div>
      <Meta dark className="mt-2 leading-relaxed">Ha egy vállalkozás a linkeddel regisztrál, és a próbaidő után előfizet, te kapsz egy hónapot ingyen. Nincs felső határ: ahány előfizető, annyi ingyen hónap.</Meta>
      <div className="mt-6 flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-4 pr-1 text-ui-body text-white/85">
        <Link2 className="h-4 w-4 shrink-0 text-white/55" /><span className="min-w-0 flex-1 truncate">{url.replace(/^https?:\/\//, '')}</span>
        <Button variant="yellow" size="sm" icon={Copy} onClick={onCopy}>Másolás</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {btn(MessageCircle, 'WhatsApp', share?.whatsapp)}
        {btn(Mail, 'E-mail', share?.email)}
        {btn(Send, 'Megosztás', undefined, share?.onShare)}
        {btn(QrCode, 'QR-kód', undefined, share?.onQr)}
      </div>
    </Card>
  )
}

/** Az eredmény négy számban: megnyitották, regisztráltak, előfizettek, és az ingyen hónapok (sárga). */
export function ReferralStats({ stats, months, className = '' }: { stats: ReferralPageData['stats']; months: number; className?: string }) {
  const cell = (I: LucideIcon, v: number, l: string, yellow = false) => (
    <Card key={l} tone={yellow ? 'white' : 'glass'} className="flex flex-col">
      <IconCircle tone={yellow ? 'yellow' : 'cell'} size="md" icon={I} />
      <div className="mt-4 text-ui-num font-light leading-none text-ui-text">{v}</div>
      <Meta className="mt-1.5">{l}</Meta>
    </Card>
  )
  return (
    <div className={`grid grid-cols-2 gap-[5px] ${className}`}>
      {cell(MousePointerClick, stats.clicks, 'megnyitotta a linked')}
      {cell(UserPlus, stats.registered, 'regisztrált')}
      {cell(BadgeCheck, stats.subscribed, 'előfizetett')}
      {cell(Gift, months, 'hónap ingyen eddig', true)}
    </div>
  )
}

/** Az ingyen hónapok: melyik hónapra kaptad (csempék), és a következő csempe, ami a következő előfizetővel jön. */
export function ReferralMonths({ months, pending = 0, className = '' }: { months: string[]; pending?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardTitle>Ingyen hónapjaid</CardTitle>
      <Meta className="mt-1">{months.length ? `Eddig ${months.length} hónapot kaptál — ennyivel tolódik ki a következő fizetésed.` : 'Az első előfizetőddel jön az első ingyen hónap.'}</Meta>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {months.map((m) => <Pill key={m} tone="yellow"><Check className="h-3.5 w-3.5" />{m}</Pill>)}
        {Array.from({ length: pending }, (_, i) => <Pill key={`p${i}`} tone="dark">jár · jóváírás a következő számlán</Pill>)}
        <Pill tone="hatchCell">+1 a következő előfizetővel</Pill>
      </div>
    </Card>
  )
}

/** Kiket hoztál: vállalkozás, mikor regisztrált, hol tart (állapot), és mi a jutalom állapota. */
export function ReferralList({ rows, className = '' }: { rows: ReferralListRow[]; className?: string }) {
  return (
    <Card className={className}>
      <CardTitle>Kiket hoztál</CardTitle>
      {rows.length === 0 ? (
        <div className="mt-3 rounded-ui-inner ui-hatch-cell px-4 py-8 text-center text-ui-body text-ui-muted">Még senki nem regisztrált a linkeddel. Küldd el egy ismerős vállalkozónak — amint regisztrál, itt látod, hol tart.</div>
      ) : (
        <Table minWidth={560} className="mt-2">
          <thead><tr><Th>Vállalkozás</Th><Th>Regisztrált</Th><Th>Hol tart</Th><Th>A te jutalmad</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td><span className="flex items-center gap-2.5"><IconCircle tone="cell" size="sm">{r.name[0]}</IconCircle>{r.name}</span></Td>
                <Td className="text-ui-muted">{r.date}</Td>
                <Td><StatusPill status={STEP[r.status].tone}>{STEP[r.status].label}</StatusPill></Td>
                <Td className={r.status === 'credited' ? 'text-ui-text' : 'text-ui-muted'}>{r.status === 'credited' ? `+1 hónap · ${r.credit ? `jóváírva ${r.credit}` : 'jóváírva'}` : STEP[r.status].reward}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

/** Így működik — egy kártyán, a három lépés egymás mellett (szaggatott vonallal elválasztva). */
export function ReferralSteps({ stacked = false, className = '' }: { /** egymás alatt (mobil) */ stacked?: boolean; className?: string }) {
  const steps: [LucideIcon, string, string][] = [
    [Send, 'Elküldöd a linked', 'WhatsAppon, e-mailben, vagy add meg a kódod — regisztrációkor kézzel is beírható.'],
    [UserPlus, 'Regisztrál, és kipróbálja', '30 napig ingyen, kártya nélkül — közben itt látod, hol tart.'],
    [Gift, 'Előfizet — te kapsz +1 hónapot', 'Amikor a próbaidő után először fizet, a következő számládból jóváírjuk.'],
  ]
  return (
    <Card className={className}>
      <CardTitle>Így működik</CardTitle>
      <div className={`mt-4 grid gap-5 ${stacked ? '' : 'md:grid-cols-3 md:gap-0 md:divide-x md:divide-dashed md:divide-ui-divider'}`}>
        {steps.map(([I, t, d], i) => (
          <div key={t} className={`flex gap-3 ${stacked ? '' : 'md:px-5 md:first:pl-0 md:last:pr-0'}`}>
            <IconCircle tone={i === 2 ? 'yellow' : 'dark'} size="md" icon={I} />
            <span className="min-w-0">
              <span className="block text-ui-row text-ui-text"><span className="text-ui-muted">{i + 1}.</span> {t}</span>
              <Meta className="mt-1 leading-relaxed">{d}</Meta>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** A szabályok kompakt rácsban: hat kis csempe (megnevezés felül, érték alatta) a világosabb háttéren. */
export function ReferralRules({ className = '' }: { className?: string }) {
  const rules: [string, React.ReactNode, string?][] = [
    ['Jutalom', '+1 hónap ingyen', 'neked, amikor ő a próbaidő után előfizet'],
    ['Felső határ', 'nincs', 'ahány előfizető, annyi hónap'],
    ['A meghívott', '30 nap próba', 'ingyen hónapot ő is ajánlással kap'],
    ['A link érvényes', '60 napig', 'ennyi ideig emlékszünk, kitől jött'],
    ['Saját magad', <StatusPill key="s" status="bad">nem ajánlhatod</StatusPill>, 'azonos e-mail, cég vagy kártya'],
    ['Pénzre váltás', 'nem lehet'],
  ]
  return (
    <Card className={`flex flex-col ${className}`}>
      <CardTitle>Szabályok</CardTitle>
      <div className="mt-4 grid flex-1 grid-cols-2 gap-1.5">
        {rules.map(([l, v, h]) => (
          <div key={l} className="rounded-ui-inner bg-ui-cell/60 p-3">
            <Meta className="text-ui-label">{l}</Meta>
            <div className="mt-1 text-ui-row text-ui-text">{v}</div>
            {h && <Meta className="mt-0.5 text-ui-label leading-snug">{h}</Meta>}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Kész üzenet: a szöveg a linkkel, alatta a CTA-sor — Megosztás (telefonon a rendszer megosztója: iMessage, Viber,
 *  Messenger, WhatsApp…; gépen a szöveg a vágólapra) és Üzenet másolása. Egyik csatornát sem emeljük ki.
 *  Élőben `onShare`, `onCopy`. */
export function ReferralMessage({ url, onCopy, onShare, className = '' }: { url: string; onCopy?: () => void; onShare?: () => void; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <CardTitle>Kész üzenet</CardTitle>
      <Meta className="mt-1">Küldd el, ahol beszélni szoktatok — iMessage, Viber, Messenger, WhatsApp, e-mail.</Meta>
      <div className="mt-3 rounded-ui-inner bg-ui-cell/60 p-4 text-ui-body leading-relaxed text-ui-text">
        Szia! Én a davelopment bookingot használom a foglalásokra — online foglalás, emlékeztetők, vendéglista egy helyen. Ezzel a linkkel 30 napig ingyen kipróbálhatod, kártya nélkül: {url.replace(/^https?:\/\//, '')}
      </div>
      {/* CTA: a rendszer megosztója (bármelyik csatorna), vagy másolás */}
      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        <Button variant="yellow" icon={Send} onClick={onShare}>Megosztás</Button>
        <Button variant="glass" icon={Copy} onClick={onCopy}>Üzenet másolása</Button>
      </div>
    </Card>
  )
}

/** Az egész aloldal tartalma (a keret — nav, cím — a hívóé): fent a Telephelyek letisztult ajánló-kártyája (ugyanaz a
 *  kártya), alatta a bővítés ugyanabban a stílusban: így működik (3 lépés), a szabályok és a kész üzenet. */
export function ReferralPage({ card, url = SAMPLE_REFERRAL.url, onCopyMessage, onShareMessage }: { card?: React.ReactNode; url?: string; onCopyMessage?: () => void; onShareMessage?: () => void }) {
  return (
    <div className="space-y-[5px]">
      {card ?? <ReferralCard wide labeled />}
      <ReferralSteps />
      {/* egyforma magasak: a szabályok rácsa és a kész üzenet (a gomb az aljára igazítva) */}
      <div className="grid gap-[5px] lg:grid-cols-2">
        <ReferralRules />
        <ReferralMessage url={url} onCopy={onCopyMessage} onShare={onShareMessage} />
      </div>
    </div>
  )
}
