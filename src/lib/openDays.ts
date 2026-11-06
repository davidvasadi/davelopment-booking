/**
 * A foglalóoldal nap-sávja (design 21.x): a következő `n` napból melyiken van legalább egy szabad időpont — a többi
 * sötétebb a sávon (zárva, betelt, vagy ma már elmúlt). Ugyanaz a számítás, mint a napi időpontoké; hetes adagokban,
 * hogy egyszerre ne menjen ki 60 lekérdezés.
 */
export const MAX_OPEN_DAYS = 60
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function openDays(n: number, hasSlots: (date: string) => Promise<boolean>): Promise<string[]> {
  const today = new Date()
  const dates = Array.from({ length: Math.min(Math.max(n, 1), MAX_OPEN_DAYS) }, (_, i) => ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)))
  const open: string[] = []
  for (let i = 0; i < dates.length; i += 7) {
    const chunk = dates.slice(i, i + 7)
    const res = await Promise.all(chunk.map((d) => hasSlots(d).catch(() => true)))
    chunk.forEach((d, j) => { if (res[j]) open.push(d) })
  }
  return open
}
