/**
 * Számlázz.hu — Számla Agent API kliens (automata e-számla kiállítás).
 *
 * A Stripe sikeres fizetése (`invoice.paid` webhook) után hívjuk: kiállít egy AAM (alanyi
 * adómentes, 0% ÁFA) számlát a fizető fiók tulajának, és a Számlázz.hu emailben elküldi neki.
 *
 * Hitelesítés: Agent kulcs (`<szamlaagentkulcs>`), CSAK kisbetűs. A kulcs a `SZAMLAZZ_AGENT_KEY`
 * env-ben. Ha nincs kulcs, a `createInvoice` `{ ok:false, disabled:true }`-t ad — a hívó ezt
 * némán átugorja (a fizetés attól még érvényes).
 *
 * TESZT vs. ÉLES — a Számlázz.hu HIVATALOS módja: külön TESZTFIÓK (Tesztüzem bekapcsolva) a saját
 * Agent kulcsával. A teszt/éles KIZÁRÓLAG a kulcson múlik: teszt-fiók kulcsa → nem-éles bizonylat,
 * nem megy a NAV-hoz, a fiók visszaállításakor törlődik. Éles fiók kulcsa → éles NAV-számla.
 * A KÓD ugyanaz mindkét esetben — nincs külön „teszt XML-flag". Élesítés = csak a kulcs cseréje.
 * (Forrás: Számlázz.hu ügyfélszolgálat + tudastar.szamlazz.hu/gyik/teszt-api-hozzaferes)
 * A `SZAMLAZZ_INVOICE_TEST` env csak NÁLUNK, a logban/UI-n jelzi, hogy teszt-kulccsal futunk.
 *
 * Az API `multipart/form-data` POST a `https://www.szamlazz.hu/szamla/`-ra, az XML az
 * `action-xmlagentxmlfile` mezőben. A válasz siker esetén az `szlahu_szamlaszam` fejlécben adja a
 * számlaszámot; hiba esetén az `szlahu_error_code`/`szlahu_error` fejlécekben.
 */

const AGENT_URL = 'https://www.szamlazz.hu/szamla/'

export interface InvoiceBuyer {
  name: string
  email: string
  zip?: string | null
  city?: string | null
  address?: string | null
  taxNumber?: string | null // adószám (cégeknél); AAM magánszemélynél üres
}

export interface InvoiceLine {
  label: string // tétel megnevezése (pl. „davelopment booking előfizetés — havi")
  grossHuf: number // bruttó = nettó AAM-nél (0% ÁFA)
}

export interface CreateInvoiceParams {
  buyer: InvoiceBuyer
  lines: InvoiceLine[]
  /** A comment/rendelésazonosító a számlán (pl. a Stripe invoice id) — nyomon követéshez. */
  orderRef?: string
  /** A fizetés már megtörtént (Stripe) → „kifizetett" számla. */
  paid?: boolean
  /**
   * Vendég-előleg bizonylatokhoz: az ÜZLET SAJÁT (dekódolt) Agent-kulcsa — ha jelen van, ez
   * használódik a platform saját `SZAMLAZZ_AGENT_KEY` env-je HELYETT. A platform saját
   * (SaaS-előfizetés) számlázása változatlanul az env-kulcsot használja (nem adja meg ezt).
   */
  agentKeyOverride?: string
  /** A számlán szereplő fizetési mód (helyszíni utalvány-kiállításnál készpénz/átutalás is
   *  lehet). Alapértelmezés: bankkártya — a Stripe-os fizetések így maradnak. */
  paymentMethod?: InvoicePaymentMethod
  /** ÁFA-kulcs — alapból AAM (a platform saját előfizetés-számlái így mennek) */
  vat?: InvoiceVat
}

export type InvoicePaymentMethod = 'card' | 'cash' | 'transfer'
/** A számla ÁFA-kulcsa — a kiállító adószámából (lib/vatFromTaxNumber): alanyi adómentes vagy 27%. */
export type InvoiceVat = 'AAM' | '27'
/** bruttóból nettó + ÁFA (27%-nál a bruttó marad pontosan az, amit a vendég fizetett) */
export function splitGross(grossHuf: number, vat: InvoiceVat = 'AAM'): { net: number; vatHuf: number; gross: number } {
  const gross = Math.round(grossHuf)
  if (vat !== '27') return { net: gross, vatHuf: 0, gross }
  const net = Math.round(gross / 1.27)
  return { net, vatHuf: gross - net, gross }
}
const FIZMOD: Record<InvoicePaymentMethod, string> = { card: 'bankkártya', cash: 'készpénz', transfer: 'átutalás' }
/** A számla megjegyzése: Stripe-azonosító csak valódi Stripe-fizetésnél (a helyszíni
 *  kiállítás belső `manual-…` azonosítója nem Stripe). */
export function invoiceComment(orderRef?: string): string {
  if (!orderRef) return ''
  return orderRef.startsWith('manual-') ? 'Helyszíni kiállítás' : `Stripe: ${orderRef}`
}

