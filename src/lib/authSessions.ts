import crypto from 'crypto'
import { authQuery, sql } from './authDb'

/**
 * Bejelentkezések eszközönként (Beállítások › Saját profil › Eszközök): minden belépés (kód, Google) egy sort kap,
 * a token `sid`-je erre mutat. A kijelentkeztetett (`revoked_at`) vagy lejárt munkamenet tokenje nem érvényes többé
 * (lib/auth.ts getCurrentUser). 7 napig él, mint a token.
 */
export const SESSION_DAYS = 7

/** Rövid eszköz-név a böngésző azonosítójából (pl. „Chrome · macOS”). */
export function deviceLabel(ua: string | null): string {
  const u = ua ?? ''
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'Böngésző'
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'macOS' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}

/** A böngésző tartós azonosítójának sütije: ugyanarról a böngészőről újra belépve a régi munkamenet lezárul (egy sor / böngésző). */
export const DEVICE_COOKIE = 'dav-device'

export async function createSession(userId: number | string, ua: string | null, ip: string | null, deviceId: string | null = null): Promise<string> {
  const id = crypto.randomUUID()
  // ugyanennek a böngészőnek a még élő munkamenete(i) lezárulnak — az eszközlistában böngészőnként egy sor marad
  if (deviceId) await authQuery(sql`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ${Number(userId)} AND device_id = ${deviceId} AND revoked_at IS NULL`)
  await authQuery(sql`INSERT INTO auth_sessions (id, user_id, device, ip, expires_at, device_id)
    VALUES (${id}, ${Number(userId)}, ${deviceLabel(ua)}, ${ip}, now() + make_interval(days => ${SESSION_DAYS}), ${deviceId})`)
  return id
}

/** Érvényes-e még a munkamenet; közben (legfeljebb 5 percenként) frissíti az utolsó aktivitást. */
export async function sessionValid(sid: string, userId: number | string): Promise<boolean> {
  const rows = await authQuery<{ ok: boolean; stale: boolean }>(
    sql`SELECT (revoked_at IS NULL AND expires_at > now() AND user_id = ${Number(userId)}) AS ok, (last_seen_at < now() - interval '5 minutes') AS stale
        FROM auth_sessions WHERE id = ${sid}`)
  const r = rows[0]
  if (!r?.ok) return false
  if (r.stale) void authQuery(sql`UPDATE auth_sessions SET last_seen_at = now() WHERE id = ${sid}`).catch(() => {})
  return true
}

export type SessionRow = { id: string; device: string | null; ip: string | null; created_at: string; last_seen_at: string }
export async function listSessions(userId: number | string): Promise<SessionRow[]> {
  return authQuery<SessionRow>(sql`SELECT id, device, ip, created_at, last_seen_at FROM auth_sessions
    WHERE user_id = ${Number(userId)} AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`)
}
export async function revokeSession(userId: number | string, sid: string): Promise<void> {
  await authQuery(sql`UPDATE auth_sessions SET revoked_at = now() WHERE id = ${sid} AND user_id = ${Number(userId)}`)
}
export async function revokeOtherSessions(userId: number | string, keep: string | null): Promise<void> {
  await authQuery(sql`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = ${Number(userId)} AND revoked_at IS NULL AND id <> ${keep ?? ''}`)
}
