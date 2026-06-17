import type { AccountBilling } from '@/lib/accountBilling'
import { cn } from '@/lib/utils'

/**
 * Fiók-szintű előfizetés-összegző. A /subscription oldalakon jelenik meg, HA a fióknak több
 * üzlete van: a fiók összes üzlete + a típus szerinti egységár, alul az összevont havidíj.
 * Egy fiók = egy előfizetés (egy számla); ez a blokk az üzlet-bontást mutatja.
 */
export function AccountBillingSummary({
  billing,
  activeKey,
}: {
  billing: AccountBilling
  /** Az aktív üzlet "<type>:<id>" kulcsa — kiemeléshez. */
  activeKey?: string | null
}) {
  // Egyetlen üzletnél nincs mit összegezni.
  if (billing.count <= 1) return null

  const onTrial = billing.accountStatus === 'trialing'

  return (
    <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest">A fiókod üzletei</p>
        <p className="text-sm text-zinc-500 dark:text-white/40 mt-0.5">
          Egy összevont előfizetés — az üzletek díjai egy számlában adódnak össze.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
        {billing.items.map((it) => {
          const isActive = `${it.type}:${it.id}` === activeKey
          return (
            <li key={`${it.type}:${it.id}`} className="px-5 py-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{it.name}</span>
                  {isActive && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black px-1.5 py-0.5">
                      Aktív
                    </span>
                  )}
                </div>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-white/30">
                  {it.type === 'restaurant' ? 'Étterem' : 'Szalon'}
                </span>
              </div>
              <span className="shrink-0 w-24 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">
                {it.feeHuf.toLocaleString('hu-HU')} Ft
              </span>
            </li>
          )
        })}
      </ul>

      <div className="px-5 py-4 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between bg-zinc-50/60 dark:bg-white/[0.02]">
        <span className="text-sm font-semibold text-zinc-600 dark:text-white/60">
          {onTrial ? 'Várható havidíj' : 'Összesen'} <span className="text-zinc-400 dark:text-white/30">({billing.count} üzlet)</span>
        </span>
        <span className="text-base font-black tabular-nums text-zinc-900 dark:text-white">
          {billing.totalMonthlyHuf.toLocaleString('hu-HU')} Ft<span className="text-xs font-medium text-zinc-400 dark:text-white/30">/hó</span>
        </span>
      </div>

      {onTrial && (
        <div className="px-5 py-2.5 border-t border-zinc-100 dark:border-white/[0.06] text-xs text-zinc-400 dark:text-white/30">
          Próbaidőszak alatt még nincs levonás — a fenti összeg a próba után lép életbe.
        </div>
      )}
    </div>
  )
}
