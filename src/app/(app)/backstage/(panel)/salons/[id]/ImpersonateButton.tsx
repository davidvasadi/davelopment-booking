'use client'

import { LogIn } from 'lucide-react'

export default function ImpersonateButton({ userId }: { userId: string }) {
  return (
    <form method="POST" action="/api/backstage/session-as" target="_blank">
      <input type="hidden" name="userId" value={String(userId)} />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-[22px] bg-ink-dark px-[18px] py-[11px] text-[13.5px] font-semibold text-white"
      >
        <LogIn className="h-4 w-4 text-gold" />
        Belépés owner-ként
      </button>
    </form>
  )
}
