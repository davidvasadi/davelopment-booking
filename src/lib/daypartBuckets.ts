/**
 * Napszak-bontás: az óránkénti forgalmat 5 napszakba vonja össze (Reggel/Délelőtt/Délután/
 * Este/Éjszaka). Szándékosan KÜLÖN, "könnyű" fájlban (nincs Payload-import) — a
 * `lib/dashboardStats.ts` a `getPayloadClient`-en keresztül szerver-only kódot (payload.config →
 * revalidatePath) húz be, ami egy 'use client' komponensbe (DashboardCharts.tsx) importálva a
 * teljes payload-láncot a kliens-bundle-be szivárogtatná.
 */
export function daypartBuckets(data: { hour: string; bookings: number }[]): { label: string; bookings: number }[] {
  const DAYPARTS: { label: string; from: number; to: number }[] = [
    { label: 'Reggel', from: 5, to: 9 },
    { label: 'Délelőtt', from: 9, to: 12 },
    { label: 'Délután', from: 12, to: 17 },
    { label: 'Este', from: 17, to: 22 },
    { label: 'Éjszaka', from: 22, to: 29 }, // 22–24 + 0–5 (mod 24)
  ]
  const hourVal = (h: number) => data.find((d) => parseInt(d.hour, 10) === (h % 24))?.bookings ?? 0
  return DAYPARTS.map((p) => {
    let sum = 0
    for (let h = p.from; h < p.to; h++) sum += hourVal(h)
    return { label: p.label, bookings: sum }
  })
}
