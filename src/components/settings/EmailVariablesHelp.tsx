'use client'

import { Info } from 'lucide-react'

/** A visszaigazoló emailben behelyettesíthető változók + emberi nyelvű leírásuk. */
const VARS: Record<'restaurant' | 'salon', { token: string; desc: string }[]> = {
  restaurant: [
    { token: '{{name}}', desc: 'A foglaló vendég neve' },
    { token: '{{date}}', desc: 'A foglalás dátuma' },
    { token: '{{time}}', desc: 'A foglalás időpontja (-tól -ig)' },
    { token: '{{pax}}', desc: 'A vendégek száma (fő)' },
  ],
  salon: [
    { token: '{{name}}', desc: 'A foglaló vendég neve' },
    { token: '{{date}}', desc: 'A foglalás dátuma' },
    { token: '{{time}}', desc: 'A foglalás időpontja (-tól -ig)' },
    { token: '{{service}}', desc: 'A foglalt szolgáltatás neve' },
  ],
}

/** Beilleszthető változók listája — minden tokenhez emberi leírás (i ikonnal). */
export function EmailVariablesHelp({ type }: { type: 'restaurant' | 'salon' }) {
  return (
    <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Info className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
        <p className="text-xs font-medium text-zinc-500 dark:text-white/50">
          Beilleszthető változók — a kiküldéskor a valós adatra cserélődnek
        </p>
      </div>
      <ul className="space-y-1.5">
        {VARS[type].map((v) => (
          <li key={v.token} className="flex items-center gap-2.5 text-xs">
            <code className="shrink-0 px-2 py-1 rounded-md bg-white dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10 font-mono text-zinc-700 dark:text-white/70">
              {v.token}
            </code>
            <span className="text-zinc-500 dark:text-white/45">{v.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
