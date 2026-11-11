'use client'

import { invoiceHref } from '@/lib/invoiceLinks'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PopupModal } from '@/components/ui/popup-modal'
import { Input } from '@/components/ui-kit'
import { CheckoutModal, type CheckoutLine, type PayMethod } from '@/components/blocks/money'

/** A szalon „Fizetés a helyszínen” beállítása (Beállítások › Fizetés & számlázás). */
export type OnsiteSettings = { enabled: boolean; mode: 'register' | 'invoice'; methods: string[]; invoiceDefault: 'ask' | 'always' }

type Booked = {
  id: string | number; customerName: string; customerEmail?: string | null; customerCity?: string | null; customerAddress?: string | null
  when: string; service: { name: string; meta?: string; price: number }
  deposit: number; depositInvoice?: string | null; voucher: number; voucherCode?: string | null
}

/**
 * A foglalás lezárása helyszíni fizetéssel (design 6.7.1) — a megnyitott foglalás „Fizetés” gombja nyitja. A tételek
 * (a szolgáltatás az árával, + tétel), a levonások (előleg, utalvány — a foglalásból), a fizetési mód, a bizonylat
 * (pénztárgép: csak rögzítés; számlázó: „Kér számlát a vendég?” + a vevő adatai). A mentés: /api/salon/booking-checkout.
 */
