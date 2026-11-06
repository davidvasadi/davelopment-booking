'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Input } from '@/components/ui-kit'
import { StaffBillingCard } from '@/components/blocks/money'

type View = { provider: 'szamlazz' | 'billingo' | 'none'; hasKey: boolean; taxNumber: string; vat: string | null; stripe: 'none' | 'pending' | 'ok' }

/**
 * A munkatárs „Saját számlázás” témája (szakemberenkénti számlázás — design 10.4): felül a saját Stripe és a saját
 * számlázó kártyája, alatta a számlázó választó, a kulcs (titkosítva mentve, vissza sosem jön) és az adószám (belőle
 * az ÁFA). Az adatok a `/api/staff/[id]/invoicing`, a Stripe-bekötés a `/api/stripe/connect/staff` végponton.
 */
export function StaffInvoicingPanel({ staffId, name }: { staffId: string; name: string }) {
  const [v, setV] = useState<View | null>(null)
  const [provider, setProvider] = useState<'szamlazz' | 'billingo'>('szamlazz')
  const [key, setKey] = useState('')
  const [tax, setTax] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'stripe'>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/staff/${staffId}/invoicing`).then((r) => (r.ok ? r.json() : null)).then((j: View | null) => {
      if (!alive || !j) return
      setV(j); setProvider(j.provider === 'billingo' ? 'billingo' : 'szamlazz'); setTax(j.taxNumber)
    }).catch(() => null)
    return () => { alive = false }
  }, [staffId])

  const save = async () => {
    setBusy('save')
    try {
      const res = await fetch(`/api/staff/${staffId}/invoicing`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key: key || undefined, taxNumber: tax }) })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j) throw new Error(j?.error ?? 'Nem sikerült menteni')
      setV(j); setKey('')
      toast.success('Elmentve')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt') } finally { setBusy(null) }
  }
  const connect = async () => {
    setBusy('stripe')
    try {
      const res = await fetch('/api/stripe/connect/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.url) throw new Error(j.error ?? 'Nem sikerült elindítani')
      window.location.href = j.url
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hiba történt'); setBusy(null) }
  }

  const sameProvider = v?.provider === provider
  return (
    <div className="space-y-[5px]">
      <StaffBillingCard name={name} provider={v ? (v.provider === 'none' ? 'none' : provider) : 'none'} keyOk={!!v?.hasKey} taxNumber={tax}
        stripe={v?.stripe ?? 'none'} onProvider={setProvider} onConnectStripe={() => void connect()}
        keyField={<Input size="sm" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={sameProvider && v?.hasKey ? 'elmentve — csere esetén írd be' : 'illeszd be a kulcsot'} className="w-[220px] max-w-full" aria-label="Kulcs" />}
        taxField={<Input size="sm" inputMode="numeric" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="12345678-1-42" className="w-[220px] max-w-full" aria-label="Adószám" />} />
      <div className="flex justify-end"><Button onClick={() => void save()} loading={busy === 'save'}>Mentés</Button></div>
    </div>
  )
}
