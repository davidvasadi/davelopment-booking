'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  // Az aktív üzlet kulcsa ("salon:123" / "restaurant:456"). Ha megváltozik
  // (pl. üzletváltás), a hook lecsatlakozik és újra csatlakozik az új streamhez.
  businessKey: string
}

export function LiveRefreshProvider({ businessKey }: Props) {
  const router = useRouter()

  useEffect(() => {
    const es = new EventSource(`/api/events`)

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const data = JSON.parse(e.data) as { type: string }
        if (data.type === 'refresh') {
          router.refresh()
          window.dispatchEvent(new Event('booking-changed'))
        }
      } catch {}
    }

    return () => es.close()
  }, [router, businessKey])

  return null
}
