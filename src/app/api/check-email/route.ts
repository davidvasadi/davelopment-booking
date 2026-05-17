import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

const attempts = new Map<string, { count: number; resetAt: number }>()

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra 1 perc múlva.' }, { status: 429 })
  }

  const { email } = await req.json()
  if (!email) return NextResponse.json({ exists: false })

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return NextResponse.json({ exists: result.totalDocs > 0 })
}
