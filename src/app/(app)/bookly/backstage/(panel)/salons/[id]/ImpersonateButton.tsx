'use client'

import { LogIn } from 'lucide-react'

export default function ImpersonateButton({ userId }: { userId: string }) {
  return (
    <form method="POST" action="/api/bookly/backstage/session-as" target="_blank">
      <input type="hidden" name="userId" value={String(userId)} />
      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        <LogIn className="h-4 w-4" />
        Belépés owner-ként
      </button>
    </form>
  )
}
