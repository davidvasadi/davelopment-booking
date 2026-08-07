import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'

// Teach tailwind-merge about shadcn custom CSS-variable colors so bg-zinc-50
// correctly overrides bg-background (and similar) instead of both surviving.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'bg-color': [
        { bg: ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency = 'HUF'): string {
  if (currency === 'HUF') {
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount)
  }
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy. MMMM d.', { locale: hu })
}

/** Rövid dátum-badge-hez: "Péntek, aug. 7." (nap + rövid hónap, év nélkül). */
export function formatDayBadge(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  const s = format(d, 'EEEE, MMM d.', { locale: hu })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Lokális idő szerinti YYYY-MM-DD (nem UTC — a `toISOString().slice(0,10)` időzóna-eltolna). */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Éjfél-átfordulásra biztos időtartam percben (a nevező sose 0 vagy negatív). */
export function durationMinutes(startMin: number, endMin: number): number {
  const d = endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin
  return Math.max(1, d)
}

export function getDayName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

/**
 * Payload a feltöltés pillanatában érvényes szerver-URL-t menti az adatbázisba (pl. localhost:3000).
 * Ha azóta portot váltottunk, a tárolt URL nem egyezik a futó szerverrel → normalizálni kell.
 */
export function fixMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+/.test(url)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
    return url.replace(/^http:\/\/localhost:\d+/, appUrl)
  }
  return url
}
