import { t, type Locale } from '@/lib/i18n'

export type Section = { title?: string | null; body?: string | null; isProvider?: boolean }

export type CompanyInfo = {
  name?: string | null
  legal_name?: string | null
  tax_number?: string | null
  company_reg_number?: string | null
  registered_seat?: string | null
  email?: string | null
  phone?: string | null
  /** a vállalkozó saját adatkezelési tájékoztatója (már biztonságos http(s) link) */
  privacy_url?: string | null
}

export function providerSection(c: CompanyInfo | null | undefined, locale: Locale = 'hu'): Section | null {
  if (!c) return null
  const lines: string[] = []
  if (c.legal_name) lines.push(`${t(locale, 'public.terms.provider.legalName')}: ${c.legal_name}`)
  else if (c.name) lines.push(`${t(locale, 'public.terms.provider.name')}: ${c.name}`)
  if (c.registered_seat) lines.push(`${t(locale, 'public.terms.provider.seat')}: ${c.registered_seat}`)
  if (c.tax_number) lines.push(`${t(locale, 'public.terms.provider.taxNumber')}: ${c.tax_number}`)
  if (c.company_reg_number) lines.push(`${t(locale, 'public.terms.provider.regNumber')}: ${c.company_reg_number}`)
  if (c.email) lines.push(`${t(locale, 'public.terms.provider.email')}: ${c.email}`)
  if (c.phone) lines.push(`${t(locale, 'public.terms.provider.phone')}: ${c.phone}`)
  if (lines.length === 0) return null
  return { title: t(locale, 'public.terms.provider'), body: lines.join('\n'), isProvider: true }
}

export function buildTermsItems(
  sections: Section[] | null | undefined,
  company: CompanyInfo | null | undefined,
  locale: Locale = 'hu',
): Section[] {
  const userItems = (sections ?? []).filter((s) => (s.title && s.title.trim()) || (s.body && s.body.trim()))
  const provider = providerSection(company, locale)
  return provider ? [provider, ...userItems] : userItems
}

/** A feltételek szövege: elöl a szolgáltató adatai, utána a számozott pontok. `light`: fehér kártyán (a feltételek
 *  oldala, design 21.12), különben a foglaló sötét kártyáján. */
export function TermsContent({ items, light = false }: { items: Section[]; light?: boolean }) {
  return (
    <>
      {items.map((s, i) => {
        if (s.isProvider) {
          return (
            <section key={i} className={`mb-5 rounded-ui-inner px-4 py-3.5 ${light ? 'bg-ui-cell' : 'border border-white/10 bg-white/[0.06]'}`}>{/* ui-allow: a foglaló sötét kártyáján */}
              <h4 className={`mb-2 text-ui-label uppercase tracking-widest ${light ? 'text-ui-muted' : 'text-white/40'}`}>{s.title}</h4>
              {s.body?.trim() && <p className={`whitespace-pre-wrap text-ui-meta leading-relaxed ${light ? 'text-ui-text' : 'text-white/60'}`}>{s.body}</p>}
            </section>
          )
        }
        const sectionNo = items.slice(0, i).filter((x) => !x.isProvider).length + 1
        return (
          <section key={i} className={`border-t py-4 first:border-t-0 first:pt-0 ${light ? 'border-dashed border-ui-divider' : 'border-white/[0.07]'}`}>{/* ui-allow: a foglaló sötét kártyáján */}
            {s.title?.trim() && (
              <h4 className={`mb-2 flex items-center gap-2.5 text-ui-row ${light ? 'text-ui-text' : 'text-white'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ui-label ${light ? 'bg-ui-cell text-ui-text' : 'bg-white/15 text-white/70'}`}>{sectionNo}</span>
                {s.title}
              </h4>
            )}
            {s.body?.trim() && <p className={`whitespace-pre-wrap pl-[34px] text-ui-body leading-relaxed ${light ? 'text-ui-muted' : 'text-white/55'}`}>{s.body}</p>}
          </section>
        )
      })}
    </>
  )
}
