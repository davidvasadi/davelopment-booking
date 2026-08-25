import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { sseEmitter, type SseBookingEvent, type SseNotificationEvent } from '@/lib/sseEmitter'

export const dynamic = 'force-dynamic'

// 25 másodpercenként heartbeat: nginx default proxy_read_timeout 60s,
// ez alatt a kapcsolat nem hal ki.
const HEARTBEAT_MS = 25_000

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin (backstage) nincs "aktív üzlethez" kötve — a foglalás-eseményeket nem kapja, de az
  // admin-közönségű értesítéseket (pl. kapcsolatfelvétel) igen, lásd a notification-listenert lent.
  const isAdmin = user.role === 'admin'
  const { active } = isAdmin ? { active: null } : await getActiveBusiness(user)
  if (!isAdmin && !active) return NextResponse.json({ error: 'No active business' }, { status: 404 })

  const businessKey = active ? `${active.type}:${active.id}` : null
  const encoder = new TextEncoder()

  let heartbeatId: ReturnType<typeof setInterval>

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          // controller már zárva — cleanup fog lefutni az abort listenerben
        }
      }

      console.log('[SSE] kliens csatlakozott:', businessKey)
      enqueue(`data: ${JSON.stringify({ type: 'connected', businessKey })}\n\n`)

      heartbeatId = setInterval(() => {
        enqueue(': heartbeat\n\n')
      }, HEARTBEAT_MS)

      const listener = ({ kind, businessId, op }: SseBookingEvent) => {
        if (businessKey && `${kind}:${businessId}` === businessKey) {
          enqueue(`data: ${JSON.stringify({ type: 'refresh', kind, op })}\n\n`)
        }
      }
      sseEmitter.on('booking-change', listener)

      // Ugyanaz a szűrés-logika, mint az /api/notifications GET-jében (placeFilter): admin az
      // admin-közönségű, tulaj az aktív üzletéhez tartozó owner-, bárki a saját user-célzott
      // értesítését kapja meg azonnal — a kliens ekkor csak újra lekéri a listát, nem a teljes
      // payload-ot küldjük át SSE-n.
      const notifListener = (ev: SseNotificationEvent) => {
        const matches = isAdmin
          ? ev.audience === 'admin'
          : (ev.audience === 'member' && String(ev.userId ?? '') === String(user.id))
            || (ev.audience === 'owner' && active != null && String(active.id) === String(active.type === 'salon' ? ev.salonId : ev.restaurantId))
        if (matches) enqueue(`data: ${JSON.stringify({ type: 'notification' })}\n\n`)
      }
      sseEmitter.on('notification-change', notifListener)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatId)
        sseEmitter.off('booking-change', listener)
        sseEmitter.off('notification-change', notifListener)
        try { controller.close() } catch {}
      })
    },
    cancel() {
      clearInterval(heartbeatId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Nginx SSE puffer-kikapcsolás response-szinten — nincs szükség nginx config módosításra.
      // https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering
      'X-Accel-Buffering': 'no',
    },
  })
}
