'use client'

// Telefon-mező a bevált `react-phone-number-input` könyvtárral (a `libphonenumber-js` szerzőjétől):
// NINCS országválasztó — egyetlen mező, ami bármilyen formát elfogad („06 30…”, „+36 30…”,
// „0036 30…”, „+44 7911…”), gépelés közben tagol, és felismeri az országot. A zászló (SVG, így
// Windows alatt is látszik) a mező végén, CSAK felismert országnál úszik be.
// Kifelé ugyanaz az API, mint eddig: `country` (ISO) + `phone` (helyi szám, előhívó nélkül), így
// a hívó oldalak a `${dial} ${phone}` alakot mentik tovább, változatlanul.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import PhoneNumberInput from 'react-phone-number-input/input'
import flags from 'react-phone-number-input/flags'
import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js'

import { ALL, COUNTRIES, DEFAULT_COUNTRY, type Country } from './phoneCountries'
export { COUNTRIES, DEFAULT_COUNTRY, type Country }

const dialOf = (code: string) => ALL.find((c) => c.code === code)?.dial ?? DEFAULT_COUNTRY.dial

/** ország + helyi szám → E.164 („+36301234567”), vagy undefined */
function toE164(country: string, phone: string): string | undefined {
  if (!phone.trim()) return undefined
  const p = parsePhoneNumberFromString(phone.trim().startsWith('+') ? phone : `${dialOf(country)} ${phone}`)
  return p?.number
}

/** E.164 → ország + tagolt helyi szám előhívó nélkül („30 123 4567”) */
function fromE164(value: string): { country: string | null; local: string } {
  const p = parsePhoneNumberFromString(value)
  if (!p) return { country: null, local: value.replace(/^\+\d{1,3}\s?/, '') }
  const intl = p.formatInternational() // „+36 30 123 4567”
  const local = intl.replace(`+${p.countryCallingCode}`, '').trim()
  // a listánkban nem szereplő terület (pl. Guernsey) → a hívókód szerinti ország
  const cc = p.country && ALL.some((c) => c.code === p.country) ? p.country : ALL.find((c) => c.dial === `+${p.countryCallingCode}`)?.code ?? null
  return { country: cc, local }
}

