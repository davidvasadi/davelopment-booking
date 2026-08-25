'use client'

import { useEffect, useState } from 'react'
import { useNotifications, type Notification } from '@/lib/useNotifications'
import { BroadcastSheet } from './BroadcastSheet'

/** Admin körüzenet-kártya kattintásra ezt dobja — ugyanaz a minta, mint a digestnél
 *  (`DigestAutoPopup`): EGYETLEN, AppShell-szintű mount nyitja meg, nem a kártya saját portálja. */
export const OPEN_BROADCAST_EVENT = 'davelopment:open-broadcast'

export function BroadcastAutoPopup() {
  const { markRead } = useNotifications()
  const [active, setActive] = useState<Notification | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const n = (e as CustomEvent<Notification>).detail
      setActive(n)
      if (!n.read) markRead(n.id)
    }
    window.addEventListener(OPEN_BROADCAST_EVENT, handler)
    return () => window.removeEventListener(OPEN_BROADCAST_EVENT, handler)
  }, [markRead])

  if (!active) return null
  return <BroadcastSheet n={active} open onClose={() => setActive(null)} />
}
