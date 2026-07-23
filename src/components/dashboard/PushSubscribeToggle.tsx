'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Share, Plus } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type Env = 'loading' | 'ios-browser' | 'unsupported' | 'denied' | 'ready'

export function PushSubscribeToggle() {
  const [env, setEnv] = useState<Env>('loading')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true

    if (isIOS && !isStandalone) {
      setEnv('ios-browser')
      return
    }

    const ok =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!ok) { setEnv('unsupported'); return }
    if (Notification.permission === 'denied') { setEnv('denied'); return }

    setEnv('ready')
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
        if (perm === 'denied') setEnv('denied')
        toast.error('Az értesítési engedély nincs megadva')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
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


  const subtitleMap: Record<string, string> = {
    loading: '',
    'ios-browser': 'Azonnal a képernyő sarkában, akkor is, ha az app be van zárva',
    unsupported: 'Ez a böngésző nem támogatja a push értesítéseket.',
    denied: 'Le van tiltva — a böngésző beállításaiban engedélyezd az oldal értesítéseit.',
    ready: 'Azonnal a képernyő sarkában, akkor is, ha az app be van zárva',
  }

  return (
    <div className="rounded-[26px] dav-card-glass px-6 py-2">
      <div className="grid grid-cols-[1fr_84px] items-center gap-2 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">Push értesítések ezen az eszközön</div>
          <div className="mt-0.5 text-[12px] text-ink-soft">{subtitleMap[env]}</div>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={enabled ? disable : enable}
            disabled={busy || env === 'unsupported' || env === 'denied' || env === 'loading'}
            role="switch"
            aria-checked={enabled}
            className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${enabled ? 'bg-ink-dark' : 'bg-[#DAD5C6]'}`}
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

      {env === 'ios-browser' && (
        <div className="border-t border-line pb-4 pt-3">
          <div className="text-[11.5px] text-ink-soft mb-2.5 font-medium">iPhone-on így aktiválod:</div>
          <ol className="space-y-2">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-white text-[10px] font-bold mt-0.5">1</span>
              <span className="text-[12px] text-ink-soft leading-snug">
                Nyomd meg a <Share className="inline h-3 w-3 mb-0.5" /> <strong className="text-ink">Megosztás</strong> gombot Safari aljában
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-white text-[10px] font-bold mt-0.5">2</span>
              <span className="text-[12px] text-ink-soft leading-snug">
                Válaszd a <Plus className="inline h-3 w-3 mb-0.5" /> <strong className="text-ink">Főképernyőhöz adás</strong> lehetőséget
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-white text-[10px] font-bold mt-0.5">3</span>
              <span className="text-[12px] text-ink-soft leading-snug">
                Nyisd meg az appot a főképernyőről — ezután bekapcsolható
              </span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
