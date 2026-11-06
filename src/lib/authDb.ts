import { sql } from '@payloadcms/db-postgres'

type SQL = ReturnType<typeof sql>
import { getPayloadClient } from './payload'

/** Nyers SQL a saját auth-táblákra (`auth_login_codes`, `auth_sessions` — migráció 20261105_200000). */
export async function authQuery<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const payload = await getPayloadClient()
  const db = (payload.db as unknown as { drizzle: { execute: (q: SQL) => Promise<{ rows?: T[] } | T[]> } }).drizzle
  const res = await db.execute(query)
  return Array.isArray(res) ? res : res.rows ?? []
}
export { sql }
