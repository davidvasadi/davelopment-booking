'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, FieldRow, Modal, Pill, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { VoucherCard, VoucherSwatch, type VoucherBiz } from './money'
import { VOUCHER_COLORS, VOUCHER_LAYOUTS, VOUCHER_TEXTS, type VoucherDesign } from '@/lib/voucherDesign'

/**
 * Az utalvány-típus sablonja (design 12.3): a szerkesztőben csak egy sor (a választott forma + szín), mellette a
 * „Sablon választása” — a választás egy nagy ablakban, ahol minden forma teljes méretben látszik a választott
 * háttérrel (szín vagy a típus képe). Élőben `onChange` nélkül csak a sor (a /design-ban).
 */
export function VoucherTemplatePicker({ value, photo, amount, restaurant = false, biz, onChange }: {
  value: VoucherDesign; photo?: string | null; amount: string; restaurant?: boolean; biz?: VoucherBiz
  onChange?: (d: VoucherDesign, clearPhoto?: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const layoutName = VOUCHER_LAYOUTS.find(([k]) => k === value.layout)?.[1]
  const colorName = photo ? 'saját kép' : VOUCHER_COLORS.find(([k]) => k === value.color)?.[1]
  const textName = value.text && value.text !== 'auto' ? ` · ${VOUCHER_TEXTS.find(([k]) => k === value.text)?.[1].toLowerCase()} szöveg` : ''
  return (
    <>
      <FieldRow label="Sablon" hint={`${layoutName} · ${colorName}${textName}`}>
        <Button variant="cell" size="sm" onClick={onChange ? () => setOpen(true) : undefined}>Sablon választása</Button>
      </FieldRow>
      {onChange && (
        <PopupModal open={open} onClose={() => setOpen(false)} panel={
          <Modal size="xl" className="sm:w-[calc(100vw-2rem)]" title="Az utalvány sablonja" subtitle="A forma, a háttér és a szöveg színe — kép esetén a kép a háttér, a forma marad." onClose={() => setOpen(false)}
            footer={<Button onClick={() => setOpen(false)}>Kész</Button>}>
            <VoucherTemplateGrid value={value} photo={photo} amount={amount} restaurant={restaurant} biz={biz} onChange={onChange} />
          </Modal>
        } />
      )}
    </>
  )
}

const SEL_GAP = '[filter:drop-shadow(3px_0_0_white)_drop-shadow(-3px_0_0_white)_drop-shadow(0_3px_0_white)_drop-shadow(0_-3px_0_white)]' // ui-allow: fehér rés a jegy körül (az ablak színében)
const SEL_DARK = '[filter:drop-shadow(2px_0_0_var(--ui-dark))_drop-shadow(-2px_0_0_var(--ui-dark))_drop-shadow(0_2px_0_var(--ui-dark))_drop-shadow(0_-2px_0_var(--ui-dark))]' // ui-allow: a kijelölés körvonala

/** Az ablak tartalma: felül a háttér (4 szín, vagy a típus képe, ha van), alatta minden forma nagyban. A /design is ezt mutatja. */
export function VoucherTemplateGrid({ value, photo, amount, restaurant = false, biz, onChange, oneCol = false }: {
  value: VoucherDesign; photo?: string | null; amount: string; restaurant?: boolean; biz?: VoucherBiz
  /** egy oszlop (a /design telefon-keretében — ott a képernyő-töréspont nem a keret szélessége) */
  oneCol?: boolean
  onChange?: (d: VoucherDesign, clearPhoto?: boolean) => void
}) {
  return (
    <>
      {/* háttér: a 4 szín egy sorban */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-ui-body text-ui-muted">Háttér</span>
        <span className="flex items-center gap-1.5">
          {VOUCHER_COLORS.map(([k, l]) => {
            const on = !photo && value.color === k
            return onChange
              ? <button key={k} type="button" title={l} aria-label={l} aria-pressed={on} className="ui-press rounded-full" onClick={() => onChange({ ...value, color: k }, true)}><VoucherSwatch color={k} on={on} /></button>
              : <span key={k} title={l}><VoucherSwatch color={k} on={on} /></span>
          })}
          {photo && <span title="Saját kép" className="block h-9 w-9 overflow-hidden rounded-full ring-2 ring-ui-dark ring-offset-2 ring-offset-white">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt="" className="h-full w-full object-cover" /></span>}
        </span>
        {photo && <span className="text-ui-meta text-ui-muted">Saját kép — színre váltva a kép lekerül</span>}
        {/* a szöveg színe: alapból a háttérhez igazodik; képnél / egyedi hangulatnál átállítható */}
        <span className="flex items-center gap-3 sm:ml-auto">
          <span className="text-ui-body text-ui-muted">Szöveg</span>
          <Segmented size="sm" tone="cell" options={VOUCHER_TEXTS.map(([, l]) => l)} active={Math.max(0, VOUCHER_TEXTS.findIndex(([k]) => k === (value.text ?? 'auto')))}
            onSelect={onChange ? (i) => onChange({ ...value, text: VOUCHER_TEXTS[i][0] }) : undefined} />
        </span>
      </div>
      {/* a formák: felül a neve, alatta a jegy a választott háttérrel */}
      <div className={`mt-6 grid gap-x-4 gap-y-6 ${oneCol ? '' : 'lg:grid-cols-2'}`}>
        {VOUCHER_LAYOUTS.map(([k, l]) => {
          const on = value.layout === k
          const card = (
            <>
              <div className="mb-2 flex h-7 items-center justify-between gap-2 px-1"><span className="text-ui-body text-ui-text">{l}</span>{on && <Pill tone="dark" size="sm" icon={Check}>Kiválasztva</Pill>}</div>
              {/* a kijelölés körvonala a jegy saját formáját követi — ezért árnyék-szűrő, nem ring */}
              <div className={on ? SEL_DARK : ''}><div className={on ? SEL_GAP : ''}>
                <VoucherFit><VoucherCard to="Lili" message="Boldog szülinapot! Kényeztesd magad." amount={amount} design={{ ...value, layout: k }} photo={photo} restaurant={restaurant} biz={biz} /></VoucherFit>
              </div></div>
            </>
          )
          return onChange
            ? <button key={k} type="button" className="block min-w-0 text-left outline-none" aria-pressed={on} onClick={() => onChange({ ...value, layout: k })}>{card}</button>
            : <div key={k} className="min-w-0">{card}</div>
        })}
      </div>
    </>
  )
}

/**
 * A teljes jegy keskeny helyen (az utalvány részletei, a típus-szerkesztő, a beváltás): valódi méretben (`w`) rajzolva,
 * arányosan kicsinyítve a hely szélességére — így pontosan az a jegy látszik, amit a vendég kap, nem egy összenyomott
 * változat. Mérés előtt (szerveren) teljes szélességben, kicsinyítés nélkül.
 */
export function VoucherFit({ w = 600, children }: { w?: number; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ s: number; h: number } | null>(null)
  useEffect(() => {
    const b = box.current, i = inner.current
    if (!b || !i) return
    const measure = () => { const s = Math.min(1, b.clientWidth / w); setFit({ s, h: i.offsetHeight * s }) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(b); ro.observe(i)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={box} className="relative w-full overflow-hidden" style={fit ? { height: fit.h } : undefined}>
      {/* mérés után a jegy kikerül az áramlásból (absolute), így a 600 px-es valódi szélessége nem feszíti szét a
          szülőt (rácsban, keskeny telefon-lapon) — a doboz magasságát a kicsinyített magasság adja */}
      <div ref={inner} className="origin-top-left" style={fit ? { position: 'absolute', left: 0, top: 0, width: w, transform: `scale(${fit.s})` } : undefined}>{children}</div>
    </div>
  )
}
