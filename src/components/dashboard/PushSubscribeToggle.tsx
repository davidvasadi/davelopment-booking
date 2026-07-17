'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

/**
 * PUSH ÉRTESÍTÉSEK — eszköz-szintű be/ki kapcsoló. A böngésző engedélyét kéri, feliratkozik a
 * push-ra (VAPID), és a feliratkozást elküldi a szervernek (/api/push/subscribe). Eszközönként külön:
 * ha a tulaj több gépről dolgozik, mindegyiken be kell kapcsolnia.
 *
 * Megjegyzés: dev módban a service worker-t a ServiceWorkerRegister kivezeti (HMR), ezért itt
 * kapcsoláskor MAGUNK regisztráljuk a /sw.js-t. Tiszta teszthez a prod build (build + start) ajánlott.
 */
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // Explicit ArrayBuffer (nem SharedArrayBuffer) → a BufferSource-hoz kell (TS típus-szigor).
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function PushSubscribeToggle() {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    setSupported(ok)
    if (!ok) return
    setDenied(Notification.permission === 'denied')
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null
        setEnabled(!!sub)
      })
      .catch(() => {})
  }, [])

  async function enable() {
    if (!VAPID_PUBLIC) {
      toast.error('A push nincs konfigurálva (VAPID kulcs hiányzik)')
      return
    }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setDenied(perm === 'denied')
        toast.error('Az értesítési engedély nincs megadva')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // A lib.dom szigorúbb BufferSource-t vár; a Uint8Array valid runtime-érték (cast).
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
      })
      if (!res.ok) throw new Error()
      setEnabled(true)
      toast.success('Push értesítések bekapcsolva ezen az eszközön')
    } catch {
      toast.error('A push bekapcsolása nem sikerült')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe()
      }
      setEnabled(false)
      toast.success('Push értesítések kikapcsolva')
    } catch {
      toast.error('A kikapcsolás nem sikerült')
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => (enabled ? disable() : enable())

  // Ugyanaz a sor-minta, mint az esemény-soroké (grid-cols-[1fr_84px]): a kapcsoló a többivel
  // AZONOS oszlopba kerül. Nincs ikon, nincs teszt — egységes az e-mail-sorokkal.
  return (
    <div className="rounded-[26px] dav-card-glass px-6 py-2">
      <div className="grid grid-cols-[1fr_84px] items-center gap-2 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">Push értesítések ezen az eszközön</div>
          <div className="mt-0.5 text-[12px] text-ink-soft">
            {!supported
              ? 'Ez a böngésző nem támogatja (iPhone-on: tedd ki a kezdőképernyőre).'
              : denied
              ? 'Le van tiltva a böngészőben — a címsor melletti oldal-beállításokban engedélyezd.'
              : 'Azonnal a képernyő sarkában, akkor is, ha az app be van zárva'}
          </div>
        </div>
        <div className="flex justify-center">
          {/* App-stílusú kapcsoló: sötét sáv + ARANY gomb (mint a többi Toggle). */}
          <button
            type="button"
            onClick={toggle}
            disabled={busy || !supported || denied}
            role="switch"
            aria-checked={enabled}
            className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-ink-dark' : 'bg-[#DAD5C6]'}`}
          >
            {busy ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
            ) : (
              <span
                className={`absolute top-[3px] h-[21px] w-[21px] rounded-full shadow-sm transition-all ${enabled ? 'right-[3px] bg-gold' : 'left-[3px] bg-white'}`}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
