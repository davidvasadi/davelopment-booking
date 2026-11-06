'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { wasRecentLocalMutation } from '@/lib/localMutationTracker'

interface Props {
  // Az aktív üzlet kulcsa ("salon:123" / "restaurant:456"). Ha megváltozik
  // (pl. üzletváltás), a hook lecsatlakozik és újra csatlakozik az új streamhez.
  businessKey: string
}

/** Azok az oldalak, amik NEM a foglalásokból élnek — itt egy foglalás-változás nem tölti újra az egész oldalt (a következő
 *  navigáció úgyis frissen jön). Sebesség, docs/audit/2026-11-05_1921. */
const NOT_BOOKING_PAGES = ['/settings', '/marketing', '/tips', '/help', '/services', '/subscription', '/partnerprogram']

export function LiveRefreshProvider({ businessKey }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  // háttérben lévő fülnél nem frissítünk azonnal — csak jelöljük, és visszatéréskor egyszer frissül
  const stale = useRef(false)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stale.current) { stale.current = false; router.refresh() }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

  useEffect(() => {
    const es = new EventSource(`/api/events`)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    // Megszakadt kapcsolat (pl. alvó laptop, hálózatváltás): a böngésző magától újracsatlakozik —
    // ekkor egyszer felzárkózunk, mert a kiesés alatt érkezett események elvesztek. Ha a szerver
    // elutasította (pl. lejárt bejelentkezés), a böngésző lezárja és nem próbálkozik tovább.
    let dropped = false
    es.onerror = () => { dropped = true }
    es.onopen = () => {
      if (!dropped) return
      dropped = false
      window.dispatchEvent(new Event('notification-changed'))
      router.refresh()
    }

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as { type: string }
        if (data.type === 'refresh') {
          // A SAJÁT mentésünk MÁR meghívta a saját router.refresh()-ét — ha ez az SSE-üzenet a
          // saját írásunk visszhangja (2 másodpercen belül volt helyi mentés), nincs értelme
          // MÉG EGY, redundáns refresh-nek — sőt, ha ez a második refresh versenyben fut az
          // elsővel, a régebbi RSC-válasza felülírhatja a frissen mentett állapotot, és úgy
          // tűnik, mintha a mentés "visszaugrott" volna a régi értékre. Csak MÁS kliens
          // írására frissítünk élőben.
          if (wasRecentLocalMutation()) return
          // Egy sorozatnyi gyors SSE-üzenetet egy debounce-olt refresh-be vonunk össze.
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            window.dispatchEvent(new Event('booking-changed'))
            // célzott: csak a foglalásokból élő oldal töltődik újra, és csak ha látszik a fül
            if (NOT_BOOKING_PAGES.some((p) => pathRef.current?.includes(p))) return
            if (document.visibilityState !== 'visible') { stale.current = true; return }
            router.refresh()
          }, 600)
        } else if (data.type === 'notification') {
          // Új harang-értesítés (pl. új foglalás, kapcsolatfelvétel) — a közös értesítés-tár
          // (useNotifications) erre azonnal újratölt; időzített lekérdezés nincs.
          window.dispatchEvent(new Event('notification-changed'))
        }
      } catch {}
    }

    return () => {
      es.close()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [router, businessKey])

  return null
}
