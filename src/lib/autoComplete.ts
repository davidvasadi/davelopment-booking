import { format } from 'date-fns'
import { getPayloadClient } from './payload'

export async function autoCompleteBookings(salonId: string | number) {
  const payload = await getPayloadClient()
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const nowTime = format(now, 'HH:mm')

  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { salon: { equals: salonId } },
        { status: { in: ['pending', 'confirmed'] } },
        {
          or: [
            { date: { less_than: todayStr } },
            {
              and: [
                { date: { equals: todayStr } },
                { end_time: { less_than_equal: nowTime } },
              ],
            },
          ],
        },
      ],
    },
    limit: 200,
  })

  if (result.docs.length === 0) return

  await Promise.all(
    result.docs.map(b =>
      payload.update({
        collection: 'bookings',
        id: b.id,
        data: { status: 'completed' },
        overrideAccess: true,
      }),
    ),
  )
}
