import { NextRequest } from 'next/server'

/**
 * Beállítások › API & integrációk „Minta-fájl letöltése” (design 16.15.2): egy CSV-minta a foglalás- és vendég-importhoz,
 * olyan fejlécekkel, amiket az import magától felismer (`ALIASES_BY_TYPE.bookings`). Pontosvesszővel, UTF-8 BOM-mal,
 * hogy az Excel is jól nyissa meg.
 */
export function GET(request: NextRequest) {
  const restaurant = request.nextUrl.searchParams.get('kind') === 'restaurant'
  const rows = restaurant
    ? [['Vendég neve', 'E-mail', 'Telefon', 'Dátum', 'Kezdési idő', 'Vendégek száma', 'Megjegyzés'], ['Minta Anna', 'anna@example.com', '+36 30 123 4567', '2026-12-05', '19:00', '4', 'ablak mellé']]
    : [['Vendég neve', 'E-mail', 'Telefon', 'Dátum', 'Kezdési idő', 'Szolgáltatás', 'Munkatárs', 'Megjegyzés'], ['Minta Anna', 'anna@example.com', '+36 30 123 4567', '2026-12-05', '14:00', 'Női hajvágás', 'Viktória', '']]
  const csv = '﻿' + rows.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n') + '\r\n'
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="import-minta.csv"' } })
}
