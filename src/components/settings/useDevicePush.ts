'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * Telefonos (push) értesítés EZEN az eszközön — a Beállítások › Értesítések sötét kártyájához (design 16.18).
 * Állapotok: `ios-browser` (iPhone Safari: előbb a főképernyőre kell tenni), `unsupported`, `denied` (a böngészőben
 * letiltva), `ready` (`enabled`: fel van-e iratkozva). Mellette az app-telepítés: Androidon / asztalon a böngésző
 * telepítő-ablaka (`canInstall` → `install()`), telepítve `installed`.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PushEnv = 'loading' | 'ios-browser' | 'unsupported' | 'denied' | 'ready'

export function useDevicePush() {
  const [env, setEnv] = useState<PushEnv>('loading')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)

    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone) setEnv('ios-browser')
    else if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) setEnv('unsupported')
    else if (Notification.permission === 'denied') setEnv('denied')
    else {
      setEnv('ready')
      navigator.serviceWorker.getRegistration()
        .then(async (reg) => setEnabled(!!(reg ? await reg.pushManager.getSubscription() : null)))
        .catch(() => {})
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function enable() {
    if (!VAPID_PUBLIC) { toast.error('A push nincs beállítva a szerveren'); return }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { if (perm === 'denied') setEnv('denied'); toast.error('Az értesítési engedély nincs megadva'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }) })
      if (!res.ok) throw new Error()
      setEnabled(true); toast.success('Telefonos értesítés bekapcsolva ezen az eszközön')
    } catch { toast.error('A bekapcsolás nem sikerült') } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
        await sub.unsubscribe()
      }
      setEnabled(false); toast.success('Telefonos értesítés kikapcsolva')
    } catch { toast.error('A kikapcsolás nem sikerült') } finally { setBusy(false) }
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return { env, enabled, busy, enable, disable, installed, canInstall: !!prompt && !installed, install }
}
