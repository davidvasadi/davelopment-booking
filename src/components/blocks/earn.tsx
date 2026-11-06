import { Banknote, Check, Send } from 'lucide-react'
import { Button, Card, CardTitle, Field, IconCircle, Input, Meta, Pill, Select, StatusPill, Table, Td, Textarea, Th, Tr } from '@/components/ui-kit'

/* „Keress pénzt” (design 20.7–20.8) — a davelopment ügynökség jutalék-programja, EBBEN a rendszerben kezelve (a
 * davelopment.hu-hoz nem kell nyúlni): a vállalkozó ügyfelet hoz bármelyik davelopment-szolgáltatásra (weboldal, design,
 * arculat, szoftver, SEO, hirdetéskezelés, karbantartás), és a MEGKÖTÖTT
 * szerződés értékének 10%-át kifizetjük neki — a szerződés megkötése után.
 * A Backstage-ben Dave állítja az állapotot és a szerződés összegét, a jutalék magától számolódik. */

export type EarnStatus = 'new' | 'contacted' | 'offer' | 'signed' | 'paid' | 'lost'
export const EARN_STATUS: Record<EarnStatus, { label: string; tone: 'neutral' | 'pending' | 'ok' | 'bad' | 'confirmed' }> = {
  new: { label: 'Bejelentve', tone: 'neutral' },
  contacted: { label: 'Találkoztunk', tone: 'pending' },
  offer: { label: 'Ajánlat kiment', tone: 'pending' },
  signed: { label: 'Megállapodtunk', tone: 'confirmed' },
  paid: { label: 'Átutalva', tone: 'ok' },
  lost: { label: 'Nem jött létre', tone: 'bad' },
}
// a davelopment szolgáltatásai (davelopment.hu), ahogy az oldalon szerepelnek
export const EARN_NEEDS = ['Weboldal / webshop', 'UX/UI design és fejlesztés', 'Branding és arculat', 'Egyedi szoftver / digitális rendszer', 'SEO és tartalommarketing', 'Hirdetéskezelés (Google Ads, Meta)', 'Karbantartás', 'Még nem tudja pontosan']
export const EARN_RATE = 0.1
const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

export type EarnLead = { key: string | number; company: string; need: string; date: string; status: EarnStatus; contract?: number | null; paidAt?: string | null; referrer?: string }
export const SAMPLE_EARN: EarnLead[] = [
  { key: 1, company: 'Szépség Stúdió Debrecen', need: 'Weboldal / webshop', date: 'Okt. 12.', status: 'paid', contract: 890000, paidAt: 'Nov. 3.', referrer: 'Anna Fodrászat' },
  { key: 2, company: 'Barber Bros', need: 'Egyedi szoftver / digitális rendszer', date: 'Okt. 30.', status: 'signed', contract: 1450000, referrer: 'Anna Fodrászat' },
  { key: 3, company: 'Kék Köröm', need: 'Hirdetéskezelés (Google Ads, Meta)', date: 'Nov. 2.', status: 'offer', referrer: 'Bistro Andrássy' },
  { key: 4, company: 'Zöld Kert Étterem', need: 'Branding és arculat', date: 'Nov. 4.', status: 'new', referrer: 'Anna Fodrászat' },
]

/** Fent: mit kap (a megkötött szerződés 10%-a, csak a szerződés után), és két szám — eddig kifizetve, függőben. */
export function EarnHero({ paid = 89000, pending = 145000, className = '' }: { paid?: number; pending?: number; className?: string }) {
  return (
    <Card tone="dark" pad="lg" className={`flex flex-col ${className}`}>
      <Pill tone="yellow" icon={Banknote} className="self-start">10% a tiéd</Pill>
      <div className="mt-4 text-ui-title font-light leading-tight">Te ismered őket, mi megcsináljuk — a munka 10%-a a tiéd.</div>
      <Meta dark className="mt-1.5 leading-relaxed">Van egy ismerősöd, akinek ráférne egy új weboldal, egy ütősebb arculat vagy pár jól célzott Google-hirdetés? Mutass be minket egymásnak — egy kávé, egy üzenet, egy telefon. A többit mi visszük: ajánlat, tervezés, kivitelezés. Ha összejön, a munka értékének 10%-a a tiéd — egy jó ajánlás akár több havi előfizetésed árát is kitermeli.</Meta>
      <div className="mt-auto pt-6"><div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
        <span><span className="block text-ui-sub font-light leading-none text-ui-yellow">{ft(paid)}</span><span className="mt-1 block text-ui-label text-white/55">eddig a zsebedben</span></span>
        <span><span className="block text-ui-sub font-light leading-none">{ft(pending)}</span><span className="mt-1 block text-ui-label text-white/55">úton hozzád — hamarosan átutaljuk</span></span>
      </div></div>
    </Card>
  )
}

/** Az ajánló bejelentése: kit hoz (cég, kapcsolattartó, telefon, e-mail), mire van szüksége, hol tart, megjegyzés — hogy
 *  tudjuk, hozzá tartozik. A kapcsolatot ŐT intézi (ő beszél vele, ő hozza össze a találkozót), mi nem hívogatunk.
 *  Élőben `onSubmit`, `code` (az ügyfél ezzel jelezheti, kitől jön). */
