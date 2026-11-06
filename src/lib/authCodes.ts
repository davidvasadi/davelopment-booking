import crypto from 'crypto'
import { authQuery, sql } from './authDb'

/**
 * Belépési / regisztrációs kód (design 3.1–3.3): 6 számjegy e-mailben, 10 percig érvényes, legfeljebb 5 próbálkozás.
 * Csak a hash-ét tároljuk (PAYLOAD_SECRET-tel sózva); egy e-mailhez mindig csak a legutóbbi kód él. Regisztrációnál a
 * fiók adatai (`data`) a kódhoz kötve várnak — a fiók a helyes kód beírásakor jön létre.
 */
export const CODE_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
export type CodePurpose = 'login' | 'register'

const hashCode = (email: string, code: string) =>
  crypto.createHmac('sha256', process.env.PAYLOAD_SECRET ?? 'dev-secret').update(`${email.toLowerCase()}:${code}`).digest('hex')

/** Új kódot ad ki az e-mailre (a korábbiak érvénytelenek lesznek). Visszaadja a kódot — az e-mailt a hívó küldi. */
export async function issueCode(email: string, purpose: CodePurpose, data?: Record<string, unknown>): Promise<string> {
  const e = email.toLowerCase().trim()
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  await authQuery(sql`UPDATE auth_login_codes SET used_at = now() WHERE email = ${e} AND used_at IS NULL`)
  await authQuery(sql`INSERT INTO auth_login_codes (email, code_hash, purpose, data, expires_at)
    VALUES (${e}, ${hashCode(e, code)}, ${purpose}, ${data ? JSON.stringify(data) : null}::jsonb, now() + make_interval(mins => ${CODE_TTL_MINUTES}))`)
  return code
}

export type VerifyResult =
  | { ok: true; purpose: CodePurpose; data: Record<string, unknown> | null }
  | { ok: false; reason: 'expired' | 'wrong' | 'locked'; left?: number }

/** A beírt kód ellenőrzése. Siker után a kód felhasználtnak számít. */
export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const e = email.toLowerCase().trim()
  const rows = await authQuery<{ id: number; code_hash: string; purpose: CodePurpose; data: Record<string, unknown> | null; attempts: number; expired: boolean }>(
    sql`SELECT id, code_hash, purpose, data, attempts, (expires_at < now()) AS expired FROM auth_login_codes
        WHERE email = ${e} AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`)
  const row = rows[0]
  if (!row || row.expired) return { ok: false, reason: 'expired' }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' }
  const want = Buffer.from(row.code_hash, 'hex')
  const got = Buffer.from(hashCode(e, code.replace(/\D/g, '')), 'hex')
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
    await authQuery(sql`UPDATE auth_login_codes SET attempts = attempts + 1 WHERE id = ${row.id}`)
    const left = MAX_ATTEMPTS - row.attempts - 1
    return left > 0 ? { ok: false, reason: 'wrong', left } : { ok: false, reason: 'locked' }
  }
  await authQuery(sql`UPDATE auth_login_codes SET used_at = now() WHERE id = ${row.id}`)
  return { ok: true, purpose: row.purpose, data: row.data }
}
