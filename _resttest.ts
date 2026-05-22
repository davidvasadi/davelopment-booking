import { getPayload } from 'payload'
import config from './payload.config'

async function main() {
  const payload = await getPayload({ config })
  try {
    const r = await payload.create({
      collection: 'restaurants',
      data: { name: 'LocalTest Ét', slug: 'localtest-' + Date.now(), owner: 1, is_active: true },
      overrideAccess: true,
    })
    console.log('RESTAURANT OK id=', r.id)
  } catch (e: any) {
    console.error('CAUGHT:', e?.message)
    if (e?.data) console.error('DATA:', JSON.stringify(e.data))
    console.error('STACK:', e?.stack?.split('\n').slice(0,6).join('\n'))
  }
  process.exit(0)
}
main()
