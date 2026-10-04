'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'

/**
 * Az üzlet nyilvános foglaló oldalára mutató QR-kód (pult, kirakat, névjegy): előnézet,
 * PNG-letöltés és nyomtatható lap. Teljesen kliens-oldali, nem tárol semmit.
 */
export function BusinessQrCard({ url, businessName, subtitle }: { url: string; businessName: string; subtitle: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Az origin kliens-oldalon töltődik be — relatív URL-ből ne készüljön (beolvashatatlan) QR.
    if (!/^https?:\/\//.test(url)) { setDataUrl(null); return }
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1D1C19', light: '#FFFFFF' } })
      .then((d) => { if (!cancelled) setDataUrl(d) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [url])

  const fileName = `${businessName || 'foglalas'}-qr.png`.replace(/[^\p{L}\p{N}._-]+/gu, '-')

  const print = () => {
    if (!dataUrl) return
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) return
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
    w.document.write(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${esc(businessName)} – QR-kód</title>
<style>
  @page { size: A5; margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1D1C19; text-align: center; margin: 0; }
  .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 92vh; gap: 10px; }
  h1 { font-size: 26px; font-weight: 700; margin: 0; }
  p { font-size: 16px; margin: 0; color: #55524A; }
  img { width: 70mm; height: 70mm; margin: 14px 0; }
  .url { font-size: 12px; color: #86826F; word-break: break-all; }
</style></head><body><div class="wrap">
  <h1>${esc(businessName)}</h1>
  <p>${esc(subtitle)}</p>
  <img src="${dataUrl}" alt="QR-kód" />
  <div class="url">${esc(url)}</div>
</div><script>window.onload = function () { window.focus(); window.print(); };</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-paper p-4 sm:flex-row sm:items-center">
      <div className="flex h-32 w-32 shrink-0 items-center justify-center self-center overflow-hidden rounded-[14px] bg-white sm:self-auto">
        {dataUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={dataUrl} alt="QR-kód a foglaló oldalhoz" className="h-full w-full" />
          : <span className="text-xs text-ink-soft">QR-kód…</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink">QR-kód a foglaló oldalhoz</p>
          <p className="text-xs text-ink-soft">Tedd ki a pultra, kirakatba vagy névjegyre — beolvasva rögtön a foglaló oldal nyílik meg.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={dataUrl ?? undefined}
            download={fileName}
            aria-disabled={!dataUrl}
            className="inline-flex h-10 items-center gap-1.5 rounded-dav-pill border border-line-strong bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Letöltés (PNG)
          </a>
          <button
            type="button"
            onClick={print}
            disabled={!dataUrl}
            className="inline-flex h-10 items-center gap-1.5 rounded-dav-pill bg-ink-dark px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Nyomtatás
          </button>
        </div>
      </div>
    </div>
  )
}
