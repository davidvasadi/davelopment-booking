'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { AsYouType, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js'

/**
 * Az ország szerint formázza a helyi számot GÉPELÉS közben (pl. HU: „30 123 4567"), ÉS
 * levágja a maximális hossz fölötti számjegyeket — így az adott országnak megengedett
 * legtöbb számjegynél tovább nem lehet gépelni (beillesztésnél a max-ra rövidít).
 */
function formatLocalPhone(raw: string, countryCode: string): string {
  const cc = countryCode as CountryCode
  try {
    let digits = raw.replace(/\D/g, '')
    // A max hosszig rövidítjük: amíg TOO_LONG, dobjuk az utolsó számjegyet.
    while (digits.length > 0 && validatePhoneNumberLength(digits, { defaultCountry: cc }) === 'TOO_LONG') {
      digits = digits.slice(0, -1)
    }
    return new AsYouType(cc).input(digits)
  } catch {
    return raw
  }
}

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

/**
 * Telefon-mező zászlós ország-előhívó választóval. A `country` (ISO) és a `phone`
 * (helyi szám) külön kontrollált. A teljes nemzetközi szám: `${dial} ${phone}`.
 */
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = COUNTRIES.find((c) => c.code === country) ?? DEFAULT_COUNTRY

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Nyitáskor üres keresés; szűrés névre és hívókódra (ékezet-érzéketlenül).
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const q = norm(query.trim())
  const filtered = q ? COUNTRIES.filter((c) => norm(c.name).includes(q) || c.dial.includes(q)) : COUNTRIES

  return (
    <div ref={ref} className="relative flex gap-2">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery('') }}
        aria-label={`Országhívó: ${selected.dial}`}
        aria-expanded={open}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm ${dark ? 'border border-white/10 bg-white/[0.06]' : 'border border-zinc-200 bg-zinc-50'} ${inputClass}`}
      >
        <span className={`tabular-nums font-semibold ${dark ? 'text-white' : 'text-zinc-900'}`}>{selected.dial}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        aria-label="Telefonszám"
        placeholder={`Telefonszám${required ? '' : ' (opcionális)'}`}
        value={phone}
        onChange={(e) => onPhoneChange(formatLocalPhone(e.target.value, country))}
        onBlur={onBlur}
        className={`flex-1 min-w-0 ${inputClass}`}
      />
      {open && (
        <div
          data-lenis-prevent
          className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        >
          <div className="p-2 border-b border-zinc-100">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ország keresése…"
              className="w-full h-9 rounded-lg bg-zinc-50 border border-zinc-200 px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">Nincs találat</p>
            ) : filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onCountryChange(c.code); setOpen(false); setQuery('') }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                  c.code === selected.code ? 'bg-zinc-50 font-semibold' : ''
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-zinc-700">{c.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-zinc-400">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
