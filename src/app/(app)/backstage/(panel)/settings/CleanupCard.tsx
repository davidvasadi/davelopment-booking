'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Loader2, RefreshCw } from 'lucide-react'
import { GLASS_PANEL_LG, FIELD_LABEL } from '@/components/backstage/BackstageUi'

type Report = { orphanMedia: number; emptyOwners: string[] }

/**
 * Adattisztítás-kártya — az árva media + üres owner-fiókok (0 üzlet + 0 sub + 0 staff)
 * kimutatása és törlése. A GET dry-run számol, a POST töröl (megerősítéssel).
 */
export function CleanupCard() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  async function scan() {
    setLoading(true)
    try {
      const res = await fetch('/api/backstage/cleanup')
      if (!res.ok) throw new Error()
      setReport(await res.json())
    } catch { toast.error('A kimutatás nem sikerült.') } finally { setLoading(false) }
  }

  useEffect(() => { scan() }, [])

  async function run() {
    if (!report) return
    const total = report.orphanMedia + report.emptyOwners.length
    if (total === 0) { toast.success('Nincs takarítanivaló.'); return }
    if (!window.confirm(`Biztosan törlöd? ${report.orphanMedia} árva kép és ${report.emptyOwners.length} üres fiók végleg törlődik.`)) return
    setBusy(true)
    try {
      const res = await fetch('/api/backstage/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) throw new Error()
      const r = await res.json()
      toast.success(`Kész: ${r.deletedMedia} kép és ${r.deletedOwners} fiók törölve.`)
      await scan()
    } catch { toast.error('A törlés nem sikerült.') } finally { setBusy(false) }
  }

  const total = report ? report.orphanMedia + report.emptyOwners.length : 0

  return (
    <div className={GLASS_PANEL_LG}>
      <div className="mb-3 flex items-center justify-between">
        <p className={FIELD_LABEL}>Adattisztítás</p>
        <button onClick={scan} disabled={loading} className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft hover:text-ink disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Frissítés
        </button>
      </div>
      <p className="mb-4 text-[13px] text-ink-soft">Az árván maradt képek és az üres (0 üzlet, 0 előfizetés, 0 tagság) owner-fiókok végleges eltávolítása. Élő adat, staff és admin sosem törlődik.</p>

      {loading && !report ? (
        <p className="text-[13px] text-ink-soft">Kimutatás…</p>
      ) : report ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-line bg-white p-4">
              <p className="text-[26px] font-light leading-none tracking-[-0.02em] text-ink">{report.orphanMedia}</p>
              <p className="mt-1.5 text-[12px] text-ink-soft">árva kép (media)</p>
            </div>
            <div className="rounded-[16px] border border-line bg-white p-4">
              <p className="text-[26px] font-light leading-none tracking-[-0.02em] text-ink">{report.emptyOwners.length}</p>
              <p className="mt-1.5 text-[12px] text-ink-soft">üres owner-fiók</p>
            </div>
          </div>
          {report.emptyOwners.length > 0 && (
            <p className="text-[12px] text-ink-soft2">Üres fiókok: {report.emptyOwners.join(', ')}</p>
          )}
          <button
            onClick={run}
            disabled={busy || total === 0}
            className="inline-flex items-center gap-2 rounded-[16px] bg-bad px-[16px] py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? 'Takarítás…' : total === 0 ? 'Nincs takarítanivaló' : `${total} elem törlése`}
          </button>
        </div>
      ) : null}
    </div>
  )
}
