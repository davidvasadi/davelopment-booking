'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { wasRecentLocalMutation } from '@/lib/localMutationTracker'

interface Props {
  // Az aktív üzlet kulcsa ("salon:123" / "restaurant:456"). Ha megváltozik
  // (pl. üzletváltás), a hook lecsatlakozik és újra csatlakozik az új streamhez.
  businessKey: string
}

export function LiveRefreshProvider({ businessKey }: Props) {
  const router = useRouter()

  useEffect(() => {
    const es = new EventSource(`/api/events`)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

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
            router.refresh()
            window.dispatchEvent(new Event('booking-changed'))
          }, 400)
        } else if (data.type === 'notification') {
          // Új harang-értesítés (pl. kapcsolatfelvétel, új regisztráció) — a useNotifications
          // hook erre azonnal újratölti a listát, nem kell a 60mp-es pollingra várni.
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
