export type Section = { title?: string | null; body?: string | null }

/** A szolgáltató (cég) jogi adatai — ezekből generáljuk a feltételek élén álló blokkot. */
export type CompanyInfo = {
  name?: string | null
  legal_name?: string | null
  tax_number?: string | null
  company_reg_number?: string | null
  registered_seat?: string | null
  email?: string | null
  phone?: string | null
}

/** A cégadatokból egy „Szolgáltató adatai" szakaszt épít (üres mezők kimaradnak). */
export function providerSection(c?: CompanyInfo | null): Section | null {
  if (!c) return null
  const lines: string[] = []
  if (c.legal_name) lines.push(`Cégnév: ${c.legal_name}`)
  else if (c.name) lines.push(`Név: ${c.name}`)
  if (c.registered_seat) lines.push(`Székhely: ${c.registered_seat}`)
  if (c.tax_number) lines.push(`Adószám: ${c.tax_number}`)
  if (c.company_reg_number) lines.push(`Cégjegyzékszám: ${c.company_reg_number}`)
  if (c.email) lines.push(`E-mail: ${c.email}`)
  if (c.phone) lines.push(`Telefon: ${c.phone}`)
  if (lines.length === 0) return null
  return { title: 'Szolgáltató adatai', body: lines.join('\n') }
}

/** A „Szolgáltató adatai" + a feltétel-szakaszok egy listája (provider elöl). */
export function buildTermsItems(sections?: Section[] | null, company?: CompanyInfo | null): Section[] {
  const userItems = (sections ?? []).filter((s) => (s.title && s.title.trim()) || (s.body && s.body.trim()))
  const provider = providerSection(company)
  return provider ? [provider, ...userItems] : userItems
}

/**
 * A feltételek tagolt megjelenítése (modalban és külön oldalon is ezt használjuk):
 * a „Szolgáltató adatai" kiemelt kártya, a feltétel-szakaszok számozott listája
 * finom elválasztókkal.
 */
export function TermsContent({ items }: { items: Section[] }) {
  return (
    <>
      {items.map((s, i) => {
        const isProvider = s.title?.trim() === 'Szolgáltató adatai'
        if (isProvider) {
          return (
            <section
              key={i}
              className="mb-5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-100 dark:border-white/[0.06] px-4 py-3.5"
            >
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-white/40 mb-2">
                {s.title}
              </h4>
              {s.body?.trim() && (
                <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-white/60 whitespace-pre-wrap">{s.body}</p>
              )}
            </section>
          )
        }
        const sectionNo = items.slice(0, i).filter((x) => x.title?.trim() !== 'Szolgáltató adatai').length + 1
        return (
          <section
            key={i}
            className="py-4 first:pt-0 border-t border-zinc-100 dark:border-white/[0.06] first:border-t-0"
          >
            {s.title?.trim() && (
              <h4 className="flex items-center gap-2.5 font-bold text-[15px] text-zinc-900 dark:text-white mb-2">
                <span className="shrink-0 h-6 w-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-bold flex items-center justify-center">
                  {sectionNo}
                </span>
                {s.title}
              </h4>
            )}
            {s.body?.trim() && (
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-white/60 whitespace-pre-wrap pl-[34px]">{s.body}</p>
            )}
          </section>
        )
      })}
    </>
  )
}
