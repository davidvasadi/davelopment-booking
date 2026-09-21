import type { BasePayload } from 'payload'
import type { BreakWindow } from '@/payload/payload-types'
import { resolveStaffWorkHours } from './availability'

/** Sentinel a `note` mezőben — ígyKÜLÖNBÖZTETI meg az automatikusan generált "Műszak" rekordokat
 *  a kézzel felvitt/módosított bejegyzésektől, séma-bővítés (új mező/migráció) nélkül. Csak az
 *  auto-rekordokat frissítjük/töröljük újra-futtatáskor — amint egy ember hozzányúlt (típust
 *  váltott, saját megjegyzést írt, törölte), a rekord onnantól "kézi", a cron többé nem nyúl hozzá. */
const AUTO_NOTE = '__auto__'

const breaksEqual = (a: BreakWindow[], b: BreakWindow[]): boolean =>
  a.length === b.length && a.every((w, i) => w.start_time === b[i]?.start_time && w.end_time === b[i]?.end_time)

/** A munkatárs alap napi szünetei, a műszak idejére szorítva — ha egy szünet kilógna a
 *  (megváltozott) munkaidőből, inkább nincs az a szünet aznap, mint hibás időpont. Egy nap
 *  TÖBB szünetet is tarthat (pl. ebéd + délutáni pihenő). */
function resolveBreaks(
  defaults: BreakWindow[] | null | undefined,
  shiftStart: string,
  shiftEnd: string,
): BreakWindow[] {
  if (!defaults?.length) return []
  return defaults.filter((w) => w.start_time && w.end_time && w.start_time >= shiftStart && w.end_time <= shiftEnd && w.start_time < w.end_time)
}

/**
 * Egy szalon munkatársainak a foglalási ablakon (booking_window_days) belüli napjait tölti fel
 * alapértelmezett "Műszak" (`shifts` type: 'shift') rekordokkal, a munkatárs heti alap-mintája
 * (`availability` tábla) alapján — így a HR-naptár nem üres, amíg a tulaj/manager nem ad hozzá
 * kivételt (szabadság/beteg). A KÉZI bejegyzéseket sose bántja. Az általa korábban létrehozott
 * (még mindig auto) rekordokat viszont ÚJRA-ELLENŐRZI minden futáskor — ha időközben az illető
 * heti mintájához kivétel került (pl. aznap rövidebb/hosszabb ideig dolgozik), az auto-rekord
 * frissül az új időkkel, vagy törlődik, ha a nap időközben teljesen szabaddá vált.
 *
 * Két hívó van: (1) a `schedule-autofill` cron, naponta egyszer, MINDEN szalonra —
 * (2) a szalon-beállítások PATCH route-ja, AMIKOR a `booking_window_days` mentésre kerül — hogy
 * az ablak kitolása ne várjon a következő éjszakai cron-futásig, hanem rögtön lássa a tulaj.
 */
export async function autofillSalonSchedule(
  payload: BasePayload,
  salonId: string,
  windowDays: number,
): Promise<{ staffChecked: number; created: number; updated: number; removed: number }> {
  const summary = { staffChecked: 0, created: 0, updated: 0, removed: 0 }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const dates: string[] = []
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  if (dates.length === 0) return summary
  const rangeStartIso = `${dates[0]}T00:00:00.000Z`
  const rangeEndIso = `${dates[dates.length - 1]}T23:59:59.999Z`

  const staffRes = await payload.find({
    collection: 'staff',
    where: { and: [{ salon: { equals: salonId } }, { is_active: { equals: true } }] },
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })

  for (const st of staffRes.docs) {
    summary.staffChecked++
    const staffId = String(st.id)

    const existingRes = await payload.find({
      collection: 'shifts',
      where: { and: [{ staff: { equals: staffId } }, { date: { greater_than_equal: rangeStartIso } }, { date: { less_than_equal: rangeEndIso } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    })
    const existingByDate = new Map(existingRes.docs.map((s) => [String(s.date).slice(0, 10), s]))

    for (const dateStr of dates) {
      const existing = existingByDate.get(dateStr)
      if (existing && existing.note !== AUTO_NOTE) continue // kézi bejegyzés — sose nyúlunk hozzá

      const hours = await resolveStaffWorkHours(salonId, staffId, dateStr)

      if (!hours) {
        // A nap időközben szabaddá vált (pl. új kivétel) — a régi auto-rekord már téves, töröljük.
        if (existing) {
          await payload.delete({ collection: 'shifts', id: existing.id, overrideAccess: true })
          summary.removed++
        }
        continue
      }

      const brk = resolveBreaks(st.default_breaks, hours.start, hours.end)

      if (existing) {
        if (existing.start_time !== hours.start || existing.end_time !== hours.end || !breaksEqual((existing.breaks as BreakWindow[] | null) ?? [], brk)) {
          await payload.update({
            collection: 'shifts',
            id: existing.id,
            data: { start_time: hours.start, end_time: hours.end, breaks: brk } as never,
            overrideAccess: true,
          })
          summary.updated++
        }
        continue
      }

      await payload.create({
        collection: 'shifts',
        data: {
          staff: Number(staffId),
          salon: Number(salonId),
          date: `${dateStr}T12:00:00.000Z`,
          type: 'shift',
          start_time: hours.start,
          end_time: hours.end,
          breaks: brk,
          note: AUTO_NOTE,
        } as never,
        overrideAccess: true,
      })
      summary.created++
    }
  }

  return summary
}
