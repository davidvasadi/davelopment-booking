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
    depth: 0,
    select: { date: true, end_time: true, updatedAt: true },
    overrideAccess: true,
  })

  if (result.docs.length === 0) return

  // Csak azokat zárjuk automatikusan "befejezett"-re, amikhez a tulaj a LEJÁRATUK ÓTA nem
  // nyúlt hozzá. Ha valaki a lejárat UTÁN explicit átállította (pl. vissza "megerősítve"-re),
  // az egy tudatos döntés — az automatika ezt eddig minden oldalbetöltésnél felülírta, ami
  // lehetetlenné tette a kézi javítást (a mentés utáni router.refresh() újra lefuttatta ezt
  // a függvényt, ami rögtön visszaállította).
  const toComplete = result.docs.filter((b) => {
    const endAt = new Date(`${b.date}T${b.end_time}:00`)
    const updatedAt = new Date(b.updatedAt as string)
    return updatedAt <= endAt
  })
  if (toComplete.length === 0) return

  await Promise.all(
    toComplete.map(b =>
      payload.update({
        collection: 'bookings',
        id: b.id,
        data: { status: 'completed' },
        overrideAccess: true,
      }),
    ),
  )
}