export function BookingCheckout({ open, onClose, onDone, booking, settings, settingsHref }: {
  open: boolean; onClose: () => void; onDone: () => void
  booking: Booked; settings: OnsiteSettings; settingsHref: string
}) {
  const [items, setItems] = useState<CheckoutLine[]>([{ key: 's', name: booking.service.name, meta: booking.service.meta, amount: booking.service.price, kind: 'service' }])
  const allowed = (settings.methods.length ? settings.methods : ['cash', 'card', 'transfer']).filter((m): m is PayMethod => m === 'cash' || m === 'card' || m === 'transfer' || m === 'link')
  const [method, setMethod] = useState<PayMethod>(allowed[0] ?? 'cash')
  const [invoice, setInvoice] = useState(settings.invoiceDefault === 'always')
  const [buyerKind, setBuyerKind] = useState<'person' | 'company'>('person')
  const [buyer, setBuyer] = useState({ name: booking.customerName, taxNumber: '', zip: '', city: booking.customerCity ?? '', address: booking.customerAddress ?? '', email: booking.customerEmail ?? '' })
  const [busy, setBusy] = useState(false)
  const [payLink, setPayLink] = useState<string | null>(null)

  // fizetési link (design 6.7.1): a mód kiválasztásakor elkészül a link és a QR-kód — a vendég a pultnál beolvassa,
  // vagy e-mailben kapja („Link küldése”). A foglalást a kifizetés után a Stripe webhook zárja le.
  const linkBody = (send: boolean) => JSON.stringify({
    bookingId: booking.id, send, invoice: settings.mode === 'invoice' ? invoice : true,
    lines: items.map((l) => ({ name: l.name.trim() || 'Tétel', amount: Math.max(0, Math.round(l.amount)) })),
    buyer: { name: buyer.name, email: buyer.email, taxNumber: buyerKind === 'company' ? buyer.taxNumber : undefined, zip: buyer.zip, city: buyer.city, address: buyer.address },
  })
  const makeLink = async (send: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/salon/booking-paylink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: linkBody(send) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.url) throw new Error(j.error ?? 'Nem sikerült a fizetési linket elkészíteni')
      setPayLink(j.url)
      if (send) toast.success(j.sent ? 'Elküldve — a foglalás a kifizetés után magától lezárul' : 'A link kész (e-mail most nem ment ki) — mutasd meg a QR-kódot')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt'); if (!send) setMethod(allowed.find((m) => m !== 'link') ?? 'cash') } finally { setBusy(false) }
  }
  useEffect(() => { if (method === 'link' && !payLink) void makeLink(false) }, [method]) // eslint-disable-line react-hooks/exhaustive-deps

  const deducts: CheckoutLine[] = [
    ...(booking.deposit > 0 ? [{ key: 'd', name: 'Előleg', meta: booking.depositInvoice ? <>Kártyával fizetve · előlegszámla <a href={invoiceHref('salon', booking.depositInvoice)} className="underline underline-offset-2 hover:text-ui-text">{booking.depositInvoice}</a></> : 'Kártyával fizetve', amount: -booking.deposit, kind: 'deposit' as const }] : []),
    ...(booking.voucher > 0 ? [{ key: 'v', name: 'Ajándékutalvány', meta: booking.voucherCode ?? undefined, amount: -booking.voucher, kind: 'voucher' as const }] : []),
  ]
  const setField = (k: keyof typeof buyer) => (e: React.ChangeEvent<HTMLInputElement>) => setBuyer((b) => ({ ...b, [k]: e.target.value }))

  const send = async (skip: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/salon/booking-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skip ? { bookingId: booking.id, skip: true } : {
          bookingId: booking.id, method, invoice: settings.mode === 'invoice' && invoice,
          lines: items.map((l) => ({ name: l.name.trim() || 'Tétel', amount: Math.max(0, Math.round(l.amount)) })),
          buyer: { name: buyer.name, email: buyer.email, taxNumber: buyerKind === 'company' ? buyer.taxNumber : undefined, zip: buyer.zip, city: buyer.city, address: buyer.address },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Nem sikerült lezárni')
      toast.success(skip ? 'Lezárva' : j.receipt === 'invoice' ? 'Lezárva — a számla kimegy a vendégnek' : j.receipt === 'manual' ? 'Lezárva — a végszámlát állítsd ki a számlázódban' : 'Lezárva — a fizetés rögzítve')
      onDone()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt') } finally { setBusy(false) }
  }

  return (
    <PopupModal open={open} onClose={onClose} maxWidth="sm:max-w-[880px]" panel={
      <CheckoutModal title="Fizetés és lezárás" subtitle={`${booking.customerName} · ${booking.when}`}
        lines={[...items, ...deducts]} methods={allowed} method={method} onMethod={setMethod}
        mode={settings.mode} invoice={invoice} onInvoice={setInvoice} buyer={buyerKind} onBuyer={setBuyerKind}
        buyerFields={<>
          <Input size="sm" value={buyer.name} onChange={setField('name')} placeholder={buyerKind === 'company' ? 'Cégnév' : 'Név'} aria-label="Név" />
          {buyerKind === 'company' && <Input size="sm" value={buyer.taxNumber} onChange={setField('taxNumber')} placeholder="Adószám" aria-label="Adószám" />}
          <div className="grid grid-cols-[80px_1fr] gap-1.5"><Input size="sm" value={buyer.zip} onChange={setField('zip')} placeholder="Irsz." aria-label="Irányítószám" /><Input size="sm" value={buyer.city} onChange={setField('city')} placeholder="Település" aria-label="Település" /></div>
          <Input size="sm" value={buyer.address} onChange={setField('address')} placeholder="Utca, házszám" aria-label="Cím" />
          <Input size="sm" type="email" value={buyer.email} onChange={setField('email')} placeholder="E-mail — ide megy a számla" aria-label="E-mail" />
        </>}
        stripe payLink={payLink} offHref={settingsHref}
        onCopyLink={() => { if (payLink) void navigator.clipboard?.writeText(payLink).then(() => toast.success('Link másolva')) }}
        onSendLink={() => void makeLink(true)}
        onAddLine={() => setItems((xs) => [...xs, { key: `p${Date.now()}`, name: '', amount: 0, kind: 'product' }])}
        onLineAmount={(k, a) => setItems((xs) => xs.map((l) => (l.key === k ? { ...l, amount: a } : l)))}
        onLineName={(k, n) => setItems((xs) => xs.map((l) => (l.key === k ? { ...l, name: n } : l)))}
        onSkip={() => void send(true)} onSubmit={() => void send(false)} onClose={onClose} busy={busy} />
    } />
  )
}