export function EarnForm({ onSubmit, busy = false, code = 'ANNA-7K2', className = '' }: { onSubmit?: () => void; busy?: boolean; code?: string; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <CardTitle>Kit mutatsz be?</CardTitle>
      <Meta className="mt-1">Írd be, és már a tiéd — így tudjuk, kitől jött. Ha ő keres minket, elég annyit mondania, hogy tőled jön, vagy a kódod: <span className="text-ui-text">{code}</span></Meta>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Cég / vállalkozás"><Input placeholder="pl. Kék Köröm" /></Field>
        <Field label="Kapcsolattartó"><Input placeholder="pl. Nagy Eszter" /></Field>
        <Field label="Telefon"><Input type="tel" placeholder="+36 …" /></Field>
        <Field label="E-mail"><Input type="email" placeholder="eszter@pelda.hu" /></Field>
        <Field label="Mire van szüksége?"><Select defaultValue="Weboldal / webshop">{EARN_NEEDS.map((n) => <option key={n}>{n}</option>)}</Select></Field>
        <Field label="Hol tartotok?"><Select defaultValue="talked"><option value="talked">Szóltam neki rólatok</option><option value="interested">Kíváncsi, hívhatjátok</option><option value="meeting">Megbeszéltük a találkozót</option></Select></Field>
        <Field label="Megjegyzés (nem kötelező)" className="sm:col-span-2"><Textarea rows={1} placeholder="pl. most nyit, jövő héten ráér" /></Field>
      </div>
      <div className="mt-auto pt-4"><Button variant="yellow" icon={Send} loading={busy} onClick={onSubmit}>Bemutatom</Button></div>
    </Card>
  )
}

/** Az ajánló saját listája: kit hozott, mikor, hol tart, és a jutalék (10%) — csak a megkötött szerződés után. */
export function EarnList({ rows = SAMPLE_EARN, className = '' }: { rows?: EarnLead[]; className?: string }) {
  return (
    <Card className={className}>
      <CardTitle>Akiket bemutattál</CardTitle>
      {rows.length === 0 ? <div className="mt-3 rounded-ui-inner bg-ui-cell/60 px-4 py-8 text-center text-ui-body text-ui-muted">Itt még csend van — pedig biztos ismersz valakit, akinek a weboldala már rég megérett egy frissítésre. Mutasd be nekünk, és itt követheted, hol tart.</div> : (
        <Table minWidth={620} className="mt-2">
          <thead><tr><Th>Cég</Th><Th>Igény</Th><Th>Mikor</Th><Th>Hol tart</Th><Th>A jutalékod</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.key}>
              <Td><span className="flex items-center gap-2.5"><IconCircle tone="cell" size="sm">{r.company[0]}</IconCircle>{r.company}</span></Td>
              <Td className="text-ui-muted">{r.need}</Td>
              <Td className="text-ui-muted">{r.date}</Td>
              <Td><StatusPill status={EARN_STATUS[r.status].tone}>{EARN_STATUS[r.status].label}</StatusPill></Td>
              <Td className={r.status === 'paid' ? 'text-ui-text' : 'text-ui-muted'}>{r.contract && (r.status === 'signed' || r.status === 'paid') ? `${ft(Math.round(r.contract * EARN_RATE))}${r.status === 'paid' ? ` · kifizetve ${r.paidAt ?? ''}` : ' · hamarosan átutaljuk'}` : r.status === 'lost' ? '—' : 'amint megállapodunk'}</Td>
            </Tr>
          ))}</tbody>
        </Table>
      )}
    </Card>
  )
}

/** Backstage: az összes beérkezett ajánlás — ki hozta, kit, mire, állapot (választó), a szerződés összege (beírható),
 *  a jutalék (10%, magától), és a „Kifizetve” gomb a megkötött szerződésnél. */
export function EarnAdminTable({ rows = SAMPLE_EARN, className = '' }: { rows?: EarnLead[]; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Keress pénzt — ajánlások</CardTitle>
        <span className="flex gap-1.5"><Pill tone="cell" size="sm">4 aktív</Pill><Pill tone="yellow" size="sm">145 000 Ft kifizetésre vár</Pill></span>
      </div>
      <Table minWidth={900} className="mt-3">
        <thead><tr><Th>Ajánló</Th><Th>Cég · igény</Th><Th>Beérkezett</Th><Th>Állapot</Th><Th>Szerződés (nettó)</Th><Th>Jutalék 10%</Th><Th /></tr></thead>
        <tbody>{rows.map((r) => (
          <Tr key={r.key}>
            <Td>{r.referrer}</Td>
            <Td><span className="block">{r.company}</span><Meta className="text-ui-label">{r.need}</Meta></Td>
            <Td className="text-ui-muted">{r.date}</Td>
            <Td><Select size="sm" defaultValue={r.status}>{(Object.keys(EARN_STATUS) as EarnStatus[]).map((k) => <option key={k} value={k}>{EARN_STATUS[k].label}</option>)}</Select></Td>
            <Td>{r.status === 'signed' || r.status === 'paid' ? <Input defaultValue={String(r.contract ?? '')} className="w-[130px]" /> : <span className="text-ui-muted">—</span>}</Td>
            <Td>{r.contract && (r.status === 'signed' || r.status === 'paid') ? ft(Math.round(r.contract * EARN_RATE)) : <span className="text-ui-muted">—</span>}</Td>
            <Td>{r.status === 'signed' ? <Button size="sm" icon={Check}>Kifizetve</Button> : r.status === 'paid' ? <Meta>{r.paidAt}</Meta> : null}</Td>
          </Tr>
        ))}</tbody>
      </Table>
      <Meta className="mt-3 leading-relaxed">A jutalék csak a megkötött szerződés után jár. Kifizetés átutalással, az ajánló számlája alapján; a „Kifizetve” jelölésre az ajánló e-mailt kap, és az oldalán is látja.</Meta>
    </Card>
  )
}
