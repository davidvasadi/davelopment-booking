'use client'

/**
 * Logó / ikon választó (design 24.2): az opciók MAGUK A FELTÖLTÖTT KÉPEK (kicsiben, a saját alakjukban — nem vágjuk), ha egy
 * kép nincs feltöltve, a helyén a neve áll („Ikon · nincs”); opcionálisan „Nincs”. Kis helyen is elfér (nem feliratos
 * szegmens). `dark`: a sötét gyors-sávon. A kiválasztott keretet kap.
 */
export type BrandPick = 'logo' | 'icon' | 'none'

export function BrandPicker({ value, onChange, logo, icon, none = false, dark = false, missingHref, className = '' }: {
  value: BrandPick
  onChange?: (v: BrandPick) => void
  logo?: string | null
  icon?: string | null
  /** „Nincs” opció (QR-kód, utalvány) */
  none?: boolean
  dark?: boolean
  /** ahol a hiányzó kép feltölthető (lib/brandImage › brandUploadHref) — a hiányzó opció mellett link */
  missingHref?: string
  className?: string
}) {
  const opts: { v: BrandPick; src: string | null | undefined; label: string }[] = [
    { v: 'logo', src: logo, label: 'Logó' },
    { v: 'icon', src: icon, label: 'Ikon' },
    ...(none ? [{ v: 'none' as const, src: null, label: 'Nincs' }] : []),
  ]
  const missing = opts.filter((o) => o.v !== 'none' && !o.src)
  const picker = (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full p-1 ${dark ? 'bg-white/10' : 'bg-ui-cell'} ${className}`} role="radiogroup">
      {opts.map((o) => {
        const on = value === o.v
        const body = o.src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={o.src} alt={o.label} title={o.label} className="h-6 w-auto max-w-[72px] object-contain" />
          : <span className={`whitespace-nowrap text-ui-label ${dark ? 'text-white/70' : 'text-ui-muted'}`}>{o.v === 'none' ? 'Nincs' : `${o.label} · nincs`}</span>
        const cls = `flex h-8 items-center rounded-full px-2.5 ${on ? (dark ? 'bg-white ring-2 ring-ui-yellow' : 'bg-white ring-2 ring-ui-dark') : ''}`
        return onChange
          ? <button key={o.v} type="button" role="radio" aria-checked={on} aria-label={o.label} onClick={() => onChange(o.v)} className={`ui-press ${cls}`}>{body}</button>
          : <span key={o.v} className={cls}>{body}</span>
      })}
    </span>
  )
  if (!missingHref || !missing.length) return picker
  // a hiányzó kép: link oda, ahol feltölthető (Foglalóoldal-szerkesztő › Arculat)
  return (
    <span className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      {picker}
      <a href={missingHref} className={`text-ui-label underline underline-offset-2 ${dark ? 'text-white/70 hover:text-white' : 'text-ui-muted hover:text-ui-text'}`}>
        {missing.map((m) => m.label).join(' és ')} feltöltése → Foglalóoldal › Arculat
      </a>
    </span>
  )
}
