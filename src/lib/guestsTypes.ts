import type { GuestTier } from '@/lib/guests'

/* A Vendégek oldal (design 7.1–7.8) view-modelljei — a szerver (lib/guestsData) állítja elő, a kliens (GuestsView) és a
 * blokkok (components/blocks/guests) használják. Szalon és étterem közös; az étteremnél töltött mezők jelölve. */

/** Egy sor a vendéglistában (7.2): a listához kell minden, a teljes adatlap külön töltődik. */
export interface GuestListRow {
  key: string
  name: string
  avatarUrl: string | null
  country: string | null
  tier: GuestTier
  blocked: boolean
  visits: number
  /** YYYY-MM-DD */
  lastVisit: string | null
  /** szalon: költés eddig (Ft); étterem: null */
  spend: number | null
  /** étterem: átlagos létszám */
  avgPax: number | null
  /** a következő foglalás napja (YYYY-MM-DD), ha van */
  next: string | null
}
export interface GuestListPage { total: number; page: number; pageCount: number; items: GuestListRow[] }

/** Egy korábbi látogatás az adatlapon: mi (szolgáltatás · munkatárs / asztal · létszám), mikor, mennyi. */
export interface GuestHistoryVM { date: string; what: string; amount: string | null }

/** A következő foglalás (7.2 sötét kártya): nap, idő, mi; étteremnél az alkalom ikonja is. */
export interface GuestNextVM { date: string; time: string | null; what: string; occasion: string | null; occasionIcon: string | null; /** a foglalás megjegyzése */ note: string | null }

/** A vendég teljes adatlapja (7.2, étteremnél 7.8) és a szerkesztő (7.4) adatai. */
export interface GuestVM {
  key: string
  name: string
  avatarUrl: string | null
  tier: GuestTier
  country: string | null
  phone: string | null
  email: string | null
  /** az első látogatás éve */
  since: string
  visits: number
  lastVisit: string | null
  /** szalon: „312 000 Ft” */
  spend: string | null
  noShow: number
  cancels: number
  /** étterem: „4,2 fő” */
  avgPax: string | null
  next: GuestNextVM | null
  guestNote: string | null
  internalNote: string | null
  /** a foglaláskor kitöltött egyéni kérdések (kérdésenként a legfrissebb válasz) */
  answers: { label: string; value: string }[]
  history: GuestHistoryVM[]
  rating: { average: number; count: number; comment: string | null } | null
  blocked: boolean
  blockReason: string | null
  /** étterem: a leggyakoribb asztal */
  favTable: string | null
  /** étterem: alkalmak (évforduló, születésnap) a foglalásokból — a legutóbbi dátummal */
  occasions: { label: string; date: string; icon: string | null }[]
  /** a vendég-rekord (szerkesztő 7.4) mezői */
  record: {
    birthday: string | null
    gender: 'female' | 'male' | 'other' | null
    tag: string | null
    billing: { name: string; taxNumber: string; email: string; postalCode: string; city: string; street: string } | null
    newsletter: { on: boolean; since: string | null }
    imported: { visits: number | null; cancels: number | null; revenue: number | null } | null
  }
}

/** A mai érkezések egy sora (7.1 sötét lista). */
export interface ArrivalVM {
  key: string
  guestKey: string
  name: string
  /** HH:MM */
  time: string
  /** „Géllakk · Szabina” / „T5 · 4 fő” */
  what: string
  iso: string | null
}
