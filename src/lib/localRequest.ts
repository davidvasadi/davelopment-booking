/** Helyi fejlesztés-e a kérés (localhost, dev módban a helyi hálózati IP is — telefonos teszt) — ilyenkor nem küldünk levelet, a kód / link a terminálba kerül.
 *  A `Host` fejlécből döntünk (élesen az nginx `proxy_set_header Host $host`-tal a valódi domaint adja át), NEM a
 *  `req.nextUrl`-ből: a proxy mögött az a belső címet (localhost:3001) mutatja, így élesben is „helyinek” hitte. */
export function isLocalRequest(headers: Headers): boolean {
  const raw = headers.get('x-forwarded-host') ?? headers.get('host') ?? ''
  const host = raw.split(',')[0].trim().replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '') return true
  // fejlesztés közben a telefonról a gép helyi hálózati címén (pl. 192.168.0.175:3001) — csak dev módban, élesben soha
  return process.env.NODE_ENV !== 'production' && /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/.test(host)
}
