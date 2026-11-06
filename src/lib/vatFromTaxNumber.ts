/**
 * A magyar adószám (`12345678-1-42`) 9. jegye az ÁFA-kód — ebből derül ki az üzlet adózása, nem kell külön választani:
 *  1 = alanyi adómentes (vagy nem ÁFA-alany) → a számlán „AAM”
 *  2 = általános szabályok szerint ÁFA-köteles → 27% (a szalon-szolgáltatások általános kulcsa)
 *  3 = EVA (megszűnt, régi adatban)          → ismeretlen, rákérdezünk
 *  4 = csoportos azonosító, 5 = áfacsoport tagja → ÁFA-köteles → 27%
 * Az adószámot az Előfizetés › Számlázási adatoknál adják meg; a vendég-számlák (Fizetés & számlázás) innen veszik.
 */
export type VatFromTax = { code: 'AAM' | '27'; label: string } | null

export function vatFromTaxNumber(tax: string | null | undefined): VatFromTax {
  const digits = String(tax ?? '').replace(/\D/g, '')
  if (digits.length < 9) return null
  const k = digits[8]
  if (k === '1') return { code: 'AAM', label: 'Alanyi adómentes (AAM)' }
  if (k === '2' || k === '4' || k === '5') return { code: '27', label: 'ÁFA-köteles · 27%' }
  return null
}
