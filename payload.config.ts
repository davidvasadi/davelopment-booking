import path from 'path'
import sharp from 'sharp'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'
import { resendAdapter } from '@payloadcms/email-resend'

// Collections
import { Users } from './src/payload/collections/Users'
import { Salons } from './src/payload/collections/Salons'
import { Staff } from './src/payload/collections/Staff'
import { Services } from './src/payload/collections/Services'
import { ServiceCategories } from './src/payload/collections/ServiceCategories'
import { Bookings } from './src/payload/collections/Bookings'
import { Availability } from './src/payload/collections/Availability'
import { Media } from './src/payload/collections/Media'
import { Subscriptions } from './src/payload/collections/Subscriptions'
import { Restaurants } from './src/payload/collections/Restaurants'
import { Rooms } from './src/payload/collections/Rooms'
import { Tables } from './src/payload/collections/Tables'
import { OpeningHours } from './src/payload/collections/OpeningHours'
import { OpeningHoursExceptions } from './src/payload/collections/OpeningHoursExceptions'
import { Reservations } from './src/payload/collections/Reservations'
import { Notifications } from './src/payload/collections/Notifications'

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' - Schedulio Admin',
      icons: {
        icon: '/favicon.ico',
      },
      openGraph: {
        images: ['/og-image.png'],
      },
    },
  },
  collections: [
    Users,
    Salons,
    Staff,
    Services,
    ServiceCategories,
    Bookings,
    Availability,
    Media,
    Subscriptions,
    Restaurants,
    Rooms,
    Tables,
    OpeningHours,
    OpeningHoursExceptions,
    Reservations,
    Notifications,
  ],
  globals: [],
  editor: slateEditor({}),
  db: postgresAdapter({
    // A Payload bulk-delete (több dokumentum egyszerre) párhuzamos query-ket futtat egy
    // tranzakció-kapcsolaton, amit a node-postgres nem enged ("client is already executing
    // a query") → a tranzakció megsérül és rollback-el (pl. admin user-törlés több elemen).
    // A tranzakciók kikapcsolásával minden query saját kapcsolaton fut, így nincs ütközés.
    transactionOptions: false,
    // Séma-szinkron (push) prod-ban is — nincsenek megírt migrációk, és a CLI undici-hibás.
    // Egyetlen környezet, a séma a kódból jön → a push biztonságos. (TODO: később áttérni
    // rendes migrációkra, ha a payload CLI undici-hibája megoldódik.)
    push: true,
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgresql://user:password@localhost:5432/dbname',
    },
  }),
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-here',
  sharp,
  email: resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu',
    defaultFromName: process.env.RESEND_FROM_NAME ?? 'Schedulio',
    apiKey: process.env.RESEND_API_KEY ?? '',
  }),
  typescript: {
    outputFile: path.resolve(__dirname, 'src/payload/payload-types.ts'),
  },
  onInit: async (payload) => {
    console.log('✅ Payload CMS initialized')
  },
})
