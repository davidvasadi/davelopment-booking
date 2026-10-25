// A statisztika-időszak emberi olvasásra: „2026. ápr. 29. – okt. 25.” és az összehasonlított
// előző, azonos hosszúságú időszak — a részletek-sidebar ebből írja ki, MIHEZ képest változott.
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

export type PeriodInfo = { label: string; range: string; prevRange: string }

function fmtRange(from: string, to: string): string {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  if (from === to) return format(a, 'yyyy. MMM d.', { locale: hu })
  const sameYear = a.getFullYear() === b.getFullYear()
  return `${format(a, 'yyyy. MMM d.', { locale: hu })} – ${format(b, sameYear ? 'MMM d.' : 'yyyy. MMM d.', { locale: hu })}`
}

export function buildPeriodInfo(
  label: string,
  range: { from: string; to: string; prevFrom: string; prevTo: string },
): PeriodInfo {
  return { label, range: fmtRange(range.from, range.to), prevRange: fmtRange(range.prevFrom, range.prevTo) }
}
