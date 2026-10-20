// app/google-review-photo/[filename]/route.ts
//
// A Next.js production szerver (`next start`) a `public/` mappa statikus
// fájllistáját csak a processz INDÍTÁSAKOR olvassa be — egy futás közben
// (a napi fetch_rating.py cron által) odamásolt fájl ezért 404-et adna a
// sima `/data/google-review-photos/...` statikus útvonalon, egészen a
// következő PM2-restartig. Ez a route handler minden kérésnél ténylegesen
// a lemezről olvassa a képet, ezért cron-restart nélkül is azonnal
// kiszolgálja az új fotókat. Ugyanaz a minta, mint a davelopment fő
// repóban (frontend/app/google-review-photo/[filename]/route.ts).

import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// A fetch_rating.py kizárólag `{sha1(...)[:16]}.jpg` alakú fájlneveket ír —
// ez a minta zárja ki a path traversalt (../ stb.).
const SAFE_FILENAME = /^[a-f0-9]{16}\.jpg$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!SAFE_FILENAME.test(filename)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'google-review-photos', filename);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
