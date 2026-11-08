import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ArrowUpRight, Bold, Columns2, Gift, Globe2, Image as ImageIcon, Images, Italic, Link2, List, Minus, MousePointerClick, PanelsTopLeft, Pencil, Plus, Send, Store, Trash2, Type, Underline, Users, type LucideIcon } from 'lucide-react'
import { PeriodPicker } from './calendar'
import { autoTextColor, BASE_SIZE, blocksToHtml, coverOf, EMAIL_BG, EMAIL_TEXT, FONT_STACK, type BlockFont, type ColumnCell, type ComposerBlock } from '@/lib/emailBlocks'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'
import { t, type Locale } from '@/lib/i18n'
import { Editable, ImageSlot } from './letter-edit'
import { VoucherCard } from './money'
import { DarkLineChart, Legend, MiniBar, WeekBars } from './charts'
import { BIZ_LOGO, PoweredBy } from './brand'
import { Button, Card, CardTitle, FieldRow, IconButton, IconCircle, Input, ListRow, Meta, Meter, OptionCard, Pagination, Pill, RowCheck, SearchField, SegmentBar, Segmented, Select, StatusPill, Table, Td, Th, Tr, MarqueeText } from '@/components/ui-kit'

/* Marketing kártyái — a /design 13.4, 13.6 és a landing „Marketing” funkció-oldala is ezeket mutatja. */

