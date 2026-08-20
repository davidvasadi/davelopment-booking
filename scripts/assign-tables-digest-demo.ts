/**
 * Kiegészíti a `seed-restaurant-digest-demo.ts`-sel létrehozott mai teszt-foglalásokat valódi
 * asztal-hozzárendeléssel (a legtöbbet), hogy a Timeline nézet reálisan nézzen ki — csak 2
 * foglalás marad szándékosan "Nincs asztalhoz rendelve" (nem átfedő időpontokkal), a többi 22
 * korábban MIND asztal nélkül volt, ami irreálisan zsúfolt, egymást átfedő "no table" sávot
 * eredményezett.
 *
 * Futtatás (Node 22 + tsx):
 *   npx tsx scripts/assign-tables-digest-demo.ts
 */
import { config as loadDotenv } from 'dotenv'
loadDotenv()
loadDotenv({ path: '.env.local', override: true })

// reservation id → asztal-id(k) (a `tables` collection id-i, ld. korábbi psql lekérdezés)
const ASSIGNMENTS: Record<number, number[]> = {
  295: [129], // Kovács Anna 11:15 → T2
  296: [8],   // Nagy Béla 11:30 → T1
  297: [11],  // Sophie Müller 12:00 → S1
  298: [130], // James Carter 12:15 → T3
  299: [382], // Szabó Katalin 12:45 → VIP 2
  300: [15],  // Hans Weber 13:00 → S2
  301: [383], // Horváth Gábor 13:30 → Terasz 1
  302: [134], // Elena Popescu 14:00 → F0
  // 303 Kiss Márton — szándékosan NINCS asztal
  304: [135], // Emily Johnson 15:00 → F1
  305: [11],  // Tóth Eszter 17:30 → S1
  306: [382, 13], // Varga Péter 18:00 (8 fő) → VIP 2 + M3 összevonva
  307: [129], // Marie Dubois 18:15 → T2
  308: [8],   // Lakatos Zsófia 18:30 → T1
  309: [130], // Marco Rossi 19:00 → T3
  310: [133], // Molnár Dávid 19:15 → S3
  311: [15],  // Kovács Anna 19:30 → S2
  312: [384], // Balogh Ildikó 20:00 → Terasz 2
  313: [134], // Anna Nowak 20:15 → F0
  314: [12],  // Simon Réka 20:30 → M2
  315: [135], // Papp Zoltán 21:00 → F1
  // 316 Fekete Judit — szándékosan NINCS asztal (amúgy is lemondva)
}

const run = async () => {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  const payload = await getPayload({ config })
  console.log('[assign-tables] Payload init kész.')

  let updated = 0
  for (const [id, tableIds] of Object.entries(ASSIGNMENTS)) {
    try {
      await payload.update({
        collection: 'reservations',
        id: Number(id),
        overrideAccess: true,
        data: { tables: tableIds },
      })
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('static generation store missing'))) throw err
    }
    updated++
  }
  console.log(`[assign-tables] ${updated} foglalás kapott asztalt.`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[assign-tables] Hiba:', err)
  process.exit(1)
})
