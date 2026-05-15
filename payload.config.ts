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

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' - Bookly Admin',
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
  ],
  globals: [],
  editor: slateEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URI || 'postgresql://bookly:REDACTED@localhost:5432/bookly',
    },
  }),
  secret: process.env.PAYLOAD_SECRET || 'your-secret-key-here',
  sharp,
  email: resendAdapter({
    defaultFromAddress: process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu',
    defaultFromName: process.env.RESEND_FROM_NAME ?? 'Bookly',
    apiKey: process.env.RESEND_API_KEY ?? '',
  }),
  typescript: {
    outputFile: path.resolve(__dirname, 'src/payload/payload-types.ts'),
  },
  onInit: async (payload) => {
    console.log('✅ Payload CMS initialized')
  },
})
