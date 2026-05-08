import { getPayloadClient } from '@/lib/payload'

export const GET = async (req: Request) => {
  try {
    const payload = await getPayloadClient()
    return Response.json({ status: 'ok', payload: !!payload })
  } catch (error) {
    return Response.json({ error: 'Failed to connect to Payload' }, { status: 500 })
  }
}

export const POST = async (req: Request) => {
  try {
    const payload = await getPayloadClient()
    return Response.json({ status: 'ok' })
  } catch (error) {
    return Response.json({ error: 'Failed to connect to Payload' }, { status: 500 })
  }
}
