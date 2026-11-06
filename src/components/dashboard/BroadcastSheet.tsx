'use client'

import { Button } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { notifDate, type Notification } from '@/lib/useNotifications'

/** Admin körüzenet teljes szövege — a közös PopupModal-ban (mobilon alulról, desktopon középen). */
export function BroadcastSheet({ n, open, onClose }: { n: Notification; open: boolean; onClose: () => void }) {
  return (
    <PopupModal open={open} onClose={onClose} title={n.title} subtitle={notifDate(n.createdAt)} maxWidth="sm:max-w-[440px]">
      {n.body && <p className="whitespace-pre-wrap text-ui-body leading-relaxed text-ui-text">{n.body}</p>}
      <Button size="lg" onClick={onClose} className="mt-6 w-full">Rendben</Button>
    </PopupModal>
  )
}
