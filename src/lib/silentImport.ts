// „Csendes import”: a CSV/XLSX importból jövő rekordok (vendégek, foglalások, éttermi foglalások
// stb.) NEM válthatnak ki semmilyen értesítést — se in-app értesítést, se push-t, se emailt, se
// élő (SSE) frissítést, se soronkénti audit-bejegyzést. Az import route minden payload.create /
// update hívása ezt a context-et kapja, a hookok pedig `isSilentImport(req)` esetén kihagyják magukat.
import type { PayloadRequest } from 'payload'

export const SILENT_IMPORT = { silentImport: true } as const

export function isSilentImport(req: Pick<PayloadRequest, 'context'> | undefined | null): boolean {
  return Boolean((req?.context as { silentImport?: boolean } | undefined)?.silentImport)
}
