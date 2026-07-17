import { hu as huDate, enUS, de as deDate, es as esDate, it as itDate, fr as frDate } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'
import { hu } from './hu'
import { en } from './en'
import { de } from './de'
import { es } from './es'
import { it } from './it'
import { fr } from './fr'

/** Támogatott nyelvek a publikus foglalón. */
export type Locale = 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr'
export const LOCALES: Locale[] = ['hu', 'en', 'de', 'es', 'it', 'fr']
export const DEFAULT_LOCALE: Locale = 'hu'

/** Nyelv → emberi felirat a kapcsolóhoz (a kód maga). */
export const LOCALE_LABELS: Record<Locale, string> = {
  hu: 'HU', en: 'EN', de: 'DE', es: 'ES', it: 'IT', fr: 'FR',
}

/** A `davelopment_lang` cookie neve — a vendég-kapcsoló ezt állítja. */
export const LANG_COOKIE = 'davelopment_lang'

const DICTS: Record<Locale, Record<string, string>> = { hu, en, de, es, it, fr }

/** Ismeretlen/üres értékből biztonságos Locale (csak a támogatottak közül). */
export function normalizeLocale(v: string | null | undefined): Locale {
  return v && (LOCALES as string[]).includes(v) ? (v as Locale) : 'hu'
}

/**
 * Fordít: kulcs → string a megadott nyelven, `{{var}}` interpolációval.
 * Hiányzó kulcsnál a magyar szótárra esik vissza, végső soron a kulcsra (fejlesztői jelzés).
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let str = DICTS[locale]?.[key] ?? DICTS.hu[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v))
    }
  }
  return str
}

/** Egy locale-hoz kötött fordító (kliens-komponensben kényelmes: `const tt = makeT(locale)`). */
export function makeT(locale: Locale) {
  return (key: string, params?: Record<string, string | number>) => t(locale, key, params)
}

/** date-fns locale objektum a `format(...)` hívásokhoz. */
export function dfLocale(locale: Locale): DateFnsLocale {
  switch (locale) {
    case 'en': return enUS
    case 'de': return deDate
    case 'es': return esDate
    case 'it': return itDate
    case 'fr': return frDate
    default: return huDate
  }
}

/**
 * A támogatott nyelvek listája egy `supported_locales` mezőből: HU mindig az első (fix alap),
 * majd a tulaj által bekapcsoltak (csak érvényesek, dedup, HU nélkül duplázva).
 */
export function resolveAvailableLocales(supported: (string | null | undefined)[] | null | undefined): Locale[] {
  const extras = (supported ?? [])
    .map((v) => (v && (LOCALES as string[]).includes(v) ? (v as Locale) : null))
    .filter((v): v is Locale => v !== null && v !== 'hu')
  return ['hu', ...Array.from(new Set(extras))]
}

// MEGJEGYZÉS: a `pickLocalized`/`localizeItems` (régi `_en` mezős feloldás) megszűnt — a tulaj-content
// mostantól Payload-localized mezőkből jön (find/findByID `locale` + `fallbackLocale: 'hu'`), így a
// `title`/`body`/email-szöveg már a vendég nyelvén érkezik, üres nyelvnél HU fallbackkel.
