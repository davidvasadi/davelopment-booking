'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export default function SalonNotesForm({ salonId, initialNotes }: { salonId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/backstage/salons/${salonId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast.error('Mentés sikertelen')
      }
    })
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={4}
        placeholder="Belső megjegyzés az ügyfélről..."
        className="w-full resize-none rounded-[22px] border border-line bg-white px-[18px] py-[13px] text-[13.5px] text-ink placeholder:text-ink-soft2 transition-colors focus:border-strong focus:outline-none"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="rounded-[22px] bg-ink-dark px-[18px] py-[9px] text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saved ? 'Mentve ✓' : isPending ? 'Mentés...' : 'Mentés'}
      </button>
    </div>
  )
}
