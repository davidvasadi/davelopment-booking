'use client'

import { Gift } from 'lucide-react'
import { PageHead, Pill } from '@/components/ui-kit'
import { PartnerProgramBody } from '@/components/settings/ReferralPanel'

/** Partnerprogram — szalon és étterem (design 20.1, egyelőre a davelopment-jutalék nélkül): az ajánló program saját
 *  oldala. Csak a tulajnak (a menüből rejtve a többieknek, a route is ellenőrzi). */
export function PartnerProgramView() {
  return (
    <div className="p-4 lg:p-0">
      <div className="max-lg:hidden">
        <PageHead title="Partnerprogram" actions={<Pill tone="yellow" icon={Gift}>+1 hónap ingyen előfizetőnként</Pill>} />
      </div>
      <div className="mb-4 lg:hidden">
        <div className="text-ui-num font-light leading-none text-ui-text">Partnerprogram</div>
      </div>
      <PartnerProgramBody />
    </div>
  )
}
