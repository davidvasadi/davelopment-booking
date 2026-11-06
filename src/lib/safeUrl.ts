/** Egy vállalkozó által megadott link biztonságos href-je: csak http(s) (javascript: stb. soha); séma nélkül https://. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch { return null }
}
