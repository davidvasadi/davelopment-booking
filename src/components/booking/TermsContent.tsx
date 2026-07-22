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

export function TermsContent({ items }: { items: Section[] }) {
  return (
    <>
      {items.map((s, i) => {
        if (s.isProvider) {
          return (
            <section
              key={i}
              className="mb-5 rounded-xl px-4 py-3.5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">
                {s.title}
              </h4>
              {s.body?.trim() && (
                <p className="text-[13px] leading-relaxed text-white/60 whitespace-pre-wrap">{s.body}</p>
              )}
            </section>
          )
        }
        const sectionNo = items.slice(0, i).filter((x) => !x.isProvider).length + 1
        return (
          <section
            key={i}
            className="py-4 first:pt-0 border-t first:border-t-0"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            {s.title?.trim() && (
              <h4 className="flex items-center gap-2.5 font-bold text-[15px] text-white mb-2">
                <span className="shrink-0 h-6 w-6 rounded-full bg-white/15 text-white/70 text-[11px] font-bold flex items-center justify-center">
                  {sectionNo}
                </span>
                {s.title}
              </h4>
            )}
            {s.body?.trim() && (
              <p className="text-sm leading-relaxed text-white/55 whitespace-pre-wrap pl-[34px]">{s.body}</p>
            )}
          </section>
        )
      })}
    </>
  )
}
