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
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/** Ország + nemzetközi előhívó. A `code` az ISO-2 (statisztikához), a `dial` a hívókód. */
export type Country = { code: string; name: string; dial: string }

// Kiemelt országok (leggyakoribb vendég-nemzetiségek) — ezek kerülnek a lista elejére.
const FEATURED = ['HU', 'GB', 'IT', 'ES', 'DE', 'US', 'SK']

// Teljes ország-lista magyar névvel + hívókóddal (ABC-rendben). A megjelenítéskor a
// FEATURED országok előre rendeződnek, a többi marad ABC-sorrendben.
const ALL: Country[] = [
  { code: 'AF', name: 'Afganisztán', dial: '+93' },
  { code: 'AL', name: 'Albánia', dial: '+355' },
  { code: 'DZ', name: 'Algéria', dial: '+213' },
  { code: 'AD', name: 'Andorra', dial: '+376' },
  { code: 'AO', name: 'Angola', dial: '+244' },
  { code: 'AR', name: 'Argentína', dial: '+54' },
  { code: 'AM', name: 'Örményország', dial: '+374' },
  { code: 'AU', name: 'Ausztrália', dial: '+61' },
  { code: 'AT', name: 'Ausztria', dial: '+43' },
  { code: 'AZ', name: 'Azerbajdzsán', dial: '+994' },
  { code: 'BH', name: 'Bahrein', dial: '+973' },
  { code: 'BD', name: 'Banglades', dial: '+880' },
  { code: 'BY', name: 'Fehéroroszország', dial: '+375' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'BA', name: 'Bosznia-Hercegovina', dial: '+387' },
  { code: 'BR', name: 'Brazília', dial: '+55' },
  { code: 'BG', name: 'Bulgária', dial: '+359' },
  { code: 'CA', name: 'Kanada', dial: '+1' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'CN', name: 'Kína', dial: '+86' },
  { code: 'CO', name: 'Kolumbia', dial: '+57' },
  { code: 'CR', name: 'Costa Rica', dial: '+506' },
  { code: 'HR', name: 'Horvátország', dial: '+385' },
  { code: 'CY', name: 'Ciprus', dial: '+357' },
  { code: 'CZ', name: 'Csehország', dial: '+420' },
  { code: 'DK', name: 'Dánia', dial: '+45' },
  { code: 'EG', name: 'Egyiptom', dial: '+20' },
  { code: 'EE', name: 'Észtország', dial: '+372' },
  { code: 'FI', name: 'Finnország', dial: '+358' },
  { code: 'FR', name: 'Franciaország', dial: '+33' },
  { code: 'GE', name: 'Grúzia', dial: '+995' },
  { code: 'DE', name: 'Németország', dial: '+49' },
  { code: 'GR', name: 'Görögország', dial: '+30' },
  { code: 'HK', name: 'Hongkong', dial: '+852' },
  { code: 'HU', name: 'Magyarország', dial: '+36' },
  { code: 'IS', name: 'Izland', dial: '+354' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'ID', name: 'Indonézia', dial: '+62' },
  { code: 'IE', name: 'Írország', dial: '+353' },
  { code: 'IL', name: 'Izrael', dial: '+972' },
  { code: 'IT', name: 'Olaszország', dial: '+39' },
  { code: 'JP', name: 'Japán', dial: '+81' },
  { code: 'JO', name: 'Jordánia', dial: '+962' },
  { code: 'KZ', name: 'Kazahsztán', dial: '+7' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'KR', name: 'Dél-Korea', dial: '+82' },
  { code: 'KW', name: 'Kuvait', dial: '+965' },
  { code: 'LV', name: 'Lettország', dial: '+371' },
  { code: 'LB', name: 'Libanon', dial: '+961' },
  { code: 'LT', name: 'Litvánia', dial: '+370' },
  { code: 'LU', name: 'Luxemburg', dial: '+352' },
  { code: 'MY', name: 'Malajzia', dial: '+60' },
  { code: 'MT', name: 'Málta', dial: '+356' },
  { code: 'MX', name: 'Mexikó', dial: '+52' },
  { code: 'MD', name: 'Moldova', dial: '+373' },
  { code: 'MC', name: 'Monaco', dial: '+377' },
  { code: 'ME', name: 'Montenegró', dial: '+382' },
  { code: 'MA', name: 'Marokkó', dial: '+212' },
  { code: 'NL', name: 'Hollandia', dial: '+31' },
  { code: 'NZ', name: 'Új-Zéland', dial: '+64' },
  { code: 'NG', name: 'Nigéria', dial: '+234' },
  { code: 'MK', name: 'Észak-Macedónia', dial: '+389' },
  { code: 'NO', name: 'Norvégia', dial: '+47' },
  { code: 'PK', name: 'Pakisztán', dial: '+92' },
  { code: 'PH', name: 'Fülöp-szigetek', dial: '+63' },
  { code: 'PL', name: 'Lengyelország', dial: '+48' },
  { code: 'PT', name: 'Portugália', dial: '+351' },
  { code: 'QA', name: 'Katar', dial: '+974' },
  { code: 'RO', name: 'Románia', dial: '+40' },
  { code: 'RU', name: 'Oroszország', dial: '+7' },
  { code: 'SA', name: 'Szaúd-Arábia', dial: '+966' },
  { code: 'RS', name: 'Szerbia', dial: '+381' },
  { code: 'SG', name: 'Szingapúr', dial: '+65' },
  { code: 'SK', name: 'Szlovákia', dial: '+421' },
  { code: 'SI', name: 'Szlovénia', dial: '+386' },
  { code: 'ZA', name: 'Dél-Afrika', dial: '+27' },
  { code: 'ES', name: 'Spanyolország', dial: '+34' },
  { code: 'SE', name: 'Svédország', dial: '+46' },
  { code: 'CH', name: 'Svájc', dial: '+41' },
  { code: 'TW', name: 'Tajvan', dial: '+886' },
  { code: 'TH', name: 'Thaiföld', dial: '+66' },
  { code: 'TR', name: 'Törökország', dial: '+90' },
  { code: 'UA', name: 'Ukrajna', dial: '+380' },
  { code: 'AE', name: 'Egyesült Arab Emírségek', dial: '+971' },
  { code: 'GB', name: 'Egyesült Királyság', dial: '+44' },
  { code: 'US', name: 'Egyesült Államok', dial: '+1' },
  { code: 'VN', name: 'Vietnám', dial: '+84' },
]

// FEATURED elöl (a megadott sorrendben), utána a többi név szerint ABC-ben.
export const COUNTRIES: Country[] = [
  ...FEATURED.map((code) => ALL.find((c) => c.code === code)!).filter(Boolean),
  ...ALL.filter((c) => !FEATURED.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, 'hu')),
]

export const DEFAULT_COUNTRY = COUNTRIES[0] // HU

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

  const handleChange = (v?: string) => {
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
        // az adott ország leghosszabb számánál több számjegyet nem enged beírni
        limitMaxLength
        value={value}
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
