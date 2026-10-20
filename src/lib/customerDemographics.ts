import { getPayloadClient } from './payload'
import type { Customer } from '@/payload/payload-types'

export interface DemographicSlice {
  label: string
  value: number
}

export interface CustomerDemographics {
  /** Nő/Férfi/Egyéb/Nincs megadva — csak a ténylegesen előforduló kategóriák (0-sal nem jön). */
  gender: DemographicSlice[]
  /** A szabad szöveges `group_tag` szerinti bontás, gyakoriság szerint csökkenő sorrendben,
   *  max 8 egyedi címke + egy összevont "Nincs csoport" tétel a többinek. */
  groups: DemographicSlice[]
  /** Hány vendég-rekord volt összesen (a %-os kiírásokhoz). */
  total: number
}

const GENDER_LABEL: Record<string, string> = { female: 'Nő', male: 'Férfi', other: 'Egyéb' }

/**
 * Vendég-demográfia (nem, csoport/címke) a `Customers` táblából — ÜZLET-SZINTŰ, nem
 * dátum-tartományhoz kötött (ez egy állapot-pillanatfelvétel, nem egy időszaki trend, mint a
 * foglalás-alapú KPI-k). 2026-10-19 óta létező mezőkből (`gender`/`group_tag`).
 */
export async function getCustomerDemographics(kind: 'salon' | 'restaurant', businessId: string | number): Promise<CustomerDemographics> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'customers',
    where: { [kind]: { equals: businessId } },
    depth: 0,
    limit: 5000,
    overrideAccess: true,
  })
  const docs = res.docs as Customer[]
  const total = docs.length

  const genderCounts: Record<string, number> = { female: 0, male: 0, other: 0 }
  let genderUnset = 0
  for (const c of docs) {
    if (c.gender && c.gender in genderCounts) genderCounts[c.gender] += 1
    else genderUnset += 1
  }
  const gender: DemographicSlice[] = [
    ...Object.entries(genderCounts)
      .filter(([, n]) => n > 0)
      .map(([key, value]) => ({ label: GENDER_LABEL[key], value })),
    ...(genderUnset > 0 ? [{ label: 'Nincs megadva', value: genderUnset }] : []),
  ]

  const groupCounts = new Map<string, number>()
  let groupUnset = 0
  for (const c of docs) {
    const tag = c.group_tag?.trim()
    if (tag) groupCounts.set(tag, (groupCounts.get(tag) ?? 0) + 1)
    else groupUnset += 1
  }
  const topGroups = Array.from(groupCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const groups: DemographicSlice[] = [
    ...topGroups,
    ...(groupUnset > 0 ? [{ label: 'Nincs csoport', value: groupUnset }] : []),
  ]

  return { gender, groups, total }
}
