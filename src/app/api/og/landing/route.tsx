import { ImageResponse } from 'next/og'
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

export async function GET() {
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