export function PhoneCountryInput({
  country,
  phone,
  onCountryChange,
  onPhoneChange,
  required,
  inputClass = '',
  inputRef,
  onBlur,
  dark = false,
}: {
  country: string
  phone: string
  onCountryChange: (code: string) => void
  onPhoneChange: (phone: string) => void
  required?: boolean
  inputClass?: string
  /** A tényleges szám-inputra mutató ref (pl. fókusz-ugráshoz validációs hibánál). */
  inputRef?: React.Ref<HTMLInputElement>
  /** A szám-input elhagyásakor hívódik (blur-validáláshoz). */
  onBlur?: () => void
  dark?: boolean
}) {
  const [value, setValue] = useState<string | undefined>(() => toE164(country, phone))
  // Amit MI küldtünk ki utoljára (gépelésből) — erre a visszhangra nem szinkronizálunk, különben
  // egy érvénytelen (pl. túl hosszú) számnál a könyvtár és a szinkron egymást hívta végtelenül.
  const lastEmitted = useRef<{ country: string; phone: string } | null>(null)
  // kívülről jövő változás (pl. visszatérő vendég kitöltése, űrlap ürítése) → a mező kövesse
  useEffect(() => {
    const own = lastEmitted.current
    if (own && own.phone === phone && (own.country === country || !phone)) return
    lastEmitted.current = null
    const next = toE164(country, phone)
    if (next !== value) setValue(next)
  }, [country, phone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Túl hosszú szám (az adott országban) → nem fogadjuk el. A `limitMaxLength` ennél az „input”
  // változatnál HATÁSTALAN (csak a zászló-választós komponens ismeri), ezért itt korlátozunk.
  const tooLong = (v?: string) => !!v && validatePhoneNumberLength(v) === 'TOO_LONG'
  // Gépelésnél: ha a következő számjegy már túl hosszúvá tenné, a leütést elnyeljük.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/^\d$/.test(e.key) || e.metaKey || e.ctrlKey) return
    const el = e.currentTarget
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    if (atEnd && value && tooLong(value + e.key)) e.preventDefault()
  }

  const handleChange = (v?: string) => {
    // Ciklus-védelem: ugyanazt az értéket nem küldjük újra a szülőnek.
    if (v === value) return
    // Túl hosszú (pl. beillesztés, középre gépelés) → elutasítjuk, a mező az előző értéken marad.
    if (tooLong(v)) return
    setValue(v)
    if (!v) { lastEmitted.current = { country, phone: '' }; onPhoneChange(''); return }
    const { country: cc, local } = fromE164(v)
    const nextCountry = cc ?? country
    lastEmitted.current = { country: nextCountry, phone: local }
    if (nextCountry !== country) onCountryChange(nextCountry)
    onPhoneChange(local)
  }

  // zászló csak FELISMERT, a listánkban szereplő országnál
  const parsed = value ? parsePhoneNumberFromString(value) : undefined
  const flagCode = parsed?.country ?? (parsed ? fromE164(value!).country : null)
  const Flag = flagCode ? flags[flagCode as CountryCode] : undefined

  return (
    <div className={`flex items-center gap-2.5 ${inputClass}`}>
      <PhoneNumberInput
        ref={inputRef as React.Ref<HTMLInputElement>}
        defaultCountry="HU"
        value={value}
        onKeyDown={onKeyDown}
        onChange={handleChange}
        onBlur={onBlur}
        required={required}
        autoComplete="tel"
        aria-label="Telefonszám"
        title="Megadható 06…, +36… vagy 0036… formában is — az országot a rendszer felismeri."
        placeholder={required ? '06 30 123 4567' : '06 30 123 4567 (opcionális)'}
        className={`h-full min-w-0 flex-1 border-0 bg-transparent p-0 tabular-nums outline-none placeholder:opacity-60 ${dark ? 'text-white' : ''}`}
      />
      <AnimatePresence>
        {Flag && (
          <motion.span
            key={flagCode}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 28 } }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
            className="flex h-[13px] w-5 shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,.08)]"
            title={ALL.find((c) => c.code === flagCode)?.name}
          >
            <Flag title="" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Ugyanaz a telefon-mező EGY szöveges értékkel (`+36 30 123 4567`) — azokhoz az űrlapokhoz,
 * amelyek a számot egyben tárolják (regisztráció, új üzlet, új vendég, kapcsolat).
 */
export function PhoneInput({
  value,
  onChange,
  required,
  inputClass = '',
  dark = false,
}: {
  value: string
  onChange: (full: string) => void
  required?: boolean
  inputClass?: string
  dark?: boolean
  defaultCountry?: string
}) {
  const init = value ? fromE164(parsePhoneNumberFromString(value, 'HU')?.number ?? value) : { country: 'HU', local: '' }
  const [country, setCountry] = useState(init.country ?? 'HU')
  const [local, setLocal] = useState(init.local)
  // ugyanabban az eseményben változhat az ország ÉS a szám → a legfrissebb országgal rakjuk össze
  const countryRef = useRef(country)
  useEffect(() => { if (!value && local) setLocal('') }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const compose = (code: string, loc: string) => (loc.trim() ? `${dialOf(code)} ${loc.trim()}` : '')
  return (
    <PhoneCountryInput
      country={country}
      phone={local}
      required={required}
      inputClass={inputClass}
      dark={dark}
      onCountryChange={(c) => { countryRef.current = c; setCountry(c) }}
      onPhoneChange={(p) => { setLocal(p); onChange(compose(countryRef.current, p)) }}
    />
  )
}
