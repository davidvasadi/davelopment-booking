import 'server-only'
import { cookies } from 'next/headers'
import { LANG_COOKIE, normalizeLocale, type Locale } from './index'

/**
 * A publikus oldal nyelve a `davelopment_lang` cookie-ból (a LangSwitcher állítja).
 * Szerver-komponensekben hívható; az érték propként folyik le a kliens-komponensekbe.
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies()
  return normalizeLocale(jar.get(LANG_COOKIE)?.value)
}
