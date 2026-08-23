'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Loader2, CameraOff } from 'lucide-react'

/**
 * Kamerás QR-beolvasó a helyszíni utalvány-beváltáshoz. A voucher QR-je a megjelenítő oldal
 * TELJES URL-jét kódolja (`/{slug}/voucher/{kód}`, lásd `src/lib/voucherQr.ts`) — itt csak az
 * utolsó útvonal-szegmenst nyerjük ki, a `XXXX-XXXX` kód-formátumhoz illesztve
 * (`src/lib/voucherCode.ts`). Ha a beolvasott tartalom nem illeszkedik, egyszerűen tovább
 * figyel — nem hibázik minden véletlenül a kamera elé kerülő QR-re.
 */

const CODE_RE = /([A-Z0-9]{4}-[A-Z0-9]{4})(?:[/?#]|$)/i

function extractCode(text: string): string | null {
  const m = text.match(CODE_RE)
  return m ? m[1].toUpperCase() : null
}

export function VoucherQrScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
        tick()
      } catch {
        setError('Nem sikerült elérni a kamerát — engedélyezd a böngészőben, vagy add meg a kódot kézzel.')
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(imageData.data, imageData.width, imageData.height)
          if (result?.data) {
            const code = extractCode(result.data)
            if (code) { onDetected(code); return }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[16px] bg-paper px-4 py-8 text-center">
        <CameraOff className="h-6 w-6 text-ink-soft2" />
        <p className="text-[13px] text-ink-soft">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[16px] bg-black">
      <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-8 rounded-[16px] border-2 border-white/50" />
    </div>
  )
}