/** 13.4: a kampány-levél előnézete — tárgy, Desktop / Mobil, a levél (borító, kijelölt szöveg-blokk, gomb, lábléc). */
export function CampaignEmailCard({ restaurant = false, className = '' }: { restaurant?: boolean; className?: string }) {
  return (
  <Card tone="white" pad="none" className={`flex flex-col overflow-hidden ${className}`}>
    <div className="flex items-center gap-2 border-b border-dashed border-ui-divider px-6 py-3.5">
      <Meta className="shrink-0">Tárgy:</Meta>
      <MarqueeText className="flex-1 text-ui-body text-ui-text">Téli nyitvatartás — ünnepek alatt is várunk</MarqueeText>
      <Segmented options={['Desktop', 'Mobil']} active={0} />
    </div>
    <div className="flex items-center gap-2 px-6 pt-5">
      {/* az üzlet beállított logója — a példa kedvéért a davelopment booking ikonja (mint az utalványon) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BIZ_LOGO} alt="" className="h-8 w-auto shrink-0" />
      <Meta>{restaurant ? 'Bistro Andrássy' : 'Fodrászat Budapest'}</Meta>
    </div>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/videos/szalon-foglalas-hatter-poster.jpg" alt="" className="mx-6 mt-4 h-[140px] w-[calc(100%-48px)] rounded-ui-inner object-cover" />
    <div className="relative mx-3 mt-3 px-3 py-3">
      <span className="pointer-events-none absolute inset-0 rounded-ui-control border-2 border-dashed border-ui-yellow" />
      <div className="text-ui-sub font-light text-ui-dark">Ünnepek alatt is várunk</div>
      <div className="mt-2 max-w-[560px] text-ui-body leading-loose text-ui-muted">December 23-ig minden nap nyitva vagyunk, 24–26. között zárva. Foglalj időben — a délutáni időpontok gyorsan betelnek.</div>
    </div>
    <div className="px-6 pt-2"><Button size="sm">{restaurant ? 'Asztalt foglalok' : 'Időpontot foglalok'}</Button></div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-ui-divider px-6 py-3">
      <Meta className="text-ui-label">Leiratkozás a hírlevélről · {restaurant ? 'Bistro Andrássy, Andrássy út 34.' : 'Fodrászat Budapest, Andrássy út 12.'}</Meta>
      <PoweredBy />
    </div>
  </Card>
  )
}

/** 13.6: kiküldött kampány eredménye — megnyitás-arány csík, szűrő, címzettenként megnyitva / nem. `mobile`: keskeny helyre
 *  (telefon, landing-kép, borító) — teljes szélességű váltó rövid feliratokkal, a lapozó felirat nélkül. */
export type RecipientRow = { key: string; name: string; meta: string; opened: boolean }
export function CampaignResults({ more, mobile = false, title = 'Őszi frissítés −15%', sentAt = 'Kiküldve Okt. 14. 10:00', opened = 239, total = 412, rows = ([['Kovács Anna', 'Okt. 14. 10:12', true], ['Tóth Bence', 'Okt. 14. 18:40', true], ['Gál Zsófia', '', false], ['Lukas Gruber', 'Okt. 15. 08:05', true]] as const).map(([n, t, o]) => ({ key: n, name: n, meta: o ? `megnyitotta ${t}` : 'még nem nyitotta meg', opened: o })), filter = 0, onFilter, query, onQuery, onCopy, page = 1, pages = 42, label = '1–10 / 412', onPage, className = '' }: { /** görgetésre töltés a lapozó előtt */ more?: React.ReactNode;
  mobile?: boolean; title?: string; sentAt?: string; opened?: number; total?: number; rows?: RecipientRow[]
  filter?: number; onFilter?: (i: number) => void; query?: string; onQuery?: (q: string) => void; onCopy?: () => void
  page?: number; pages?: number; label?: string; onPage?: (p: number) => void; className?: string
}) {
  const not = Math.max(0, total - opened)
  const pct = total ? Math.round((opened / total) * 100) : 0
  return (
  <Card className={className}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Meta>{sentAt}</Meta><div className="mt-1 text-ui-sub font-light text-ui-text">{title}</div></div>
      <Button variant="cell" size="sm" icon={Pencil} onClick={onCopy}>Másolat új kampányként</Button>
    </div>
    {/* 0% / 100%-nál egy szegmens (különben a két felirat egymásra csúszik, és egy üres sárga sáv is látszana) */}
    <SegmentBar joined className="mt-5" segments={pct <= 0 ? [{ label: `${opened} megnyitotta · ${not} nem nyitotta meg`, value: '', weight: 100, tone: 'muted' }]
      : pct >= 100 ? [{ label: `${opened} megnyitotta · 100%`, value: '', weight: 100, tone: 'yellow' }]
      : [
        { label: `${opened} megnyitotta · ${pct}%`, value: '', weight: Math.max(18, pct), tone: 'yellow' },
        { label: `${not} nem · ${100 - pct}%`, value: '', weight: Math.max(18, 100 - pct), tone: 'muted' },
      ]} />
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
      {mobile
        ? <Segmented full options={[`Mind · ${total}`, `Nyitva · ${opened}`, `Nem · ${not}`]} active={filter} onSelect={onFilter} />
        : <Segmented options={[`Mind · ${total}`, `Megnyitotta · ${opened}`, `Nem nyitotta · ${not}`]} active={filter} onSelect={onFilter} />}
      <SearchField className={mobile ? 'w-full' : 'w-[200px]'} value={query} onChange={onQuery}>Keresés</SearchField>
    </div>
    <div className="mt-2">
      {rows.length ? rows.map((r) => (
        <ListRow key={r.key} title={r.name} meta={r.meta} trailing={<StatusPill status={r.opened ? 'ok' : 'bad'}>{r.opened ? 'Megnyitotta' : 'Nem nyitotta meg'}</StatusPill>} />
      )) : <Meta className="px-3 py-6 text-center">Nincs ilyen címzett.</Meta>}
    </div>
    {more}
    {pages > 1 && <Pagination page={page} pages={pages} label={label} full={mobile} onPage={onPage} className="mt-3" />}
  </Card>
  )
}

/** 13.1, 13.6: nyitási arány (sötét kártya) az összes kampány átlagával. */
/** `avgSeries`: az átlag görbéje (szaggatott) — nélküle vízszintes vonal az `avg` értéken */
export function OpenRateCard({ pct = 58, series = [47, 52, 49, 61, 51, 58], avgSeries, avg = 54, ticks = ['Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.'], className = '' }: { pct?: number; series?: number[]; avgSeries?: number[]; avg?: number; ticks?: string[]; className?: string }) {
  const s2 = series.length > 1 ? series : [series[0] ?? 0, series[0] ?? 0]
  const a2 = avgSeries && avgSeries.length === s2.length ? avgSeries : s2.map(() => avg)
  const lo = Math.max(0, Math.min(...s2, ...a2) - 10), hi = Math.min(100, Math.max(...s2, ...a2) + 10)
  return (
  <Card tone="dark" className={className}>
    <div className="flex items-start justify-between gap-3">
      <span><Meta dark>Nyitási arány</Meta><div className="mt-1 text-ui-page font-light leading-none">{pct}%</div></span>
      <Legend dark items={[['bg-ui-yellow', 'Kampány'], ['bg-white/40', 'Átlag']]} />
    </div>
    {/* az utolsó kampányok nyitási aránya, szaggatottal az összes kampány átlaga */}
    <DarkLineChart now={s2} prev={a2} sel={s2.length - 1} min={lo} max={hi} h={80} label={`${pct}%`} ticks={ticks} selTick={ticks.length - 1} />
    <Meta dark className="mt-3">Az összes kampányod átlaga: {avg}%</Meta>
  </Card>
  )
}

/* ── 13.1–13.5: a Kampányok fül darabjai (az élő MarketingView és a design oldal is ezeket rendereli) ── */

export type CampaignItem = { id: string; title: string; status: 'sent' | 'scheduled' | 'draft' | 'auto'; when: string; stats?: [string, string, number][]; note?: string }
const C_STATUS = { sent: 'Kiküldve', scheduled: 'Ütemezve', draft: 'Piszkozat', auto: 'Automatikus' } as const
const SAMPLE_CAMPAIGNS: CampaignItem[] = [
  { id: 'a', title: 'Őszi frissítés −15%', status: 'sent', when: 'Okt. 14. 10:00 · 412 címzett', stats: [['Megnyitás', '58%', 58], ['Kattintás', '14%', 14], ['Foglalás', '23', 46]] },
  { id: 'b', title: 'Advent: utalvány', status: 'scheduled', when: 'Nov. 28. 09:00 · 418 címzett', note: 'Még 26 nap · Feliratkozottak' },
  { id: 'c', title: 'Új munkatárs: Szabina', status: 'sent', when: 'Szept. 2. 09:30 · 398 címzett', stats: [['Megnyitás', '61%', 61], ['Kattintás', '9%', 9], ['Foglalás', '11', 22]] },
  { id: 'd', title: 'Téli nyitvatartás', status: 'draft', when: 'Szerkesztve tegnap', note: 'Még nincs címzett kiválasztva' },
]

/** A kampányok listája: kártyánként a lényeg — kiküldöttnél megnyitás / kattintás / foglalás mini-sávval, ütemezettnél mikor
 *  és kinek, piszkozatnál mikor szerkesztették. A kijelölt sárga. `mobile`: a lapozó felirat nélkül. */
export function CampaignList({ more, items = SAMPLE_CAMPAIGNS, openId = 'a', onOpen, page = 1, pages = 2, label = '1–5 / 6', onPage, mobile = false, empty }: { /** görgetésre töltés a lapozó előtt (LoadMoreSentinel) */ more?: React.ReactNode;
  items?: CampaignItem[]; openId?: string | null; onOpen?: (id: string) => void
  page?: number; pages?: number; label?: string; onPage?: (p: number) => void; mobile?: boolean; empty?: React.ReactNode
}) {
  return (
    <>
      {items.length === 0 && empty}
      {items.map((c) => {
        const on = c.id === openId
        const body = (
          <>
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-ui-body font-medium leading-snug">{c.title || '(tárgy nélkül)'}</span>
              <Pill size="sm" tone={on ? 'white' : c.status === 'scheduled' ? 'yellow' : c.status === 'auto' ? 'dark' : 'cell'} className="shrink-0">{C_STATUS[c.status]}</Pill>
            </div>
            <div className="mt-0.5 text-ui-label text-ui-muted">{c.when}</div>
            {c.stats && (
              <div className="mt-2.5 grid grid-cols-3 gap-3">
                {c.stats.map(([k, v, pct]) => (
                  <span key={k} className="min-w-0">
                    <span className="block text-ui-body leading-none text-ui-text">{v}</span>
                    <MarqueeText className="mt-1 text-ui-label text-ui-muted">{k}</MarqueeText>
                    <MiniBar pct={pct} tone={on ? 'dark' : 'yellow'} className="mt-1.5" />
                  </span>
                ))}
              </div>
            )}
            {c.note && <div className="mt-2 border-t border-dashed border-ui-divider pt-2 text-ui-label text-ui-text">{c.note}</div>}
          </>
        )
        const cls = `mb-1 block w-full rounded-ui-inner p-3 text-left text-ui-text ${on ? 'bg-ui-yellow' : 'bg-white/70'}`
        return onOpen ? <button key={c.id} type="button" onClick={() => onOpen(c.id)} className={`${cls} ui-press outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button> : <div key={c.id} className={cls}>{body}</div>
      })}
      {more}
      {items.length > 0 && <Pagination page={page} pages={pages} label={label} full={mobile} onPage={onPage} className="mt-auto px-1 pt-3" />}
    </>
  )
}

/** a levél fejléce / lábléce: az üzlet neve, logója, címe; `social`: a beállított közösségi linkek (a Közösségi blokk alapja) */
export type LetterBiz = { name: string; logo?: string | null; /** az ikon — a „Logó” blokkban választható a logó helyett (design 24.2) */ icon?: string | null; footer?: string | null; social?: string[] }

/** A levél-blokkok írás-módja: a kijelölt blokk (sárga szaggatott keret + kis sötét eszköztár), a módosítás, mozgatás,
 *  törlés; `onStyle` (mobil: a ceruza a stílus-lapot nyitja), `onInsert` (mobil: sárga + a blokk alatt). Callback nélkül
 *  (design) csak a kijelölés látszik. */
export type LetterEdit = {
  selectedId: string | null
  onSelect?: (id: string) => void
  onChange?: (blocks: ComposerBlock[]) => void
  onMove?: (id: string, dir: -1 | 1) => void
  onRemove?: (id: string) => void
  onStyle?: (id: string) => void
  onInsert?: (id: string) => void
  /** mobil: a kis eszköztár ceruzával és a sárga beszúrás-+ */
  tools?: boolean
}

const S = (id: string) => `s-${id}`
/** A design mintalevele adatként (13.1 kiküldött / 13.4 írás-mód) — ugyanaz a rajzoló rajzolja, mint az élő levelet. */
export const sampleLetter = (r = false, edit = false): ComposerBlock[] => [
  { id: S('img'), type: 'image', url: '/landing/teamsection/munkatarsak-davelopment-booking.jpg', alt: '' },
  { id: S('t'), type: 'title', html: edit ? (r ? 'Ünnepi nyitvatartás és szilveszteri menü' : 'Téli nyitvatartás — ünnepek alatt is várunk') : r ? 'Őszi menü: vadételek a hétvégén' : 'Őszi frissítés: −15% minden festésre' },
  { id: S('p'), type: 'text', html: edit ? (r ? 'Kedves Anna! December 24–26. között zárva, szilveszterkor ötfogásos menüvel várunk.' : 'Kedves Anna! December 23-ig minden nap nyitva vagyunk, 24–26. között zárva. Foglalj időben!') : r ? 'Kedves Anna! Péntektől vasárnapig szarvasragu, vaddisznó-pecsenye és erdei gombás rizottó vár.' : 'Kedves Anna! Októberben minden festéshez és balayage-hoz 15% kedvezményt adunk.' },
  { id: S('ul'), type: 'bullet_list', html: (r ? ['Szarvasragu házi nokedlivel', 'Vaddisznó-pecsenye birsalmával', 'Erdei gombás rizottó'] : ['Minden festés és balayage −15%', 'Októberben hétvégén is nyitva', 'A kedvezmény ajándékutalványra is jár']).map((x) => `<li>${x}</li>`).join('') },
  { id: S('o'), type: 'offers', items: r ? [{ name: 'Vadtál két főre', was: '18 900 Ft', now: '16 500 Ft' }, { name: 'Borpárosítás', was: '6 900 Ft', now: '5 900 Ft' }] : [{ name: 'Balayage + vágás', was: '48 000 Ft', now: '40 800 Ft' }, { name: 'Tőfestés', was: '22 000 Ft', now: '18 700 Ft' }] },
  { id: S('b'), type: 'button', label: r ? 'Asztalt foglalok' : 'Időpontot foglalok', url: '', width: 'full' },
  { id: S('hr'), type: 'divider' },
  { id: S('v'), type: 'voucher', amount: r ? '24 000 Ft' : '20 000 Ft', title: `Ajándék ${r ? 'vacsora' : 'szépség'} — karácsonyra`, text: 'Online megveszed, e-mailben megy.', label: 'Utalványt veszek', url: '' },
]

type Styled = { type?: string; bg?: string | null; color?: string | null; font?: BlockFont; fontSize?: number; align?: string }
/** a szöveg-blokk saját stílusa — ugyanazok a méretek és színek, mint a kiküldött levélben (`emailBlocks`) */
const textStyle = (b: Styled): React.CSSProperties => ({
  background: b.bg ?? undefined, color: b.color ?? autoTextColor(b.bg) ?? undefined, fontFamily: b.font ? FONT_STACK[b.font] ?? undefined : undefined,
  fontSize: `${b.fontSize ?? BASE_SIZE[b.type ?? 'text'] ?? 14}px`, textAlign: b.align === 'center' ? 'center' : b.align === 'right' ? 'right' : undefined,
}) // ui-allow: a levél blokkjainak saját stílusa (adat)
/** háttérszínes szöveg-blokk: belső térköz és lekerekítés (mint a levélben) */
const filled = (b: Styled) => (b.bg ? 'rounded-ui-control px-3.5 py-2.5' : '')
const JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' } as const
const just = (a?: string) => JUSTIFY[a === 'center' || a === 'right' ? a : 'left']
/** minden blokk ugyanazzal a térközzel ül a levélben (vízszintesen a levél széle, függőlegesen a blokkok között) —
 *  a kijelölő keret így mindig körbeéri a tartalmat; a teljes szélességű kép széltől szélig ér */
const blockPad = (b: ComposerBlock) => (b.type === 'image' && (!b.width || b.width === 'full') ? '' : 'px-5 py-2.5')
const GAP = 'gap-2.5'
/** a logó magassága — ugyanaz, mint a levélben (`LOGO_HEIGHT`: 36 / 52 / 72 px) */
const LOGO_H = { sm: 'h-9', md: 'h-[52px]', full: 'h-[72px]' } as const

/** A levél blokkjai a design 13.1 markupjával: borító, cím + szöveg, felsorolás (sárga pötty), két ajánlat árral, gomb,
 *  elválasztó, utalvány-blokk, képek egymás mellett, közösségi ikonok. `edit`: írás-mód (helyben szerkeszthető,
 *  kijelölhető). `compact`: keskeny hely (mobil). */
/** `cover`: az első (fő) képre kerülő réteg — az üzlet logója és neve */
export function LetterBlocks({ blocks, restaurant = false, compact = false, edit, cover }: { blocks: ComposerBlock[]; restaurant?: boolean; compact?: boolean; edit?: LetterEdit; cover?: React.ReactNode }) {
  const live = !!edit?.onChange
  const set = (id: string, p: Record<string, unknown>) => edit?.onChange?.(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as ComposerBlock) : b)))
  const body = (b: ComposerBlock) => {
    switch (b.type) {
      case 'image': {
        // logó: a magassága a méret (kicsi / közepes / nagy), a szélessége a saját arányából
        if (b.kind === 'logo') {
          const h = LOGO_H[b.width ?? 'md']
          return (
            <div className={`flex ${just(b.align ?? 'center')}`}>
              {live ? (b.url ? <ImageSlot fit url={b.url} onChange={(url) => set(b.id, { url })} className={h} /> : <div className="w-[30%]"><ImageSlot url="" onChange={(url) => set(b.id, { url })} className="h-[72px] rounded-ui-control" /></div>)
                // eslint-disable-next-line @next/next/no-img-element
                : b.url ? <img src={b.url} alt={b.alt} className={`w-auto max-w-[60%] object-contain ${h}`} /> : null}
            </div>
          )
        }
        // teljes szélesség: borítókép; kicsi (logó) / közepes: igazítható, a kép a saját arányában
        if (!b.width || b.width === 'full') return live ? <ImageSlot url={b.url} onChange={(url) => set(b.id, { url })} className={compact ? 'h-[120px]' : 'h-[220px]'} />
          // eslint-disable-next-line @next/next/no-img-element
          // a kiküldött levélben a kép a saját arányában, vágás nélkül jelenik meg — az előnézet is így (a fix magasság +
          // object-cover egy logót / feliratos képet felnagyítva levágott)
          : b.url ? <img src={b.url} alt={b.alt} className="h-auto w-full" /> : null
        return (
          <div className={`flex ${just(b.align)}`}>
            <div className={b.width === 'sm' ? 'w-[18%] min-w-[64px]' : 'w-1/2'}>
              {live ? <ImageSlot url={b.url} onChange={(url) => set(b.id, { url })} className={`rounded-ui-control ${b.url ? 'h-auto' : 'h-[72px]'}`} />
                // eslint-disable-next-line @next/next/no-img-element
                : b.url ? <img src={b.url} alt={b.alt} className="h-auto w-full rounded-ui-control" /> : null}
            </div>
          </div>
        )
      }
      case 'columns': {
        // képek egymás mellett (2–3); az üres cella írás-módban kép-hely
        const putCell = (j: number, c: ColumnCell) => set(b.id, { cols: b.cols.map((x, n) => (n === j ? c : x)) })
        const h = compact ? 'h-[90px]' : 'h-[140px]'
        return (
          <div className={`grid ${GAP} ${b.cols.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {b.cols.map((c, j) => (
              <div key={j} className="min-w-0">
                {c.type === 'image' || c.type === 'empty'
                  ? live ? <ImageSlot url={c.type === 'image' ? c.url : ''} onChange={(url) => putCell(j, { type: 'image', url, alt: c.type === 'image' ? c.alt : '' })} className={`rounded-ui-control ${h}`} />
                    // eslint-disable-next-line @next/next/no-img-element
                    : c.type === 'image' && c.url ? <img src={c.url} alt={c.alt} className={`w-full rounded-ui-control object-cover ${h}`} /> : null
                  : c.type === 'button' ? <Button size="sm" className="w-full">{c.label}</Button>
                  : <div className="text-ui-meta text-ui-text" dangerouslySetInnerHTML={{ __html: c.html }} />}
              </div>
            ))}
          </div>
        )
      }
      case 'social_links': {
        const links = b.links.filter((l) => l.url.trim())
        return (
          <div className={`flex flex-wrap ${GAP} ${just(b.align ?? 'center')}`}>
            {links.length ? links.map((l, j) => {
              const p = detectPlatform(l.url)
              // eslint-disable-next-line @next/next/no-img-element
              return <img key={j} src={socialIconDataUri(p)} alt={SOCIAL_LABELS[p]} title={SOCIAL_LABELS[p]} className="h-9 w-9 rounded-full" />
            }) : live ? <Meta className="text-ui-label">Add meg a közösségi linkeket a blokk beállításainál.</Meta> : null}
          </div>
        )
      }
      case 'title': case 'subtitle': case 'heading': {
        const cls = `${b.type === 'heading' ? 'font-medium' : 'font-light'} leading-tight text-ui-dark ${filled(b)}`
        return live ? <Editable html={b.html} onChange={(html) => set(b.id, { html })} placeholder="Cím…" className={cls} style={textStyle(b)} /> : <div className={cls} style={textStyle(b)} dangerouslySetInnerHTML={{ __html: b.html }} />
      }
      case 'text': {
        const cls = `leading-relaxed text-ui-muted ${filled(b)}`
        return live ? <Editable html={b.html} onChange={(html) => set(b.id, { html })} placeholder="Írj egy bekezdést… ({keresztnév})" className={cls} style={textStyle(b)} /> : <p className={cls} style={textStyle(b)} dangerouslySetInnerHTML={{ __html: b.html }} />
      }
      case 'bullet_list': case 'numbered_list': {
        const cls = `space-y-1.5 text-ui-text [&_li]:relative [&_li]:pl-4 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.55em] [&_li]:before:h-1.5 [&_li]:before:w-1.5 [&_li]:before:rounded-full [&_li]:before:bg-ui-yellow [&_li]:before:content-[''] ${filled(b)}`
        return live ? <Editable list html={b.html} onChange={(html) => set(b.id, { html })} className={cls} style={textStyle(b)} /> : <ul className={cls} style={textStyle(b)} dangerouslySetInnerHTML={{ __html: b.html }} />
      }
      case 'offers':
        return (
          <div className={`grid ${GAP} ${compact ? '' : 'grid-cols-2'}`}>
            {b.items.map((o, j) => {
              const put = (k: 'name' | 'was' | 'now', v: string) => set(b.id, { items: b.items.map((x, n) => (n === j ? { ...x, [k]: v } : x)) })
              return (
                <Card key={j} tone="cell" inner pad="sm">
                  {live ? <input value={o.name} onChange={(e) => put('name', e.target.value)} placeholder="Ajánlat neve" className="w-full bg-transparent text-ui-meta text-ui-text outline-none placeholder:text-ui-muted" /> : <div className="text-ui-meta text-ui-text">{o.name}</div>}
                  <div className="mt-1 flex items-baseline gap-1.5">
                    {live ? <><input value={o.now} onChange={(e) => put('now', e.target.value)} placeholder="Új ár" className="w-1/2 min-w-0 bg-transparent text-ui-title font-light text-ui-text outline-none placeholder:text-ui-muted" /><input value={o.was} onChange={(e) => put('was', e.target.value)} placeholder="Régi ár" className="w-1/2 min-w-0 bg-transparent text-ui-label text-ui-muted line-through outline-none" /></>
                      : <><span className="text-ui-title font-light text-ui-text">{o.now}</span>{o.was && <span className="text-ui-label text-ui-muted line-through">{o.was}</span>}</>}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      case 'button': {
        // írás-módban a felirat és a link a Kijelölt blokk kártyán (a gomb itt csak megjelenik)
        // a márka alap gombmérete (kit Button md: 44 px, 13 px) — a kiküldött levélben is ez
        const btnStyle: React.CSSProperties | undefined = b.bg ? { background: b.bg, color: b.color ?? autoTextColor(b.bg) ?? undefined } : b.color ? { color: b.color } : undefined // ui-allow: a gomb saját színe (adat)
        return <div className={`flex ${just(b.align)}`}><Button className={`${b.width === 'full' ? 'w-full' : ''} ${live ? 'pointer-events-none' : ''}`} style={btnStyle} href={!live && b.url && !b.url.startsWith('{{') ? b.url : undefined}>{b.label || (restaurant ? 'Asztalt foglalok' : 'Időpontot foglalok')}</Button></div>
      }
      case 'button_row':
        // gombsor: a gombok egymás mellett; a feliratuk / linkjük / színük a Kijelölt blokk kártyán
        return (
          <div className={`flex flex-wrap gap-2 ${just(b.align)}`}>
            {b.items.map((it, j) => {
              const st: React.CSSProperties | undefined = it.bg ? { background: it.bg, color: it.color ?? autoTextColor(it.bg) ?? undefined } : it.color ? { color: it.color } : undefined // ui-allow: a gomb saját színe (adat)
              return <Button key={j} style={st} className={live ? 'pointer-events-none' : ''} href={!live && it.url && !it.url.startsWith('{{') ? it.url : undefined}>{it.label || 'Gomb'}</Button>
            })}
          </div>
        )
      case 'booking_details': {
        // a foglalás adatai: a tartalmat a rendszer tölti (itt minta), csak a stílusa állítható — mint egy gombé
        const bg = b.bg ?? undefined
        const fg = b.color ?? autoTextColor(b.bg) ?? undefined
        const boxStyle: React.CSSProperties = { background: bg, color: fg } // ui-allow: a blokk saját színe (adat)
        return (
          <div className={`flex ${just(b.align)}`}>
            <div className={`rounded-ui-inner px-4 py-3 ${b.bg ? '' : 'bg-ui-cell'} ${b.width === 'full' ? 'w-full' : ''} ${b.align === 'center' ? 'text-center' : b.align === 'right' ? 'text-right' : ''}`} style={boxStyle}>
              <div className={`text-ui-body ${fg ? '' : 'text-ui-text'}`}>{restaurant ? 'Péntek, Nov. 14. · 19:00 – 21:00' : 'Hétfő, Nov. 10. · 13:30 – 14:30'}</div>
              <div className={`text-ui-meta ${fg ? 'opacity-70' : 'text-ui-muted'}`}>{restaurant ? '4 fő' : 'Hajvágás · Viktória'}</div>
            </div>
          </div>
        )
      }
      case 'divider':
        return <div className="border-t border-dashed border-ui-divider" />
      case 'voucher':
        return (
          <div className={`flex ${GAP} ${compact ? 'flex-col' : 'items-center'}`}>
            <div className={compact ? 'w-full' : 'w-[150px] shrink-0'}><VoucherCard small amount={b.amount} bg="yellow" restaurant={restaurant} /></div>
            <div className="min-w-0 flex-1">
              {live ? <>
                <input value={b.title} onChange={(e) => set(b.id, { title: e.target.value })} placeholder="Cím" className="w-full bg-transparent text-ui-body text-ui-text outline-none" />
                <input value={b.text} onChange={(e) => set(b.id, { text: e.target.value })} placeholder="Rövid szöveg" className="mt-0.5 w-full bg-transparent text-ui-label text-ui-muted outline-none" />
                <input value={b.amount} onChange={(e) => set(b.id, { amount: e.target.value })} placeholder="Összeg" className="mt-0.5 w-full bg-transparent text-ui-label text-ui-muted outline-none" />
              </> : <><div className="text-ui-body text-ui-text">{b.title}</div><div className="mt-0.5 text-ui-label text-ui-muted">{b.text}</div></>}
              <Button size="sm" variant="cell" className={`mt-2 ${live ? 'pointer-events-none' : ''}`} icon={Gift} href={!live && b.url ? b.url : undefined}>{b.label || 'Utalványt veszek'}</Button>
            </div>
          </div>
        )
      case 'section':
        return <div className="rounded-ui-inner bg-ui-cell p-4 text-ui-meta text-ui-text" dangerouslySetInnerHTML={{ __html: b.html }} />
      case 'html':
        return <div className="text-ui-meta" dangerouslySetInnerHTML={{ __html: b.code }} />
      default:
        return <div className="text-ui-meta text-ui-text" dangerouslySetInnerHTML={{ __html: blocksToHtml([b]) }} />
    }
  }
  return (
    <div className="pb-2.5">
      {blocks.map((b, i) => {
        const node = <div className={`relative ${blockPad(b)}`}>{body(b)}{i === 0 && cover}</div>
        if (!edit) return <div key={b.id}>{node}</div>
        const on = edit.selectedId === b.id
        return (
          <div key={b.id} data-block-id={b.id} onClick={edit.onSelect ? () => edit.onSelect!(b.id) : undefined} className="relative">
            {/* a keret a blokk térközén belül fut — a tartalom mindig benne van */}
            {on && <span className="pointer-events-none absolute inset-x-2 inset-y-0.5 z-[1] rounded-ui-control border-2 border-dashed border-ui-yellow" />}
            {/* a kijelölt blokkon kis eszköztár — fel, le, (mobil: szerkesztés), törlés */}
            {on && (
              // az első blokknál a levél keretén belül (különben a lekerekített levél levágja), a többinél a blokk szélén
              <span className={`absolute right-3 z-10 flex gap-0.5 rounded-full bg-ui-dark p-0.5 ${i === 0 ? 'top-2' : '-top-4'}`} onClick={live ? (e) => e.stopPropagation() : undefined}>
                <IconButton icon={ArrowUp} label="Feljebb" variant="onDark" size="sm" onClick={edit.onMove ? () => edit.onMove!(b.id, -1) : undefined} />
                <IconButton icon={ArrowDown} label="Lejjebb" variant="onDark" size="sm" onClick={edit.onMove ? () => edit.onMove!(b.id, 1) : undefined} />
                {edit.tools && <IconButton icon={Pencil} label="Szerkesztés" variant="onDark" size="sm" onClick={edit.onStyle ? () => edit.onStyle!(b.id) : undefined} />}
                {/* a foglalás adatai (vendég-levél) kötelező — nem törölhető, csak mozgatható */}
                {b.type !== 'booking_details' && <IconButton icon={Trash2} label="Törlés" variant="onDark" size="sm" className="text-ui-bad" onClick={edit.onRemove ? () => edit.onRemove!(b.id) : undefined} />}
              </span>
            )}
            {node}
            {on && edit.tools && <div className="flex items-center gap-2 px-5 pb-3" onClick={live ? (e) => e.stopPropagation() : undefined}><span className="h-px flex-1 border-t border-dashed border-ui-divider" /><IconButton icon={Plus} label="Blokk beszúrása ide" variant="yellow" size="sm" onClick={edit.onInsert ? () => edit.onInsert!(b.id) : undefined} /><span className="h-px flex-1 border-t border-dashed border-ui-divider" /></div>}
          </div>
        )
      })}
    </div>
  )
}

/** A kampány-levél keretben: fejléc logóval, a blokkok (`LetterBlocks`), sötét lábléc a címmel és a leiratkozással.
 *  Élőben `blocks` (kiküldöttnél csak megtekintés, írás-módban `edit`); props nélkül a design mintalevele. `edit` +
 *  `tools` a mintán: a kijelölés látszik (design 13.4 / 13.7). */
export function CampaignLetter({ biz, blocks, editState, restaurant = false, edit = false, compact = false, tools = false, locale = 'hu', className = '' }: {
  biz?: LetterBiz; blocks?: ComposerBlock[]; editState?: LetterEdit; restaurant?: boolean; edit?: boolean; compact?: boolean; tools?: boolean; /** a levél nyelve (a lábléc szövege) */ locale?: Locale; className?: string
}) {
  const r = restaurant
  const b: LetterBiz = biz ?? { name: r ? 'Bistro Andrássy' : 'Fodrászat Budapest', logo: BIZ_LOGO, footer: r ? 'Andrássy út 34. · +36 1 765 4321' : 'Andrássy út 12. · +36 1 234 5678' }
  const list = blocks ?? sampleLetter(r, edit)
  const ed = editState ?? (edit ? { selectedId: S('t'), tools } : undefined)
  const cover = coverOf(list).cover
  return (
    <div className={`flex w-full flex-1 flex-col overflow-hidden rounded-ui-inner bg-white shadow-ui-popup ${className}`}>
      {/* az üzlet logója és neve a fő képen (ha a levél teljes szélességű képpel kezdődik), különben egy sor felül */}
      {!cover && (
        <div className="flex items-center gap-2 border-b border-dashed border-ui-divider px-5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.logo && <img src={b.logo} alt="" className="h-7 w-auto shrink-0" />}
          <span className="text-ui-meta text-ui-muted">{b.name}</span>
        </div>
      )}
      <LetterBlocks blocks={list} restaurant={r} compact={compact} edit={ed} cover={cover ? (
        <span className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-center gap-2 px-5 pb-4 pt-10 ${cover.url ? 'bg-gradient-to-t from-ui-dark/60 to-transparent text-white' : 'text-ui-text'}`}>
          {/* a logó a saját formájában, lekerekített sarokkal (mint a referencián) — háttér / keret nélkül */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.logo && <img src={b.logo} alt="" className="h-10 w-auto max-w-[140px] shrink-0 object-contain" />}
          <span className="text-ui-row">{b.name}</span>
        </span>
      ) : undefined} />
      <div className="mt-auto bg-ui-dark px-5 py-4 text-ui-label text-white/55">
        <div className="text-white">{b.name}{b.footer ? ` · ${b.footer}` : ''}</div>
        <div className="mt-1">{t(locale, 'marketing.unsubscribe')}</div>
        <PoweredBy dark className="mt-3" />
      </div>
    </div>
  )
}

/** Kiküldött kampány: a félkör-mérő (megnyitás), kattintás és foglalás belőle. */
export function CampaignGauge({ title = 'Őszi frissítés', open = 58, click = 14, booked = 23, restaurant = false }: { title?: string; open?: number; click?: number; booked?: number; restaurant?: boolean }) {
  return (
    <Card className="flex flex-col items-center">
      <MarqueeText className="self-start text-ui-row text-ui-text">{title}</MarqueeText>
      <svg viewBox="0 0 200 110" className="mt-2 w-[170px]">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--ui-cell)" strokeWidth="18" strokeLinecap="round" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--ui-yellow)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${(open / 100) * Math.PI * 80} ${Math.PI * 80}`} />
      </svg>
      <div className="-mt-10 text-center"><div className="text-ui-num font-light leading-none text-ui-text">{open}%</div><div className="text-ui-label text-ui-muted">megnyitás</div></div>
      <div className="mt-3 grid w-full grid-cols-2 gap-1.5 text-center">
        <div className="rounded-ui-control bg-white/70 py-2"><div className="text-ui-title font-light text-ui-text">{click}%</div><div className="text-ui-label text-ui-muted">kattintás</div></div>
        <div className="rounded-ui-control bg-ui-dark py-2 text-white"><div className="text-ui-title font-light">{booked}</div><div className="text-ui-label text-white/55">{restaurant ? 'asztalfoglalás belőle' : 'foglalás belőle'}</div></div>
      </div>
    </Card>
  )
}

export type CampaignDetailsVM = { opened: number; perDay: { d: string; v: number }[]; links: { label: string; n: number }[]; audience: string; recipients: number; unsubscribed: number; notOpened: number; newSince: number }
const SAMPLE_DETAILS: CampaignDetailsVM = { opened: 239, perDay: [['K', 142], ['Sze', 51], ['Cs', 22], ['P', 12], ['Szo', 7], ['V', 5]].map(([d, v]) => ({ d: d as string, v: v as number })), links: [{ label: 'Időpontot foglalok', n: 41 }, { label: 'Árlista', n: 12 }, { label: 'Instagram', n: 4 }], audience: 'Feliratkozottak', recipients: 412, unsubscribed: 2, notOpened: 173, newSince: 6 }

/** Kiküldött kampány részletei: megnyitások naponta, mire kattintottak, kinek ment ki, leiratkozók, és a „Küldd el újra”
 *  (akik nem nyitották meg / az azóta feliratkozottak) meg a Másolat új kampányként. */
export function CampaignDetails({ d = SAMPLE_DETAILS, onRecipients, onResendNotOpened, onResendNew, onCopy }: { d?: CampaignDetailsVM; onRecipients?: () => void; onResendNotOpened?: () => void; onResendNew?: () => void; onCopy?: () => void }) {
  const live = !!onCopy
  const maxDay = Math.max(...d.perDay.map((x) => x.v), 0)
  const maxLink = Math.max(1, ...d.links.map((l) => l.n))
  return (
    <Card>
      <CardTitle>Részletek</CardTitle>
      <div className="mt-3">
        <div className="flex items-baseline justify-between"><span className="text-ui-label text-ui-muted">Megnyitások naponta</span><span className="text-ui-label text-ui-text">{d.opened} fő</span></div>
        <WeekBars className="mt-2" h={40} tag={(v) => `${v}`} days={d.perDay.map((x) => ({ d: x.d, v: x.v, peak: x.v > 0 && x.v === maxDay }))} />
        <div className="mt-3 border-t border-dashed border-ui-divider pt-2.5">
          <div className="text-ui-label text-ui-muted">Mire kattintottak</div>
          {d.links.length ? d.links.map((l) => (
            <div key={l.label} className="mt-1.5">
              <div className="flex justify-between gap-2 text-ui-label"><MarqueeText className="text-ui-text">{l.label}</MarqueeText><span className="text-ui-muted">{l.n}</span></div>
              <MiniBar pct={Math.round((l.n / maxLink) * 100)} tone="dark" className="mt-1" />
            </div>
          )) : <Meta className="mt-1.5 text-ui-label">Még senki nem kattintott.</Meta>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-ui-divider pt-2.5 text-ui-label"><span className="text-ui-muted">Kinek ment ki</span><span className="text-right text-ui-text">{d.audience}</span></div>
        <Button variant="glass" size="sm" icon={ArrowUpRight} className="mt-2 w-full" onClick={onRecipients}>Címzettek listája · {d.recipients}</Button>
        <div className="mt-1.5 flex items-center justify-between text-ui-label"><span className="text-ui-muted">Leiratkozott</span><span className="text-ui-text">{d.unsubscribed} fő</span></div>
        <div className="mt-3 border-t border-dashed border-ui-divider pt-3">
          <div className="text-ui-label text-ui-muted">Küldd el újra</div>
          <div className="mt-2 flex flex-col gap-1.5">
            <Button icon={Send} onClick={onResendNotOpened} disabled={live && (!onResendNotOpened || !d.notOpened)}>Akik nem nyitották meg · {d.notOpened}</Button>
            <Button variant="cell" icon={Users} onClick={onResendNew} disabled={live && (!onResendNew || !d.newSince)}>Az azóta feliratkozottak · {d.newSince}</Button>
            <Button variant="glass" icon={Pencil} onClick={onCopy}>Másolat új kampányként</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Írás-mód: kinek megy (szegmens-pillek, címzett-szám); a „Címzettek kiválasztása” a 13.5 ablakot nyitja. */
export function CampaignAudience({ segments = [['all', 'Feliratkozottak', true], ['regular', 'Törzsvendégek', true], ['lapsed', '90 napja nem járt', false], ['birthday', 'Szülinaposok', false]].map(([k, l, on]) => ({ key: k as string, label: l as string, on: on as boolean })), count = 412, onToggle, onPick, picked = 0 }: { segments?: { key: string; label: string; on: boolean }[]; count?: number | null; onToggle?: (key: string) => void; onPick?: () => void; picked?: number }) {
  return (
    <Card>
      <div className="text-ui-row text-ui-text">Kinek megy</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {segments.map((s) => {
          const pill = <Pill tone={s.on ? 'dark' : 'glass'}>{s.label}</Pill>
          return onToggle ? <button key={s.key} type="button" aria-pressed={s.on} onClick={() => onToggle(s.key)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button> : <span key={s.key}>{pill}</span>
        })}
      </div>
      {onPick && <Button variant="cell" size="sm" icon={Users} className="mt-3" onClick={onPick}>{picked ? `${picked} kijelölt vendég` : 'Címzettek kiválasztása'}</Button>}
      <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-ui-divider pt-3"><span className="text-ui-meta text-ui-muted">Címzett</span><span className="text-ui-sub font-light text-ui-text">{count == null ? '…' : count.toLocaleString('hu-HU')}</span></div>
    </Card>
  )
}

/** Írás-mód: küldés — havi keret, mikor (most / ütemezve: a nap a kit naptárával, az idő a kit időválasztójával),
 *  Küldés / Mentés vázlatként. `dateField` / `timeField`: az élő mezők; nélkülük (design) a minta értéke. */
export function CampaignSend({ used = 3612, cap = 5000, tier = 'Pro', count = 412, when = 0, onWhen, dateField, timeField, onSend, onDraft, onDiscard, busy = false, draftBusy = false, disabled = false }: { used?: number; cap?: number; tier?: string; count?: number; when?: number; onWhen?: (i: number) => void; dateField?: React.ReactNode; timeField?: React.ReactNode; onSend?: () => void; onDraft?: () => void; /** élőben: a piszkozat elvetése (csak mentett piszkozatnál) */ onDiscard?: () => void; busy?: boolean; draftBusy?: boolean; disabled?: boolean }) {
  const after = used + count
  return (
    <Card className="flex flex-col">
      <CardTitle>Küldés</CardTitle>
      <Meter label="Havi keret" value={used} max={cap} className="mt-3" />
      <Meta className={`mt-1.5 text-ui-label ${after > cap ? 'text-ui-bad' : ''}`}>Ezzel {after.toLocaleString('hu-HU')} / {cap.toLocaleString('hu-HU')} — {tier} csomag.</Meta>
      <FieldRow label="Mikor" className="mt-2"><Segmented tone="cell" size="sm" options={['Most', 'Ütemezve']} active={when} onSelect={onWhen} /></FieldRow>
      {when === 1 && (
        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_96px] gap-1.5">
          {dateField ?? <Input size="sm" value="Nov. 28." readOnly aria-label="Nap" />}
          {timeField ?? <Input size="sm" value="09:00" readOnly aria-label="Idő" />}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1.5">
        <Button icon={Send} onClick={onSend} loading={busy} disabled={disabled || after > cap}>{when === 1 ? `Ütemezés · ${count.toLocaleString('hu-HU')} fő` : `Küldés ${count.toLocaleString('hu-HU')} főnek`}</Button>
        <Button variant="cell" onClick={onDraft} loading={draftBusy}>Mentés vázlatként</Button>
        {onDiscard && <Button variant="ghost" size="sm" icon={Trash2} className="text-ui-bad" onClick={onDiscard}>Piszkozat törlése</Button>}
      </div>
    </Card>
  )
}

/** Amit a blokk-paletta és a beszúrás (13.7) felvehet. */
export type InsertKind = 'title' | 'text' | 'image' | 'gallery' | 'logo' | 'button' | 'button_row' | 'bullet_list' | 'offers' | 'voucher' | 'divider' | 'social_links'

/** A blokk-paletta (írás-mód): sötét pill — szöveg, kép, képek egymás mellett, logó, gomb, utalvány, közösségi,
 *  elválasztó. `row`: vízszintesen (mobil). */
const PALETTE: [InsertKind, LucideIcon, string][] = [['text', Type, 'Szöveg'], ['image', ImageIcon, 'Kép'], ['gallery', Images, 'Képek egymás mellett'], ['logo', Store, 'Logó'], ['button', MousePointerClick, 'Gomb'], ['button_row', Columns2, 'Gombsor'], ['voucher', Gift, 'Utalvány'], ['social_links', Globe2, 'Közösségi'], ['divider', Minus, 'Elválasztó']]
export function BlockPalette({ row = false, onAdd, className = '' }: { row?: boolean; onAdd?: (kind: InsertKind) => void; className?: string }) {
  return (
    <div className={`flex gap-1.5 rounded-full bg-ui-dark p-1.5 ${row ? 'justify-between overflow-x-auto' : 'flex-col'} ${className}`}>
      {PALETTE.map(([k, I, l]) => <IconButton key={k} icon={I} label={`${l} hozzáadása`} variant="onDark" size="sm" onClick={onAdd ? () => onAdd(k) : undefined} />)}
    </div>
  )
}

/* ── 13.4: a kijelölt blokk stílusa ── */

export type TextFormat = 'bold' | 'italic' | 'underline' | 'link'
export type BlockStyleValue = { bg: string | null; color: string | null; size: 0 | 1 | 2; align: 'left' | 'center' | 'right'; /** cím-szint: H1 / H2 / H3 */ level: 0 | 1 | 2; /** a `width` opciók közül a kiválasztott */ width: number }
export type BlockStyleSupport = { bg: boolean; color: boolean; size: boolean; align: boolean; /** címnél: H1 / H2 / H3 */ level?: boolean; /** szövegnél: félkövér, dőlt, aláhúzott, link */ format?: boolean; /** szélesség-opciók (pl. kép: Kicsi / Közepes / Teljes) */ width?: readonly string[]; widthLabel?: string }
const BG_PRESETS: [string | null, 'white' | 'cell' | 'yellow' | 'dark', string][] = (['white', 'cell', 'yellow', 'dark'] as const).map((t, i) => [EMAIL_BG[i], t, ['Fehér', 'Krém', 'Sárga', 'Sötét'][i]])
const COLOR_PRESETS: [string | null, 'cell' | 'dark', string, string][] = ([['cell', 'text-ui-dark', 'Sötét'], ['cell', 'text-ui-muted', 'Szürke'], ['dark', 'text-white', 'Fehér'], ['dark', 'text-ui-yellow', 'Sárga']] as const).map(([t, c, l], i) => [EMAIL_TEXT[i], t, c, l])
const SAMPLE_STYLE: BlockStyleValue = { bg: EMAIL_BG[1], color: null, size: 1, align: 'left', level: 0, width: 0 }
const ALL_STYLE: BlockStyleSupport = { bg: true, color: true, size: true, align: true, level: true, format: true }
const ALIGNS: ['left' | 'center' | 'right', LucideIcon, string][] = [['left', AlignLeft, 'Balra'], ['center', AlignCenter, 'Középre'], ['right', AlignRight, 'Jobbra']]
const FORMATS: [TextFormat, LucideIcon, string][] = [['bold', Bold, 'Félkövér'], ['italic', Italic, 'Dőlt'], ['underline', Underline, 'Aláhúzott'], ['link', Link2, 'Link']]

/** Ikon-gombok sora (igazítás, formázás); `keep`: a gomb nem veszi el a kijelölést a szövegből. */
function IconPill({ items, active, onPick, keep = false }: { items: [string, LucideIcon, string][]; active?: string; onPick?: (k: string) => void; keep?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      {items.map(([k, I, l]) => (
        <IconButton key={k} icon={I} label={l} size="sm" variant={k === active ? 'dark' : 'cell'} aria-pressed={active ? k === active : undefined}
          onMouseDown={keep && onPick ? (e) => e.preventDefault() : undefined} onClick={onPick ? () => onPick(k) : undefined} />
      ))}
    </span>
  )
}

/** Saját szín: „+” kör a böngésző színválasztójával; a kiválasztott saját szín külön körben, kijelölve. */
function CustomColor({ value, presets, fallback, onPick, ring }: { value: string | null; presets: (string | null)[]; fallback: string; onPick?: (c: string) => void; ring: string }) {
  const custom = value && !presets.includes(value) ? value : null
  return (
    <>
      {custom && <span title="Saját szín"><IconCircle tone="white" size="md" className={`border border-ui-divider ${ring}`}><span className="h-full w-full rounded-full" style={{ background: custom }} /></IconCircle></span>/* ui-allow: a vendég-levél saját színe (adat) */}
      {onPick ? (
        <label title="Saját szín" className="ui-press relative cursor-pointer rounded-full">
          <IconCircle tone="cell" size="md" icon={Plus} />
          <input type="color" aria-label="Saját szín" value={custom ?? fallback} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      ) : <IconButton icon={Plus} label="Saját szín" size="sm" variant="cell" />}
    </>
  )
}

/** A kijelölt blokk stílusa: cím-szint (H1–H3) és formázás (félkövér, dőlt, aláhúzott, link), háttér és betűszín (a
 *  mintákon túl saját szín), méret, szélesség, igazítás (ikonokkal). A desktop szerkesztő jobb oszlopa (13.4) és a mobil
 *  blokk-lap (13.7) is ez. Csak az látszik, amit a blokk tud. `onFormat`: a kijelölt szövegrészre (a levélben). */
export function BlockStyle({ value = SAMPLE_STYLE, onChange, onFormat, supports = ALL_STYLE }: { value?: BlockStyleValue; onChange?: (v: BlockStyleValue) => void; onFormat?: (f: TextFormat) => void; supports?: BlockStyleSupport }) {
  const ring = 'ring-2 ring-ui-dark ring-offset-2 ring-offset-white'
  const set = (p: Partial<BlockStyleValue>) => onChange?.({ ...value, ...p })
  const pick = (node: React.ReactNode, title: string, on: () => void, key: string) => onChange
    ? <button key={key} type="button" title={title} aria-label={title} onClick={on} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{node}</button>
    : <span key={key} title={title}>{node}</span>
  const none = !supports.bg && !supports.color && !supports.size && !supports.align && !supports.level && !supports.format && !supports.width
  if (none) return <Meta className="py-2.5 text-ui-label">Ennek a blokknak nincs stílusa — a tartalmát a levélben írod át.</Meta>
  return (
    <>
      {(supports.level || supports.format) && (
        <FieldRow label="Formázás" stacked>
          <span className="flex flex-wrap gap-1.5">
            {supports.level && <Segmented tone="cell" size="sm" options={['H1', 'H2', 'H3']} active={value.level} onSelect={onChange ? (i) => set({ level: i as 0 | 1 | 2 }) : undefined} />}
            {supports.format && <IconPill keep items={FORMATS} onPick={onFormat ? (k) => onFormat(k as TextFormat) : undefined} />}
          </span>
        </FieldRow>
      )}
      {supports.bg && (
        <FieldRow label="Háttér" stacked>
          <span className="flex flex-wrap items-center gap-1.5">
            {/* nincs háttér: átlátszó (a levél fehérje látszik) — csíkos kör jelzi */}
            {pick(<IconCircle tone="white" size="md" className={`ui-hatch-lines-dense border border-dashed border-ui-dark/30 ${value.bg === 'transparent' ? ring : ''}`} />, 'Nincs háttér', () => set({ bg: 'transparent' }), 'none')}
            {BG_PRESETS.map(([c, t, l]) => pick(<IconCircle tone={t} size="md" className={`border border-ui-divider ${value.bg === c ? ring : ''}`} />, l, () => set({ bg: c }), l))}
            <CustomColor value={value.bg} presets={EMAIL_BG} fallback={EMAIL_BG[1] ?? ''} onPick={onChange ? (c) => set({ bg: c }) : undefined} ring={ring} />
          </span>
        </FieldRow>
      )}
      {supports.color && (
        <FieldRow label="Betűszín" stacked>
          <span className="flex flex-wrap items-center gap-1.5">
            {COLOR_PRESETS.map(([c, t, cls, l]) => pick(<IconCircle tone={t} size="md" className={value.color === c ? ring : ''}><span className={`text-ui-meta ${cls}`}>Aa</span></IconCircle>, l, () => set({ color: c }), l))}
            <CustomColor value={value.color} presets={EMAIL_TEXT} fallback={EMAIL_BG[3] ?? ''} onPick={onChange ? (c) => set({ color: c }) : undefined} ring={ring} />
          </span>
        </FieldRow>
      )}
      {supports.size && <FieldRow label="Méret" stacked><Segmented tone="cell" size="sm" options={['S', 'M', 'L']} active={value.size} onSelect={onChange ? (i) => set({ size: i as 0 | 1 | 2 }) : undefined} /></FieldRow>}
      {supports.width && <FieldRow label={supports.widthLabel ?? 'Szélesség'} stacked><Segmented tone="cell" size="sm" options={supports.width} active={value.width} onSelect={onChange ? (i) => set({ width: i }) : undefined} /></FieldRow>}
      {supports.align && <FieldRow label="Igazítás" stacked><IconPill items={ALIGNS} active={value.align} onPick={onChange ? (k) => set({ align: k as BlockStyleValue['align'] }) : undefined} /></FieldRow>}
    </>
  )
}

/** Blokk beszúrása (mobil lap, 13.7): a blokk-típusok csempékben; `where`: hová kerül. */
export const INSERT_KINDS: [InsertKind, LucideIcon, string, string][] = [['title', Type, 'Cím + szöveg', 'Bekezdés címmel'], ['image', ImageIcon, 'Kép', 'Fotó a galériából'], ['gallery', Images, 'Képek egymás mellett', '2–3 kép egy sorban'], ['logo', Store, 'Logó', 'Az üzlet logója'], ['button', MousePointerClick, 'Gomb', 'Foglalás, link'], ['bullet_list', List, 'Felsorolás', 'Pontokba szedve'], ['offers', PanelsTopLeft, 'Két ajánlat', 'Árral, egymás mellett'], ['voucher', Gift, 'Utalvány', 'Megvehető típus'], ['divider', Minus, 'Elválasztó', 'Szaggatott vonal'], ['social_links', Globe2, 'Közösségi', 'Instagram, Facebook']]
export function BlockInsertGrid({ active = 'title', onPick }: { active?: InsertKind; onPick?: (k: InsertKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {INSERT_KINDS.map(([k, I, t, d]) => {
        const card = <OptionCard stacked icon={I} title={t} selected={k === active}>{d}</OptionCard>
        return onPick ? <button key={k} type="button" onClick={() => onPick(k)} className="ui-press rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{card}</button> : <div key={k}>{card}</div>
      })}
    </div>
  )
}

/* ── 13.5.1 / 13.7: kampányok szűrése ── */

export type CampaignFilterValue = { status: number; sort: number; period: number; from: string; to: string }
/** Kampányok szűrése — állapot (darabszámmal), időszak (egyedinél pontos -tól / -ig a dátumválasztón), rendezés. Desktopon
 *  a lista szűrő-ikonjáról nyíló panel (13.5.1), mobilon a fejléc szűrő-ikonjáról felcsúszó lap (13.7). */
export function CampaignFilter({ wide = false, counts = [['Mind', 6], ['Kiküldve', 3], ['Ütemezve', 1], ['Automatikus', 1], ['Piszkozat', 1]], value, onChange, onPickDay, onReset, onApply, total = 6 }: {
  wide?: boolean; counts?: [string, number][]; value?: CampaignFilterValue; onChange?: (v: CampaignFilterValue) => void
  onPickDay?: (d: string) => void; onReset?: () => void; onApply?: () => void; total?: number
}) {
  const v = value ?? { status: 0, sort: 0, period: 2, from: '', to: '' }
  const set = (p: Partial<CampaignFilterValue>) => onChange?.({ ...v, ...p })
  const chip = (node: React.ReactNode, i: number, k: string) => onChange ? <button key={k} type="button" onClick={() => set({ status: i })} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{node}</button> : <span key={k}>{node}</span>
  return (
    <>
      <div className="flex items-center justify-between"><span className="text-ui-title font-light text-ui-text">Szűrés</span><Button variant="ghost" size="sm" onClick={onReset}>Alaphelyzet</Button></div>
      <div className={wide ? 'grid gap-x-6 sm:grid-cols-2' : ''}>
        <div>
          <Meta className="mt-4">Állapot</Meta>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{counts.map(([t, n], i) => chip(<Pill tone={i === v.status ? 'dark' : 'cell'}>{t} <span className="opacity-50">{n}</span></Pill>, i, t))}</div>
          <Meta className="mt-4">Rendezés</Meta>
          <div className="mt-1.5 space-y-1">{['Legújabb elöl', 'Legjobb megnyitás', 'Legtöbb foglalás'].map((t, i) => {
            const c = <OptionCard radio title={t} selected={i === v.sort} />
            return onChange ? <button key={t} type="button" onClick={() => set({ sort: i })} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <div key={t}>{c}</div>
          })}</div>
        </div>
        <div>
          <Meta className="mt-4">Időszak</Meta>
          {onChange
            ? <PeriodPicker className="mt-1.5" presets={['30 nap', 'Év', 'Mind', 'Egyedi']} active={v.period} live={{ from: v.from, to: v.to, onPick: (d) => onPickDay?.(d), onPreset: (i) => set({ period: i }) }} />
            : <PeriodPicker className="mt-1.5" />}
        </div>
      </div>
      <Button className="mt-5 w-full" onClick={onApply}>Mutasd · {total} kampány</Button>
    </>
  )
}

/* ── 13.2: feliratkozók ── */

/** Egy feliratkozó sora: `country` csak nemzetközi listán jelenik meg; `lastVisit` a legutóbbi foglalás napja; `opened` /
 *  `received`: hány kampányt nyitott meg a kapottakból; `last` / `lastAt`: az utoljára megnyitott levél és mikor. */
export type SubscriberRowVM = { id: string; name: string; email: string; img?: string | null; country?: string; since: string; src?: string | null; bookings: number; lastVisit?: string | null; opened?: number; received?: number; last: string | null; lastAt?: string | null; unsub?: boolean }
const SAMPLE_SUBS: SubscriberRowVM[] = ([
  ['Kovács Anna', 'anna.kovacs@gmail.com', 'HU', 'Okt. 28.', 'Foglaláskor', 9, 'Okt. 30.', 4, 4, 'Okt. 14.|Őszi frissítés'],
  ['Tóth Bence', 'bence.toth@freemail.hu', 'HU', 'Okt. 21.', 'Foglaláskor', 3, 'Okt. 2.', 2, 4, 'Okt. 15.|Őszi frissítés'],
  ['Lukas Gruber', 'lukas.g@gmx.at', 'AT', 'Okt. 9.', 'Foglalóoldal', 1, 'Okt. 9.', 0, 1, ''],
  ['Gál Zsófia', 'gal.zsofi@gmail.com', 'HU', 'Szept. 30.', 'Kézzel felvéve', 6, 'Júl. 12.', 1, 4, 'Szept. 2.|Új munkatárs'],
  ['Horváth Eszter', 'eszter.h@gmail.com', 'HU', 'Szept. 12.', 'Foglaláskor', 2, 'Szept. 3.', 3, 3, 'Szept. 3.|Új munkatárs'],
] as const).map(([n, e, country, since, src, bk, visit, op, rc, last]) => ({ id: e, name: n, email: e, country, since, src, bookings: bk, lastVisit: visit, opened: op, received: rc, last: last ? last.split('|')[1] : null, lastAt: last ? last.split('|')[0] : null }))

/** A levél-aktivitás cellája: hányat nyitott meg a kapott kampányokból (pl. „3 / 4”) — mint a Munkatársak óra-oszlopa:
 *  zöld, ha legalább a felét megnyitotta, piros, ha egyet sem; kapott nélkül „—”. */
const mailCell = (r: { opened?: number; received?: number }) => {
  if (!r.received) return <span className="text-ui-muted">—</span>
  const o = r.opened ?? 0
  return <span className={o === 0 ? 'text-ui-bad' : o * 2 >= r.received ? 'text-ui-ok' : ''}>{o} / {r.received}</span>
}

/** A Feliratkozók táblázata: vendég (név, e-mail), nemzetközi listán az ország, mikor (és honnan) iratkozott fel, hány
 *  foglalása van, mikor járt utoljára, hány levelet nyitott meg a kapottakból, és melyiket utoljára. Pipával kijelölhető
 *  (a kijelölt sárga), alul lapozó. `intl`: van külföldi feliratkozó — csak ilyenkor látszik az Ország oszlop. */
export function SubscriberTable({ more, rows = SAMPLE_SUBS, intl = true, selected = ['bence.toth@freemail.hu'], onToggle, onToggleAll, page = 1, pages = 84, label = '1–5 / 418', onPage, empty, th, className = '' }: { /** görgetésre töltés a lapozó előtt (LoadMoreSentinel) */ more?: React.ReactNode;
  rows?: SubscriberRowVM[]; intl?: boolean; selected?: string[]; onToggle?: (id: string) => void; onToggleAll?: () => void
  page?: number; pages?: number; label?: string; onPage?: (p: number) => void; empty?: React.ReactNode; className?: string
  /** rendezés az oszlopcímre kattintva (a szerver rendez — `/api/marketing/subscribers` `order` + `sort`) */
  th?: (key: string) => { sort: 'asc' | 'desc' | null; onSort: () => void }
}) {
  const all = rows.length > 0 && rows.every((r) => selected.includes(r.id))
  return (
    <Card pad="sm" className={`overflow-x-auto ${className}`}>
      <Table minWidth={intl ? 920 : 840}>
        <thead><tr><Th className="w-8 pr-0"><RowCheck checked={all} onToggle={onToggleAll} label="Mind kijelölése" /></Th><Th {...th?.('name')}>Vendég</Th>{intl && <Th {...th?.('country')}>Ország</Th>}<Th {...th?.('since')}>Feliratkozott</Th><Th {...th?.('bookings')}>Foglalás</Th><Th {...th?.('last')}>Utoljára járt</Th><Th {...th?.('opened')}>Megnyitott levél</Th><Th {...th?.('lastOpen')}>Utolsó megnyitott levél</Th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const sel = selected.includes(r.id)
            return (
              // mint a Munkatársak / Utalványok listája: fehér kártya-sorok, a kijelölt sárga, hoverre halványodik
              <Tr key={r.id} onClick={onToggle ? () => onToggle(r.id) : undefined} className={`${sel ? '[&>td]:bg-ui-yellow [&:hover>td]:bg-ui-yellow/80' : '[&>td]:bg-white [&:hover>td]:bg-white/60'} ${r.unsub && !sel ? 'text-ui-muted' : ''}`}>
                <Td className="w-8 pr-0"><RowCheck checked={sel} onToggle={onToggle ? () => onToggle(r.id) : undefined} /></Td>
                <Td><span className="block">{r.name || r.email}{r.unsub && <StatusPill status="bad" className="ml-2">Leiratkozott</StatusPill>}</span><span className="block text-ui-label text-ui-muted">{r.email}</span></Td>
                {intl && <Td className={r.country ? '' : 'text-ui-muted'}>{r.country || '—'}</Td>}
                <Td><span className="block">{r.since}</span>{r.src && <span className="block text-ui-label text-ui-muted">{r.src}</span>}</Td>
                <Td>{r.bookings}</Td>
                <Td className={r.lastVisit ? '' : 'text-ui-muted'}>{r.lastVisit ?? '—'}</Td>
                <Td>{mailCell(r)}</Td>
                <Td className={r.last ? '' : 'text-ui-muted'}>{r.last ? <><span className="block">{r.last}</span>{r.lastAt && <span className="block text-ui-label text-ui-muted">megnyitotta {r.lastAt}</span>}</> : '—'}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
      {rows.length === 0 && empty}
      {more}
      <Pagination page={page} pages={pages} label={label} onPage={onPage} className="px-2 pt-3" />
    </Card>
  )
}

/** Mobil Feliratkozók (13.7): soronként név, e-mail, mikor iratkozott fel, hány foglalása van; alul teljes lapozó.
 *  `onToggle`: koppintásra kijelölhető (pipa, a kijelölt sárga) — a tömeges műveletekhez. */
export function SubscriberMobileList({ more, rows = SAMPLE_SUBS, selected = [], onToggle, page = 1, pages = 84, onPage, className = '' }: { /** görgetésre töltés a lapozó előtt (LoadMoreSentinel) */ more?: React.ReactNode; rows?: SubscriberRowVM[]; selected?: string[]; onToggle?: (id: string) => void; page?: number; pages?: number; onPage?: (p: number) => void; className?: string }) {
  return (
    <div className={className}>
      <div className="space-y-1">
        {rows.map((r) => {
          const sel = selected.includes(r.id)
          const row = <ListRow filled open={sel} leading={onToggle ? <RowCheck checked={sel} /> : undefined} title={r.name || r.email} meta={<MarqueeText>{r.email}</MarqueeText>} trailing={<Meta className="text-right text-ui-label">{r.since} · {r.bookings} foglalás</Meta>} />
          return onToggle ? <button key={r.id} type="button" aria-pressed={sel} onClick={() => onToggle(r.id)} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={r.id}>{row}</div>
        })}
      </div>
      {more}
      {pages > 1 && <Pagination page={page} pages={pages} full onPage={onPage} className="mt-3" />}
    </div>
  )
}

/** A feliratkozók szűrése (a Feliratkozók fül és a címzett-választó szűrő-ikonja alatt) — a célzáshoz hasznos szempontok:
 *  mikor járt utoljára, megnyitja-e a leveleket, hány foglalása van, mióta feliratkozó; nemzetközi listán az ország. */
export type SubscriberFilterValue = { visit: '' | 'recent' | 'lapsed'; engage: '' | 'opens' | 'never'; bookings: '' | 'none' | 'some' | 'regular'; since: number; service: string; country: string }
export const SUB_FILTER0: SubscriberFilterValue = { visit: '', engage: '', bookings: '', since: 0, service: '', country: '' }
const VISIT_OPTS = ['', 'recent', 'lapsed'] as const
const ENGAGE_OPTS = ['', 'opens', 'never'] as const
const BOOKING_OPTS = ['', 'none', 'some', 'regular'] as const
const SINCE_OPTS = [0, 30, 90, 365]
export const subFilterCount = (v: SubscriberFilterValue) => [v.visit, v.engage, v.bookings, v.since, v.service, v.country].filter(Boolean).length
/** `services`: a „Foglalta már” elemei — szalonnál a szolgáltatások, étteremnél az alkalmak (a célzás legerősebb szempontja) */
export function SubscriberFilters({ value = SUB_FILTER0, onChange, countries = [], services = [], restaurant = false, wide = false }: { value?: SubscriberFilterValue; onChange?: (v: SubscriberFilterValue) => void; countries?: string[]; services?: { id: string; name: string }[]; restaurant?: boolean; /** két hasábban (széles panelben, pl. a címzett-ablakban — ott a magasság szűk) */ wide?: boolean }) {
  const set = (p: Partial<SubscriberFilterValue>) => onChange?.({ ...value, ...p })
  const row = (label: string, opts: string[], active: number, pick: (i: number) => void) => (
    <div><Meta className="mb-1.5">{label}</Meta><Segmented tone="cell" size="sm" full options={opts} active={active} onSelect={onChange ? pick : undefined} /></div>
  )
  return (
    <div>
      <div className="flex items-center justify-between"><span className="text-ui-row text-ui-text">Szűrés</span>{onChange && subFilterCount(value) > 0 && <Button variant="ghost" size="sm" onClick={() => onChange(SUB_FILTER0)}>Alaphelyzet</Button>}</div>
      <div className={`mt-3 grid gap-3 ${wide ? 'sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-3' : ''}`}>
      {row('Utoljára járt (napja)', ['Mind', '≤ 30', '90+'], VISIT_OPTS.indexOf(value.visit), (i) => set({ visit: VISIT_OPTS[i] }))}
      {row('Megnyitja a leveleket', ['Mind', 'Igen', 'Soha'], ENGAGE_OPTS.indexOf(value.engage), (i) => set({ engage: ENGAGE_OPTS[i] }))}
      {row('Foglalás', ['Mind', 'Nincs', '1–3', '4+ törzs'], BOOKING_OPTS.indexOf(value.bookings), (i) => set({ bookings: BOOKING_OPTS[i] }))}
      {row('Feliratkozott (napja)', ['Mind', '≤ 30', '≤ 90', '≤ 365'], SINCE_OPTS.indexOf(value.since), (i) => set({ since: SINCE_OPTS[i] }))}
      {services.length > 0 && (
        <div><Meta className="mb-1.5">Foglalta már</Meta><Select value={onChange ? value.service : undefined} defaultValue={onChange ? undefined : value.service} onChange={onChange ? (e) => set({ service: e.target.value }) : undefined}><option value="">{restaurant ? 'Bármilyen alkalom' : 'Bármelyik szolgáltatás'}</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
      )}
      {countries.some((c) => c !== 'HU') && (
        <div><Meta className="mb-1.5">Ország</Meta><Select value={onChange ? value.country : undefined} defaultValue={onChange ? undefined : value.country} onChange={onChange ? (e) => set({ country: e.target.value }) : undefined}><option value="">Minden ország</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
      )}
      </div>
    </div>
  )
}

/* ── 13.5: címzettek kiválasztása ── */

export type RecipientPickRow = { id: string; name: string; email: string; country?: string; since?: string; bookings?: number; lastVisit?: string | null; opened?: number; received?: number; sel: boolean; off?: boolean }
const SAMPLE_PICK: RecipientPickRow[] = ([
  ['Kovács Anna', 'anna.kovacs@gmail.com', 'HU', 'Okt. 28.', 9, 'Okt. 30.', 4, 4, true, false],
  ['Tóth Bence', 'bence.toth@freemail.hu', 'HU', 'Okt. 21.', 3, 'Okt. 2.', 2, 4, true, false],
  ['Lukas Gruber', 'lukas.g@gmx.at', 'AT', 'Okt. 9.', 1, 'Okt. 9.', 0, 1, false, false],
  ['Gál Zsófia', 'gal.zsofi@gmail.com', 'HU', 'Szept. 30.', 6, 'Júl. 12.', 1, 4, true, false],
  ['Nagy Péter', 'peter.nagy@citromail.hu', 'HU', 'Szept. 12.', 2, 'Aug. 20.', 0, 3, false, true],
] as const).map(([n, e, c, since, bk, visit, op, rc, sel, off]) => ({ id: e, name: n, email: e, country: c, since, bookings: bk, lastVisit: visit, opened: op, received: rc, sel, off }))

/** A címzett-választó táblázata (a popup tartalma), mint a többi lista: fehér sorok, a pipával kijelölt sárga, a
 *  leiratkozott halvány, nem jelölhető. Vendég (név, e-mail), nemzetközi listán az ország (`intl`), mióta feliratkozó,
 *  hány foglalása van, mikor járt utoljára, hány levelet nyitott meg; alul lapozó. */
export function RecipientTable({ rows = SAMPLE_PICK, intl = true, onToggle, onToggleAll, page = 1, pages = 42, label = '1–10 / 418', onPage }: { rows?: RecipientPickRow[]; intl?: boolean; onToggle?: (id: string) => void; onToggleAll?: () => void; page?: number; pages?: number; label?: string; onPage?: (p: number) => void }) {
  const on = rows.filter((r) => !r.off)
  return (
    <Card pad="sm" className="overflow-x-auto">
    <Table minWidth={intl ? 780 : 700}>
      <thead><tr><Th className="w-8 pr-0"><RowCheck checked={on.length > 0 && on.every((r) => r.sel)} onToggle={onToggleAll} label="Mind kijelölése" /></Th><Th>Vendég</Th>{intl && <Th>Ország</Th>}<Th>Feliratkozott</Th><Th>Foglalás</Th><Th>Utoljára járt</Th><Th>Megnyitott levél</Th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id} state={r.off ? 'muted' : 'default'} onClick={onToggle && !r.off ? () => onToggle(r.id) : undefined} className={r.sel ? '[&>td]:bg-ui-yellow [&:hover>td]:bg-ui-yellow/80' : '[&>td]:bg-white [&:hover>td]:bg-white/60'}>
            <Td className="w-8 pr-0"><RowCheck checked={r.sel} onToggle={onToggle && !r.off ? () => onToggle(r.id) : undefined} /></Td>
            <Td><span className="block">{r.name || r.email}{r.off && <StatusPill status="bad" className="ml-2">Leiratkozott</StatusPill>}</span><span className="block text-ui-label text-ui-muted">{r.email}</span></Td>
            {intl && <Td className={r.country ? '' : 'text-ui-muted'}>{r.country || '—'}</Td>}
            <Td className={r.since ? '' : 'text-ui-muted'}>{r.since ?? '—'}</Td>
            <Td>{r.bookings ?? 0}</Td>
            <Td className={r.lastVisit ? '' : 'text-ui-muted'}>{r.lastVisit ?? '—'}</Td>
            <Td>{mailCell(r)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    {rows.length === 0 && <Meta className="px-3 py-10 text-center">Nincs találat.</Meta>}
    <Pagination page={page} pages={pages} label={label} onPage={onPage} className="px-2 pt-3" />
    </Card>
  )
}
