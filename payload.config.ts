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
import { Shifts } from './src/payload/collections/Shifts'
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
import { Waitlist } from './src/payload/collections/Waitlist'
import { Customers } from './src/payload/collections/Customers'
import { Notifications } from './src/payload/collections/Notifications'
import { Reviews } from './src/payload/collections/Reviews'
import { Memberships } from './src/payload/collections/Memberships'
import { AuditLog } from './src/payload/collections/AuditLog'
import { Tasks } from './src/payload/collections/Tasks'

// Globals
import { PricingSettings } from './src/payload/globals/PricingSettings'

// A publikus app-URL (prod: https://schedulio.hu). A CSRF/CORS/serverURL ehhez igazodik,
// különben az nginx-proxy mögött a böngésző-eredetű login CSRF-blokkolt → 401
// (a curl átmegy, mert nincs Origin headere). Lokálban a localhost a fallback.
const SERVER_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default buildConfig({
  serverURL: SERVER_URL,
  // CSRF: mely origin-ekről fogadunk el auth-kéréseket (cookie-set). A proxy mögött
  // a publikus domaint kell engedni, különben a böngésző-login 401-et kap.
  csrf: [SERVER_URL],
  cors: [SERVER_URL],
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
    Shifts,
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
    Waitlist,
    Customers,
    Notifications,
    Reviews,
    Memberships,
    AuditLog,
    Tasks,
  ],
  globals: [PricingSettings],
  // Többnyelvű publikus foglaló: a tulaj-content (szolgáltatás/kategória nevek, leírások, „jó tudni",
  // feltételek, email tárgy/bevezető, staff bio) `localized: true` mezőkön át. A magyar az alap +
  // fallback; üres nyelv → magyar. A rendszer-szöveg NEM ezen megy (statikus szótár, src/lib/i18n).
  localization: {
    locales: ['hu', 'en', 'de', 'es', 'it', 'fr'],
    defaultLocale: 'hu',
    fallback: true,
  },
  editor: slateEditor({}),
  db: postgresAdapter({
    // A Payload bulk-delete (több dokumentum egyszerre) párhuzamos query-ket futtat egy
    // tranzakció-kapcsolaton, amit a node-postgres nem enged ("client is already executing
    // a query") → a tranzakció megsérül és rollback-el (pl. admin user-törlés több elemen).
    // A tranzakciók kikapcsolásával minden query saját kapcsolaton fut, így nincs ütközés.
    transactionOptions: false,
    // Verziózott migrációk a séma-szinkronhoz (scripts/migrate-create.ts + scripts/migrate.ts).
    // A `push` csak fejlesztésben aktív (gyors iterálás); prod-ban KIKAPCSOLVA, ott kizárólag a
    // commitolt migrációk futnak (deploy: `npx tsx scripts/migrate.ts`) → determinisztikus,
    // ugyanaz fut a szerveren, mint amit lokálisan láttunk. A CLI undici-hibás, ezért a
    // migrate-create/migrate a Payload programozott API-ját hívja, megkerülve a CLI-t.
    migrationDir: path.resolve(process.cwd(), 'src/migrations'),
    push: process.env.NODE_ENV !== 'production' && process.env.PAYLOAD_DISABLE_PUSH !== 'true',
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
