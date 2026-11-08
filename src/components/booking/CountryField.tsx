'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { countryOptions, isForeignCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'

/**
 * A számlázási ország a foglalóoldal űrlapjain (szalon / étterem — előleg és utalvány): a vendég nyelvén, Magyarország
 * elöl. Külföldi országnál alatta a megjegyzés, hogy csak magánszemélyként vásárolhat (a céges vásárlás eltűnik).
 * A mező stílusa a hívóé (`inputCls`, `metaCls`), mint a többi mezőnél.
 */
export function CountryField({ value, onChange, locale, tt, inputCls, metaCls, required = false, error }: {
  value: string; onChange: (code: string) => void; locale: string; tt: (k: string) => string
  inputCls: string; metaCls: string; required?: boolean; error?: string | null
}) {
  const options = useMemo(() => countryOptions(locale), [locale])
  return (
    <div className={cn('space-y-1', error && 'animate-shake')}>
      <Label className={`text-ui-label ${metaCls}`}>{tt('booking.field.country')}{required ? ' *' : ''}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} autoComplete="country" aria-invalid={!!error}
        className={cn(inputCls, 'w-full', error && 'ring-1 ring-red-400')}>
        <option value="" className="text-ui-text">{tt('booking.field.countryChoose')}</option>
        {options.map((o) => <option key={o.code} value={o.code} className="text-ui-text">{o.name}</option>)}
      </select>
      {error ? <p role="alert" className="text-ui-label text-red-400">{error}</p>
        : isForeignCountry(value) && <p className={`text-ui-label ${metaCls}`}>{tt('booking.field.countryForeign')}</p>}
    </div>
  )
}
