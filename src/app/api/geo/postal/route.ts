import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/geo/postal?code=1052 — magyar irányítószámból a település (a foglaló és a számlázási űrlap tölti ki vele a
 * várost). Forrás: zippopotam.us (nyilvános, kulcs nélküli); a választ a Next 30 napig gyorsítótárazza. Csak 4 jegyű
 * magyar irányítószámra válaszol; ha a szolgáltatás nem elérhető, üres választ ad (a vendég kézzel írja be a várost).
 */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('code') ?? '').trim()
  if (!/^\d{4}$/.test(code)) return NextResponse.json({ city: null })
  try {
    const res = await fetch(`https://api.zippopotam.us/hu/${code}`, { next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return NextResponse.json({ city: null })
    const data = (await res.json()) as { places?: { 'place name'?: string }[] }
    const city = data.places?.[0]?.['place name']?.trim() || null
    return NextResponse.json({ city }, { headers: { 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return NextResponse.json({ city: null })
  }
}
