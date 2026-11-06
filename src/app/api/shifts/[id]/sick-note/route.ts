import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { loadManageableShift } from '@/lib/shiftAccess'
import type { SickNote } from '@/payload/payload-types'

/**
 * Táppénzes papír egy „Beteg” beosztáshoz (Naptár nap-szerkesztő, design 11.5). Egészségügyi adat: a fájl a nem
 * nyilvános `uploads-private/sick-notes` mappában van, csak itt érhető el — beosztás-kezelési joggal (a saját
 * napjánál a munkatárs is letöltheti).
 * GET    — letöltés
 * POST   — feltöltés (multipart, `file`; PDF vagy kép, max. 10 MB) — a korábbit lecseréli
 * DELETE — törlés
 */
const DIR = path.join(process.cwd(), 'uploads-private/sick-notes')
const MAX = 10 * 1024 * 1024
const relId = (v: unknown) => (v == null ? null : typeof v === 'object' ? (v as { id: string | number }).id : (v as string | number))

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const loaded = await loadManageableShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const noteId = relId(loaded.shift.sick_note)
  if (!noteId) return NextResponse.json({ error: 'Nincs feltöltött papír' }, { status: 404 })
  const note = (await loaded.payload.findByID({ collection: 'sick-notes', id: noteId, depth: 0, overrideAccess: true }).catch(() => null)) as SickNote | null
  if (!note?.filename) return NextResponse.json({ error: 'Nincs feltöltött papír' }, { status: 404 })
  const file = await readFile(path.join(DIR, path.basename(note.filename))).catch(() => null)
  if (!file) return NextResponse.json({ error: 'A fájl nem található' }, { status: 404 })
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': note.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(note.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const loaded = await loadManageableShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (loaded.isSelfOnly) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 })

  let file: File | null = null
  try {
    const f = (await req.formData()).get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Nincs fájl' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'A fájl legfeljebb 10 MB lehet' }, { status: 400 })

  const { payload, shift, bizType, bizId } = loaded
  const old = relId(shift.sick_note)
  const note = (await payload.create({
    collection: 'sick-notes',
    data: { [bizType]: /^\d+$/.test(String(bizId)) ? Number(bizId) : bizId } as never,
    file: { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type || 'application/octet-stream', name: file.name, size: file.size },
    overrideAccess: true,
  })) as SickNote
  await payload.update({ collection: 'shifts', id, data: { sick_note: note.id } as never, overrideAccess: true, user })
  if (old) await payload.delete({ collection: 'sick-notes', id: old, overrideAccess: true }).catch(() => null)
  return NextResponse.json({ ok: true, note: { filename: note.filename, mimeType: note.mimeType, filesize: note.filesize } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const loaded = await loadManageableShift(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (loaded.isSelfOnly) return NextResponse.json({ error: 'Nincs jogosultság' }, { status: 403 })
  const old = relId(loaded.shift.sick_note)
  await loaded.payload.update({ collection: 'shifts', id, data: { sick_note: null } as never, overrideAccess: true, user })
  if (old) await loaded.payload.delete({ collection: 'sick-notes', id: old, overrideAccess: true }).catch(() => null)
  return NextResponse.json({ ok: true })
}
