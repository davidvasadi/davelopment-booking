'use client'

import { useState, useTransition } from 'react'

interface Props {
  salonId: string
  isActive: boolean
}

export default function SalonToggle({ salonId, isActive }: Props) {
  const [active, setActive] = useState(isActive)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !active
    setActive(next)
    startTransition(async () => {
      const res = await fetch(`/api/bookly/backstage/salons/${salonId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) setActive(!next)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
        active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
      aria-label={active ? 'Deaktiválás' : 'Aktiválás'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          active ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
