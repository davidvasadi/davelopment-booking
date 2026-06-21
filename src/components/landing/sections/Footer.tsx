import Link from 'next/link'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { LandingButton } from '@/components/landing/LandingButton'
import { JoinWord } from '@/components/landing/JoinWord'

/** Sötét lábléc: márka-blokk, gyors linkek, regisztráció-CTA és a nagy „Csatlakozz" felirat. */
export function Footer({ trial_days }: { trial_days: number }) {
  return (
    <footer className="bg-brand-ink text-white overflow-hidden m-2 rounded-xl mt-2">
      <div className="mx-auto px-6 lg:px-10 pt-20 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="max-w-md">
            <SchedulioLogo variant="dark" className="h-12" />
            <p className="mt-4 text-5xl font-bold tracking-tight">Online Időpontfoglaló.</p>
            <div className="text-white/70">
              <p className="mt-4 tracking-tight">
                Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra figyelj. Éttermeknek,
                fodrászatoknak, kis vállalkozásoknak. Próbáld ki {trial_days} napig ingyen.
              </p>
              <p className="mt-4 tracking-tight">©2026 Schedulio · hello@schedulio.hu</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-lg font-semibold uppercase tracking-wider mb-3">Gyors linkek</p>
              <ul className="space-y-2 text-md text-white/70">
                <li>
                  <a href="#hogyan" className="hover:text-white transition-colors">
                    Hogyan működik
                  </a>
                </li>
                <li>
                  <a href="#velemenyek" className="hover:text-white transition-colors">
                    Vélemények
                  </a>
                </li>
                <li>
                  <a href="#arazas" className="hover:text-white transition-colors">
                    Árazás
                  </a>
                </li>
                <li>
                  <a href="#gyik" className="hover:text-white transition-colors">
                    GYIK
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Bejelentkezés
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col items-start justify-end gap-5">
              <LandingButton href="/register" variant="accent" icon className="py-8 text-lg">
                Ingyenes Regisztráció
              </LandingButton>
              <a
                href="https://davelopment.hu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Powered by <br />
                <span className="font-bold text-white text-lg">[davelopment]®</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      <JoinWord>Csatlakozz</JoinWord>
    </footer>
  )
}
