import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

async function svgToPng(filename: string, width: number): Promise<string> {
  const svgPath = path.join(process.cwd(), 'public', filename)
  const svgBuffer = fs.readFileSync(svgPath)
  const png = await sharp(svgBuffer, { density: 300 }).resize({ width }).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

/**
 * `?title=` opcionális — az iparági landingek (lásd `[slug]/page.tsx`) a saját H1-jüket adják át,
 * hogy megosztáskor (Facebook/LinkedIn/WhatsApp/Ads-előnézet) ne a puszta logó jelenjen meg, hanem
 * az adott oldalra jellemző cím. `?title=` nélkül a homepage-alapértelmezett, tiszta logós kép jön
 * ki — a homepage `generateMetadata`-ja nem küld title paramétert, ez a viselkedés változatlan.
 */
export async function GET(request: NextRequest) {
  const title = new URL(request.url).searchParams.get('title')

  if (!title) {
    const logo = await svgToPng('logo_davelopment_booking_light.svg', 560)
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '1200px',
            height: '630px',
            background: '#F7F7F7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="davelopment booking" width={560} style={{ objectFit: 'contain' }} />
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }

  const logo = await svgToPng('logo_davelopment_booking_dark.svg', 320)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '1200px',
          height: '630px',
          padding: '64px',
          background: 'linear-gradient(241deg, #141210 2.7%, #1e1b14 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="davelopment booking" width={320} style={{ objectFit: 'contain' }} />
        <div
          style={{
            display: 'flex',
            color: '#f5f5f5',
            fontSize: 58,
            fontWeight: 300,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            maxWidth: '1050px',
          }}
        >
          {title}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
