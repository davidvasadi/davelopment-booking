'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Check, Share, Plus, Loader2, MoreVertical } from 'lucide-react'

// Chrome/Edge beforeinstallprompt event — not yet in TS lib
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'desktop'
type PwaState = 'loading' | 'installed' | 'ready'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function StepList({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-dark text-white text-[10px] font-bold mt-0.5">
            {i + 1}
          </span>
          <span className="text-[12px] text-ink-soft leading-snug">{step}</span>
        </li>
      ))}
    </ol>
  )
}

const BENEFITS = [
  'Ikon kerül a telefon főképernyőjére vagy az asztali gépre — úgy nyitod, mint egy natív appot',
  'Nincs böngésző-sáv: teljes képernyős, gyorsabb élmény',
  'Push értesítések bekapcsolhatók — új foglalás azonnal megérkezik',
]

export function PwaInstallCard() {
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [state, setState] = useState<PwaState>('loading')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true

    const p = detectPlatform()
    setPlatform(p)

    if (isStandalone) { setState('installed'); return }

    if (p === 'ios') { setState('ready'); return }

    // Android és asztali Chrome/Edge egyaránt tüzeli a beforeinstallprompt-ot
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    setState('ready')

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!installPrompt) return
    setBusy(true)
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setState('installed')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || platform === null) return null

  const isInstalled = state === 'installed'

  return (
    <div className="rounded-[26px] dav-card-glass px-6 py-5">
      {/* Fejléc */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-ink-dark">
          <Smartphone className="h-[19px] w-[19px] text-gold" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">Alkalmazásként telepíthető</span>
            {isInstalled && (
              <span className="flex items-center gap-1 rounded-full bg-[#1D9D63]/10 px-2 py-[3px] text-[11px] font-semibold text-[#1D9D63]">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Telepítve
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-soft">
            {isInstalled
              ? 'Az app a főképernyőről fut — értesítések alább kapcsolhatók be.'
              : 'Telepítsd a rendszert a telefonodra — pontosan úgy működik, mint egy natív alkalmazás.'}
          </div>
        </div>
      </div>

      {/* Előnyök — nem telepített állapotban */}
      {!isInstalled && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft2">Mit kapsz vele</p>
          <ul className="space-y-2">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span className="text-[12px] text-ink-soft leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* iOS — lépések */}
      {!isInstalled && platform === 'ios' && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-3 text-[11.5px] font-medium text-ink-soft">
            Így telepíted iPhone / iPad eszközre <strong className="text-ink">(Safari szükséges)</strong>:
          </p>
          <StepList steps={[
            <><Share className="inline h-3 w-3 mb-0.5" /> Nyomd meg a <strong className="text-ink">Megosztás</strong> gombot Safari aljában</>,
            <><Plus className="inline h-3 w-3 mb-0.5" /> Válaszd a <strong className="text-ink">Főképernyőhöz adás</strong> lehetőséget</>,
            <>Koppints a <strong className="text-ink">Hozzáadás</strong> gombra a jobb felső sarokban</>,
            <>Nyisd meg az appot a főképernyőről — ezután a push értesítések is bekapcsolhatók</>,
          ]} />
        </div>
      )}

      {/* Android — install gomb ha Chrome tüzeli, egyébként kézi lépések */}
      {!isInstalled && platform === 'android' && (
        <div className="mt-4 border-t border-line pt-4">
          {installPrompt ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={install}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-[16px] bg-ink-dark px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Smartphone className="h-4 w-4 text-gold" strokeWidth={1.8} />
                }
                Alkalmazás telepítése
              </button>
              <span className="text-[12px] text-ink-soft">A böngésző install ablakát nyitja meg</span>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[11.5px] font-medium text-ink-soft">
                Így telepíted Android eszközre <strong className="text-ink">(Chrome szükséges)</strong>:
              </p>
              <StepList steps={[
                <><MoreVertical className="inline h-3 w-3 mb-0.5" /> Nyomd meg a <strong className="text-ink">három pontos menüt</strong> Chrome jobb felső sarkában</>,
                <>Válaszd az <strong className="text-ink">Alkalmazás telepítése</strong> lehetőséget (vagy: Főképernyőhöz adás)</>,
                <>Koppints a <strong className="text-ink">Telepítés</strong> gombra a megjelenő ablakban</>,
              ]} />
            </>
          )}
        </div>
      )}

      {/* Asztali böngésző — install gomb ha Chrome/Edge tüzeli, egyébként info */}
      {!isInstalled && platform === 'desktop' && (
        <div className="mt-4 border-t border-line pt-4">
          {installPrompt ? (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={install}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-[16px] bg-ink-dark px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Smartphone className="h-4 w-4 text-gold" strokeWidth={1.8} />
                }
                Alkalmazás telepítése
              </button>
              <span className="text-[12px] text-ink-soft">Asztali appként is felrakható</span>
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft leading-relaxed">
              Nyisd meg az oldalt <strong className="text-ink">iPhone-on Safariban</strong> vagy <strong className="text-ink">Androidon / asztali gépen Chrome-ban</strong>, és ott jelenik meg a telepítési lehetőség.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
