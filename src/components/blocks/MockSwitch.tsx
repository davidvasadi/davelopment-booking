'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/toggle-switch'

/** Mintaképernyők kapcsolója — a valódi Switch, helyi állapottal (a /design és a landing mintái). */
export function MockSwitch({ defaultOn = true }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return <Switch checked={on} onChange={setOn} ariaLabel="Minta kapcsoló" />
}
