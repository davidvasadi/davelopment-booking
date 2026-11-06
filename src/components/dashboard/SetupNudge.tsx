'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, ListChecks, ChevronRight, type LucideIcon } from 'lucide-react'
import { Button, Card, Meta, Panel, SpringPopover, TaskRow } from '@/components/ui-kit'
import { StartPill } from '@/components/blocks/overview'
import type { SetupFlags } from '@/lib/setupFlags'

/**
 * Indulás-pill az Áttekintés címe mellett (a /design 4.2): „Indulás · 1/2” pöttyökkel; kattintásra a pillből
 * kinövő panel a lépésekkel (mindegyik a helyére visz). Csak akkor látszik, ha a nyitvatartás vagy a katalógus
 * (asztal/szolgáltatás) még hiányzik — amint kész, magától eltűnik; elrejthető.
 */
export function SetupNudge({
  variant,
  base,
  flags,
}: {
  variant: 'salon' | 'restaurant'
  /** URL-prefix: '/restaurant' vagy '/dashboard'. */
  base: string
  flags: SetupFlags
}) {
  const [dismissed, setDismissed] = useState(false)

  const catalog: { label: string; href: string } =
    variant === 'restaurant'
      ? { label: 'Asztalok', href: `${base}/tables` }
      : { label: 'Szolgáltatások', href: `${base}/services` }

  const steps: { key: string; label: string; icon: LucideIcon; done: boolean; href: string }[] = [
    { key: 'hours', label: 'Nyitvatartás', icon: Clock, done: flags.openingHours, href: `${base}/availability` },
    { key: 'catalog', label: catalog.label, icon: ListChecks, done: flags.catalog, href: catalog.href },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const pending = steps.filter((s) => !s.done)

  // Kész beállítás → nincs mit tenni; ha a user elrejtette, tiszteljük.
  if (pending.length === 0 || dismissed) return null

  return (
    <SpringPopover trigger={<StartPill done={doneCount} total={steps.length} />}>
      <Panel pad="sm" className="w-[min(380px,calc(100vw-32px))]">
        <Card tone="dark">
          <div className="text-ui-row">Fejezd be a beállítást</div>
          <Meta dark className="mt-0.5">{doneCount} / {steps.length} kész · ezek nélkül a vendégek még nem tudnak online foglalni</Meta>
          <div className="mt-3" data-stagger>
            {steps.map((st) => (
              <Link key={st.key} href={st.href} className="block">
                <TaskRow icon={st.icon} title={st.label} meta={st.done ? 'kész' : 'beállítom →'} done={st.done} />
              </Link>
            ))}
          </div>
        </Card>
        <div className="mt-2 flex justify-between gap-2" data-stagger>
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>Elrejtés</Button>
          <Button size="sm" href={`${base}/tips`} icon={ChevronRight}>Összes lépés</Button>
        </div>
      </Panel>
    </SpringPopover>
  )
}
