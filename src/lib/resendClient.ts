import { Resend } from 'resend'

/**
 * Resend-kliens, ami a visszautasított küldést HIBAKÉNT dobja. A Resend SDK hibánál nem dob, hanem `{ data: null,
 * error }`-t ad vissza — enélkül a hívók (`const { data } = await resend.emails.send(...)`) sikeresnek naplózták a
 * el sem ment levelet (email_log: ok, resend_id üres). Így a meglévő try/catch-ek a valódi okot naplózzák.
 */
export function strictResend(apiKey: string): Resend {
  const client = new Resend(apiKey)
  const send = client.emails.send.bind(client.emails)
  client.emails.send = (async (...args: Parameters<typeof send>) => {
    const res = await send(...args)
    if (res.error) throw new Error(`Resend: ${res.error.name ?? 'error'} — ${res.error.message}`)
    return res
  }) as typeof client.emails.send
  return client
}
