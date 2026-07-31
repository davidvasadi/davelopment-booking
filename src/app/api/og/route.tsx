import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

async function svgToPng(filename: string, width: number): Promise<string> {
  const svgPath = path.join(process.cwd(), 'public', filename)
  const svgBuffer = fs.readFileSync(svgPath)
  const png = await sharp(svgBuffer, { density: 150 }).resize({ width }).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

async function urlToJpeg(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  const jpeg = await sharp(buf).jpeg({ quality: 85 }).toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

async function urlToPng(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  const png = await sharp(buf).resize({ height: 72 }).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name      = searchParams.get('name')  ?? 'davelopment booking'
  const city      = searchParams.get('city')  ?? ''
  const coverUrl  = searchParams.get('image') ?? ''
  const logoUrl   = searchParams.get('logo')  ?? ''

  const [brandLogo, coverData, salonLogo] = await Promise.all([
    svgToPng('logo_davelopment_booking_dark.svg', 160),
    coverUrl ? urlToJpeg(coverUrl).catch(() => '') : Promise.resolve(''),
    logoUrl  ? urlToPng(logoUrl).catch(() => '')  : Promise.resolve(''),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1200px',
          height: '630px',
          position: 'relative',
          background: '#111',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Cover fotó */}
        {coverData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverData}
            alt=""
            width={1200}
            height={630}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
          />
        )}

        {/* Sötét felül (logóhoz) + sötét alul (szöveghez) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.78) 100%)',
            display: 'flex',
          }}
        />

        {/* davelopment booking logó — jobb felső (dark = fehér szöveg) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandLogo}
          alt="davelopment booking"
          width={160}
          height={59}
          style={{ position: 'absolute', top: 36, right: 48, opacity: 0.9 }}
        />

        {/* Bal alsó — szalon logó + neve + város */}
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            left: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {salonLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salonLogo}
              alt=""
              height={56}
              style={{ maxWidth: '200px', objectFit: 'contain', marginBottom: 4 }}
            />
          )}
          <div
            style={{
              color: '#ffffff',
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              maxWidth: '860px',
              display: 'flex',
            }}
          >
            {name}
          </div>
          {city && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 24, display: 'flex' }}>
              {city}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
