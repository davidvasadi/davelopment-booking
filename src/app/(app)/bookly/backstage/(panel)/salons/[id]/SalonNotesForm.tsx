'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export default function SalonNotesForm({ salonId, initialNotes }: { salonId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await fetch(`/api/bookly/backstage/salons/${salonId}/toggle`, {
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
        className="w-full rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-white/[0.2] transition-colors resize-none"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {saved ? 'Mentve ✓' : isPending ? 'Mentés...' : 'Mentés'}
      </button>
    </div>
  )
}
