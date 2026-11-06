'use client'

import { ShieldCheck } from 'lucide-react'
import { Field, Input } from '@/components/ui-kit'
import { SettingsGroup } from '@/components/blocks/settings'
import { safeHttpUrl } from '@/lib/safeUrl'

/** Beállítások › Dokumentumok & jogi: a vállalkozó SAJÁT adatkezelési tájékoztatójának linkje. A vendégadatok
 *  adatkezelője a vállalkozó — a GDPR szerint a vendégnek a foglaláskor el kell érnie a tájékoztatóját; a foglalóoldalon
 *  (a foglalás véglegesítésénél és a láblécben) és a süti-beállításokban jelenik meg. */
export function PrivacyUrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== '' && !safeHttpUrl(value)
  return (
    <SettingsGroup icon={ShieldCheck} title="Adatkezelési tájékoztató">
      <Field label="A saját adatkezelési tájékoztatód linkje" error={bad ? 'Ez nem érvényes link (pl. https://pelda.hu/adatkezeles)' : undefined}
        hint="A vendégeid adatait (név, telefon, e-mail) te kezeled — a vendégnek a foglaláskor el kell érnie a tájékoztatódat. A foglalóoldalon a foglalás véglegesítésénél és az oldal alján jelenik meg. Ha a weboldaladon már van, elég annak a linkje.">
        <Input type="url" inputMode="url" placeholder="https://pelda.hu/adatkezeles" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    </SettingsGroup>
  )
}
