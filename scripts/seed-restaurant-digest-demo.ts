/**
 * Egyszeri, TESZT-célú seed: teleteszi a Budapest Bisztró (id=13) MAI napját sokféle
 * foglalással — vegyes nemzetiség, alkalom (szülinap, randi, évforduló stb.), forrás,
 * státusz és előleg-fizetés —, hogy a digest-összefoglaló (reggeli/esti) tartalmilag
 * gazdagon tesztelhető legyen. Közvetlenül a Payload local API-n megy be, NEM a publikus
 * foglaló API-n keresztül, ezért a vendégnek szóló visszaigazoló email NEM megy ki (az a
 * `/api/restaurant/reservations` route saját, itt meg nem hívott kódjában van). Az
 * `notifyOnBooking` hook a tulajnak szóló in-app értesítést és push-t azért elküldi minden
 * új foglalásnál — ez szándékos, valós foglalást szimulál.
 *
 * Csak lokális dev-adatbázison futtatandó.
 *
 * Futtatás (Node 22 + tsx):
 *   npx tsx scripts/seed-restaurant-digest-demo.ts
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv()
loadDotenv({ path: '.env.local', override: true })

const RESTAURANT_ID = 13
const TODAY = new Date().toISOString().slice(0, 10) // YYYY-MM-DD, a szerver mai napja
const PAST_DATE = '2026-08-05' // korábbi dátum a "visszatérő vendég" teszthez

// occasion → `occasion_icon` kulcs (ld. `EVENT_TYPE_ICONS`) — a digest ezt olvassa az ikonhoz.
const OCCASION_ICON: Record<string, string> = {
  birthday: 'cake',
  business: 'business',
  date: 'date',
  anniversary: 'anniversary',
  celebration: 'celebration',
}

type Seed = {
  time: string
  pax: number
  name: string
  phone: string
  email: string
  country: string
  occasion?: string
  source: 'online' | 'walk_in' | 'phone'
  status: 'confirmed' | 'completed' | 'no_show' | 'cancelled'
  depositHuf?: number
}

const seeds: Seed[] = [
  { time: '11:15', pax: 2, name: 'Kovács Anna', phone: '+36301112233', email: 'kovacs.anna.demo@example.com', country: 'HU', source: 'online', status: 'completed' },
  { time: '11:30', pax: 4, name: 'Nagy Béla', phone: '+36302223344', email: 'nagy.bela.demo@example.com', country: 'HU', occasion: 'business', source: 'phone', status: 'completed' },
  { time: '12:00', pax: 3, name: 'Sophie Müller', phone: '+491701234567', email: 'sophie.muller.demo@example.com', country: 'DE', occasion: 'date', source: 'online', status: 'completed', depositHuf: 6000 },
  { time: '12:15', pax: 2, name: 'James Carter', phone: '+447911123456', email: 'james.carter.demo@example.com', country: 'UK', source: 'walk_in', status: 'completed' },
  { time: '12:45', pax: 6, name: 'Szabó Katalin', phone: '+36701234567', email: 'szabo.katalin.demo@example.com', country: 'HU', occasion: 'birthday', source: 'online', status: 'completed', depositHuf: 12000 },
  { time: '13:00', pax: 2, name: 'Hans Weber', phone: '+436641234567', email: 'hans.weber.demo@example.com', country: 'AT', source: 'phone', status: 'completed' },
  { time: '13:30', pax: 4, name: 'Horváth Gábor', phone: '+36203334455', email: 'horvath.gabor.demo@example.com', country: 'HU', occasion: 'anniversary', source: 'online', status: 'completed', depositHuf: 8000 },
  { time: '14:00', pax: 2, name: 'Elena Popescu', phone: '+40721234567', email: 'elena.popescu.demo@example.com', country: 'RO', source: 'walk_in', status: 'completed' },
  { time: '14:30', pax: 5, name: 'Kiss Márton', phone: '+36704445566', email: 'kiss.marton.demo@example.com', country: 'HU', occasion: 'celebration', source: 'phone', status: 'completed' },
  { time: '15:00', pax: 2, name: 'Emily Johnson', phone: '+12025550142', email: 'emily.johnson.demo@example.com', country: 'US', occasion: 'date', source: 'online', status: 'no_show' },
  { time: '17:30', pax: 3, name: 'Tóth Eszter', phone: '+36305556677', email: 'toth.eszter.demo@example.com', country: 'HU', source: 'online', status: 'confirmed' },
  { time: '18:00', pax: 8, name: 'Varga Péter', phone: '+36706667788', email: 'varga.peter.demo@example.com', country: 'HU', occasion: 'birthday', source: 'phone', status: 'confirmed', depositHuf: 15000 },
  { time: '18:15', pax: 2, name: 'Marie Dubois', phone: '+33612345678', email: 'marie.dubois.demo@example.com', country: 'FR', occasion: 'date', source: 'online', status: 'confirmed' },
  { time: '18:30', pax: 4, name: 'Lakatos Zsófia', phone: '+36207778899', email: 'lakatos.zsofia.demo@example.com', country: 'HU', source: 'walk_in', status: 'confirmed' },
  { time: '19:00', pax: 2, name: 'Marco Rossi', phone: '+393331234567', email: 'marco.rossi.demo@example.com', country: 'IT', occasion: 'anniversary', source: 'online', status: 'confirmed', depositHuf: 7000 },
  { time: '19:15', pax: 6, name: 'Molnár Dávid', phone: '+36308889900', email: 'molnar.david.demo@example.com', country: 'HU', occasion: 'business', source: 'phone', status: 'confirmed' },
  { time: '19:30', pax: 2, name: 'Kovács Anna', phone: '+36301112233', email: 'kovacs.anna.demo@example.com', country: 'HU', occasion: 'date', source: 'online', status: 'confirmed' },
  { time: '20:00', pax: 4, name: 'Balogh Ildikó', phone: '+36209990011', email: 'balogh.ildiko.demo@example.com', country: 'HU', occasion: 'celebration', source: 'online', status: 'confirmed', depositHuf: 10000 },
  { time: '20:15', pax: 2, name: 'Anna Nowak', phone: '+48601234567', email: 'anna.nowak.demo@example.com', country: 'PL', source: 'walk_in', status: 'confirmed' },
  { time: '20:30', pax: 3, name: 'Simon Réka', phone: '+36701231234', email: 'simon.reka.demo@example.com', country: 'HU', occasion: 'birthday', source: 'phone', status: 'confirmed' },
  { time: '21:00', pax: 2, name: 'Papp Zoltán', phone: '+36302341234', email: 'papp.zoltan.demo@example.com', country: 'HU', source: 'online', status: 'confirmed' },
  { time: '21:15', pax: 5, name: 'Fekete Judit', phone: '+36703451234', email: 'fekete.judit.demo@example.com', country: 'HU', occasion: 'anniversary', source: 'online', status: 'cancelled' },
]

// +90 perc az end_time-hoz (kerekítve, egyszerűsítve).
function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + min
  const hh = Math.floor((total % (24 * 60)) / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const run = async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  const payload = await getPayload({ config })
  console.log('[seed-digest] Payload init kész.')

  // A `revalidatePath` afterChange hook standalone szkriptből (Next.js request-kontextus
  // nélkül) mindig eldobja a "static generation store missing" hibát — DE a DB-írás addigra
  // már megtörtént. A hiba itt biztonságosan figyelmen kívül hagyható soronként.
  let created = 0
  for (const s of seeds) {
    try {
      await payload.create({
        collection: 'reservations',
        overrideAccess: true,
        data: {
          restaurant: RESTAURANT_ID,
          date: TODAY,
          start_time: s.time,
          end_time: addMinutes(s.time, 90),
          pax: s.pax,
          customer_name: s.name,
          customer_phone: s.phone,
          customer_email: s.email,
          country: s.country,
          occasion: s.occasion,
          occasion_icon: s.occasion ? OCCASION_ICON[s.occasion] : undefined,
          source: s.source,
          status: s.status,
          ...(s.depositHuf ? { deposit_amount_huf: s.depositHuf, deposit_paid: true, payment_gateway: 'stripe' } : {}),
        },
      })
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('static generation store missing'))) throw err
    }
    created++
  }
  console.log(`[seed-digest] ${created} mai foglalás létrehozva a(z) ${TODAY} napra.`)

  // Egy korábbi foglalás UGYANAZZAL a telefonnal/emaillel, mint az egyik mai vendég
  // (Kovács Anna) — hogy a "visszatérő vendég" számítás ne legyen mindig nulla.
  try {
    await payload.create({
      collection: 'reservations',
      overrideAccess: true,
      data: {
        restaurant: RESTAURANT_ID,
        date: PAST_DATE,
        start_time: '19:00',
        end_time: '20:30',
        pax: 2,
        customer_name: 'Kovács Anna',
        customer_phone: '+36301112233',
        customer_email: 'kovacs.anna.demo@example.com',
        country: 'HU',
        source: 'online',
        status: 'completed',
      },
    })
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('static generation store missing'))) throw err
  }
  console.log(`[seed-digest] +1 korábbi (${PAST_DATE}) foglalás Kovács Annának — visszatérő-teszthez.`)

  process.exit(0)
}

run().catch((err) => {
  console.error('[seed-digest] Hiba:', err)
  process.exit(1)
})
