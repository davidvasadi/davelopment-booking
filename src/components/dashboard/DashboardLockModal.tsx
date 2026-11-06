'use client'

import { usePathname } from 'next/navigation'
import { Overlay } from '@/components/ui-kit'
import { LockedAccountCard } from '@/components/blocks/settings'

// Szalon és étterem dashboard egyaránt — a settings/subscription mindig elérhető marad
const ALLOWED_PATHS = [
  '/dashboard/settings',
  '/dashboard/subscription',
  '/restaurant/settings',
  '/restaurant/subscription',
]

/** A zárolt fiók (lejárt próbaidő, sikertelen fizetés, megszűnt / szünetelő előfizetés) — design 16.5.1: mi történt, mi
 *  marad meg, mi áll (a foglalóoldal nem fogad új foglalást), és egy gomb az Előfizetés lapra. Nincs bezárás. */
export function DashboardLockModal({ status, paid = false }: { status: 'past_due' | 'canceled' | 'paused'; paid?: boolean }) {
  const pathname = usePathname()
  if (ALLOWED_PATHS.some((p) => pathname?.startsWith(p))) return null
  const settingsHref = pathname?.startsWith('/restaurant') ? '/restaurant/settings' : '/dashboard/settings'
  return (
    <Overlay className="z-[60]">
      <LockedAccountCard status={status} paid={paid} href={`${settingsHref}?tab=billing`} className="relative max-sm:rounded-b-none" />
    </Overlay>
  )
}