export type CreateInvoiceResult =
  | { ok: true; invoiceNumber: string; invoiceUrl: string | null; pdfBase64: string | null; test: boolean }
  | { ok: false; disabled: true }
  | { ok: false; disabled?: false; error: string; code?: string }

export function isSzamlazzEnabled(): boolean {
  return !!process.env.SZAMLAZZ_AGENT_KEY
}

/**
 * Jelzi, hogy TESZT-kulccsal futunk-e. FONTOS: ez CSAK a mi log/UI jelzésünk — a Számlázz.hu
 * oldalán a teszt/éles a KULCS-hoz tartozó fiók Tesztüzemétől függ, nem ettől a flagtől.
 * A tesztfiók kulcsával `true`-ra állítva a webhook/log jelezheti, hogy nem éles bizonylat készül.
 */
function isTestMode(): boolean {
  return process.env.SZAMLAZZ_INVOICE_TEST === 'true'
}

/** XML-escape a szabad szöveges mezőkhöz (név, cím, megnevezés). */
function xe(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** yyyy-MM-dd a mai napra (helyi idő). A Számlázz.hu ezt a formátumot várja. */
function todayYmd(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Számla-kiállító XML. AAM: minden tétel `afakulcs` = "AAM", az áfaérték 0.
 * A nettó = bruttó (0% ÁFA). A `fizetve=true` → kifizetett számla (a Stripe már beszedte).
 */
function buildXml(params: CreateInvoiceParams, now: Date): string {
  const key = params.agentKeyOverride ?? process.env.SZAMLAZZ_AGENT_KEY ?? ''
  const date = todayYmd(now)

  const tetelek = params.lines
    .map((l) => {
      const { net, vatHuf, gross } = splitGross(l.grossHuf, params.vat) // AAM: nettó = bruttó; 27%: a bruttóból visszafelé
      return `    <tetel>
      <megnevezes>${xe(l.label)}</megnevezes>
      <mennyiseg>1</mennyiseg>
      <mennyisegiEgyseg>db</mennyisegiEgyseg>
      <nettoEgysegar>${net}</nettoEgysegar>
      <afakulcs>${params.vat === '27' ? '27' : 'AAM'}</afakulcs>
      <nettoErtek>${net}</nettoErtek>
      <afaErtek>${vatHuf}</afaErtek>
      <bruttoErtek>${gross}</bruttoErtek>
    </tetel>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${xe(key)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>${date}</keltDatum>
    <teljesitesDatum>${date}</teljesitesDatum>
    <fizetesiHataridoDatum>${date}</fizetesiHataridoDatum>
    <fizmod>${FIZMOD[params.paymentMethod ?? 'card']}</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>hu</szamlaNyelve>
    <megjegyzes>${xe(invoiceComment(params.orderRef))}</megjegyzes>
    <fizetve>${params.paid ? 'true' : 'false'}</fizetve>
  </fejlec>
  <elado></elado>
  <vevo>
    <nev>${xe(params.buyer.name)}</nev>
    <irsz>${xe(params.buyer.zip)}</irsz>
    <telepules>${xe(params.buyer.city)}</telepules>
    <cim>${xe(params.buyer.address)}</cim>
    <email>${xe(params.buyer.email)}</email>
    <sendEmail>true</sendEmail>${params.buyer.taxNumber ? `\n    <adoszam>${xe(params.buyer.taxNumber)}</adoszam>` : ''}
  </vevo>
  <tetelek>
${tetelek}
  </tetelek>
</xmlszamla>`
}

/**
 * Számla kiállítása. A hívó (webhook) NE dobjon 500-at hiba esetén — a `{ ok:false }` ág
 * logolható és jelölhető, a fizetés érvényes marad. A totalGross-t csak validáláshoz számoljuk.
 */
export async function createInvoice(params: CreateInvoiceParams, now: Date = new Date()): Promise<CreateInvoiceResult> {
  if (!params.agentKeyOverride && !isSzamlazzEnabled()) return { ok: false, disabled: true }
  if (!params.lines.length) return { ok: false, error: 'Nincs számlázható tétel' }

  const xml = buildXml(params, now)

  // multipart/form-data az `action-xmlagentxmlfile` mezővel (a Számla Agent ezt várja).
  const form = new FormData()
  form.append('action-xmlagentxmlfile', new Blob([xml], { type: 'text/xml' }), 'szamla.xml')

  let res: Response
  try {
    res = await fetch(AGENT_URL, { method: 'POST', body: form })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hálózati hiba a Számlázz.hu felé' }
  }

  // A Számla Agent a státuszt/hibát fejlécekben adja vissza.
  const errorCode = res.headers.get('szlahu_error_code') || res.headers.get('x-szlahu-error-code')
  const errorMsg = res.headers.get('szlahu_error') || res.headers.get('x-szlahu-error-message')
  if (errorCode && errorCode !== '0') {
    return { ok: false, error: errorMsg ? decodeURIComponent(errorMsg) : `Számlázz.hu hiba (${errorCode})`, code: errorCode }
  }

  const invoiceNumber =
    res.headers.get('szlahu_szamlaszam') || res.headers.get('x-szlahu-szamlaszam') || ''
  if (!invoiceNumber) {
    const body = await res.text().catch(() => '')
    const m = body.match(/<hibauzenet>(.*?)<\/hibauzenet>/s)
    return { ok: false, error: m ? m[1] : 'Ismeretlen Számlázz.hu válasz (nincs számlaszám)' }
  }

  // valaszVerzio=2 esetén a body XML, amiben a <pdf> tag base64 PDF-et tartalmaz.
  let pdfBase64: string | null = null
  try {
    const body = await res.text()
    const pdfMatch = body.match(/<pdf>([\s\S]*?)<\/pdf>/)
    if (pdfMatch) {
      pdfBase64 = pdfMatch[1].replace(/\s/g, '')
    } else {
      // Ha mégis nyers PDF jönne (valaszVerzio=1 fallback)
      const buf = Buffer.from(body, 'binary')
      if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
        pdfBase64 = buf.toString('base64')
      } else {
        console.warn('[szamlazz] PDF nem található a válaszban, body (500 char):', body.slice(0, 500))
      }
    }
  } catch (e) {
    console.warn('[szamlazz] PDF kiolvasás hiba:', e)
  }

  return { ok: true, invoiceNumber, invoiceUrl: null, pdfBase64, test: isTestMode() }
}

/**
 * Egy MÁR kiállított számla PDF-jének lekérése a Számla Agenttől számlaszám alapján
 * (`action-szamla_agent_pdf`) — a vendégeknek kiállított számláknál nem tároljuk a PDF-et, a
 * Beállítások → Kiállított számlák listából kattintásra kérjük le az üzlet saját fiókjából.
 */
export async function fetchInvoicePdf(agentKey: string, invoiceNumber: string): Promise<{ ok: true; pdf: Buffer } | { ok: false; error: string }> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlapdf xmlns="http://www.szamlazz.hu/xmlszamlapdf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlapdf https://www.szamlazz.hu/szamla/docs/xsds/agentpdf/xmlszamlapdf.xsd">
  <szamlaagentkulcs>${xe(agentKey)}</szamlaagentkulcs>
  <szamlaszam>${xe(invoiceNumber)}</szamlaszam>
  <valaszVerzio>1</valaszVerzio>
</xmlszamlapdf>`
  const form = new FormData()
  form.append('action-szamla_agent_pdf', new Blob([xml], { type: 'text/xml' }), 'pdf.xml')
  let res: Response
  try {
    res = await fetch(AGENT_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hálózati hiba a Számlázz.hu felé' }
  }
  const errorCode = res.headers.get('szlahu_error_code') || res.headers.get('x-szlahu-error-code')
  const errorMsg = res.headers.get('szlahu_error') || res.headers.get('x-szlahu-error-message')
  if (errorCode && errorCode !== '0') return { ok: false, error: errorMsg ? decodeURIComponent(errorMsg) : `Számlázz.hu hiba (${errorCode})` }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { ok: true, pdf: buf }
  const m = buf.toString('utf8').match(/<hibauzenet>(.*?)<\/hibauzenet>/s)
  return { ok: false, error: m ? m[1] : 'A Számlázz.hu nem küldött PDF-et' }
}

/**
 * Egy kiállított számla sztornózása (Számla Agent, `action-szamla_agent_st`): ellenszámla a számlaszámra, a mai
 * dátummal. A vendég e-mailben megkapja, ha megadjuk a címét. Visszaadja a sztornó számla számát.
 */
export async function stornoInvoice(agentKey: string, invoiceNumber: string, buyerEmail?: string | null, now: Date = new Date()): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const date = todayYmd(now)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${xe(agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
  </beallitasok>
  <fejlec>
    <szamlaszam>${xe(invoiceNumber)}</szamlaszam>
    <keltDatum>${date}</keltDatum>
    <teljesitesDatum>${date}</teljesitesDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado></elado>
  <vevo>${buyerEmail ? `\n    <email>${xe(buyerEmail)}</email>\n  ` : ''}</vevo>
</xmlszamlast>`
  const form = new FormData()
  form.append('action-szamla_agent_st', new Blob([xml], { type: 'text/xml' }), 'storno.xml')
  let res: Response
  try {
    res = await fetch(AGENT_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hálózati hiba a Számlázz.hu felé' }
  }
  const errorCode = res.headers.get('szlahu_error_code') || res.headers.get('x-szlahu-error-code')
  const errorMsg = res.headers.get('szlahu_error') || res.headers.get('x-szlahu-error-message')
  if (errorCode && errorCode !== '0') return { ok: false, error: errorMsg ? decodeURIComponent(errorMsg) : `Számlázz.hu hiba (${errorCode})` }
  const number = res.headers.get('szlahu_szamlaszam') || res.headers.get('x-szlahu-szamlaszam') || ''
  if (!number) {
    const body = await res.text().catch(() => '')
    const m = body.match(/<hibauzenet>(.*?)<\/hibauzenet>/s)
    return { ok: false, error: m ? m[1] : 'Ismeretlen Számlázz.hu válasz (nincs sztornó számlaszám)' }
  }
  return { ok: true, number }
}
