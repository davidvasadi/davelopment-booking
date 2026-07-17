/**
 * POST  /api/user/avatar — fájl-feltöltés (multipart). Szerver-oldalon hozza létre a media-t
 *   `overrideAccess`-szel a SAJÁT auth (getCurrentUser) alapján, így NEM a Payload /api/media
 *   endpointot hívjuk (az a saját JWT-cookie-t nem mindig olvassa → 403). Utána beállítja az
 *   avatar_url-t. Válasz: { ok, avatar_url }.
 * PATCH /api/user/avatar — csak az URL beállítása/törlése (pl. „Kép eltávolítása").
 *   Body: { avatar_url: string | null }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'invalid-form' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'no-file' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'not-an-image' }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'too-large' }, { status: 400 })

  const payload = await getPayloadClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  let url: string | undefined
  try {
    const media = await payload.create({
      collection: 'media',
      overrideAccess: true,
      user,
      data: { alt: file.name },
      file: { data: buffer, mimetype: file.type, name: file.name, size: file.size },
    })
    url = (media as { url?: string }).url
  } catch (e) {
    console.error('[api/user/avatar POST] media create failed', e)
    return NextResponse.json({ error: 'A kép feltöltése sikertelen.' }, { status: 500 })
  }
  if (!url) return NextResponse.json({ error: 'no-url' }, { status: 500 })

  await payload.update({ collection: 'users', id: user.id, data: { avatar_url: url }, overrideAccess: true })
  return NextResponse.json({ ok: true, avatar_url: url })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { avatar_url?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 })
  }

  const raw = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : ''
  // Csak http(s) URL-t fogadunk el; üres → törlés.
  if (raw && !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'invalid-url' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { avatar_url: raw || null },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, avatar_url: raw || null })
}
