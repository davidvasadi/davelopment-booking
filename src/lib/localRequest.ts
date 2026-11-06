/** Helyi fejlesztés-e a kérés (localhost) — ilyenkor nem küldünk levelet, a kód / link a terminálba kerül.
 *  A `Host` fejlécből döntünk (élesen az nginx `proxy_set_header Host $host`-tal a valódi domaint adja át), NEM a
 *  `req.nextUrl`-ből: a proxy mögött az a belső címet (localhost:3001) mutatja, így élesben is „helyinek” hitte. */
export function isLocalRequest(headers: Headers): boolean {
  const raw = headers.get('x-forwarded-host') ?? headers.get('host') ?? ''
  const host = raw.split(',')[0].trim().replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === ''
}
