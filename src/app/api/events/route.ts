import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { sseEmitter, type SseBookingEvent } from '@/lib/sseEmitter'

export const dynamic = 'force-dynamic'

// 25 másodpercenként heartbeat: nginx default proxy_read_timeout 60s,
// ez alatt a kapcsolat nem hal ki.
const HEARTBEAT_MS = 25_000

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'No active business' }, { status: 404 })

  const businessKey = `${active.type}:${active.id}`
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
        if (`${kind}:${businessId}` === businessKey) {
          enqueue(`data: ${JSON.stringify({ type: 'refresh', kind, op })}\n\n`)
        }
      }

      sseEmitter.on('booking-change', listener)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatId)
        sseEmitter.off('booking-change', listener)
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
