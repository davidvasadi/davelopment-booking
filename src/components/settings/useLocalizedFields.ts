'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'

/** A dashboardról szerkeszthető localizált mezők egy üzletön (salon/restaurant). */
export interface LocalizedValues {
  // Szerkeszthető email-tartalom (tárgy + bevezető) típusonként. A visszaigazoló = booking_*.
  booking_email_subject: string
  booking_email_intro: string
  cancel_email_subject: string
  cancel_email_intro: string
  reminder_email_subject: string
  reminder_email_intro: string
  feedback_email_subject: string
  feedback_email_intro: string
  terms_sections: { title: string; body: string }[]
  good_to_know: { icon: string; title: string; body: string }[]
  /** Étterem-only: esemény-típusok (alkalmak). A `label` localizált, az icon/enabled globális. */
  event_types: { icon: string; label: string; enabled: boolean }[]
}

const EMPTY: LocalizedValues = {
  booking_email_subject: '',
  booking_email_intro: '',
  cancel_email_subject: '',
  cancel_email_intro: '',
  reminder_email_subject: '',
  reminder_email_intro: '',
  feedback_email_subject: '',
  feedback_email_intro: '',
  terms_sections: [],
  good_to_know: [],
  event_types: [],
}

/** A nyers (Payload) rekordból a localizált mezők kinyerése egy adott nyelven betöltve. */
function fromDoc(doc: Record<string, unknown>): LocalizedValues {
  const terms = Array.isArray(doc.terms_sections) ? doc.terms_sections : []
  const gtk = Array.isArray(doc.good_to_know) ? doc.good_to_know : []
  const evt = Array.isArray(doc.event_types) ? doc.event_types : []
  return {
    booking_email_subject: (doc.booking_email_subject as string) ?? '',
    booking_email_intro: (doc.booking_email_intro as string) ?? '',
    cancel_email_subject: (doc.cancel_email_subject as string) ?? '',
    cancel_email_intro: (doc.cancel_email_intro as string) ?? '',
    reminder_email_subject: (doc.reminder_email_subject as string) ?? '',
    reminder_email_intro: (doc.reminder_email_intro as string) ?? '',
    feedback_email_subject: (doc.feedback_email_subject as string) ?? '',
    feedback_email_intro: (doc.feedback_email_intro as string) ?? '',
    terms_sections: terms.map((s: Record<string, unknown>) => ({
      title: (s.title as string) ?? '',
      body: (s.body as string) ?? '',
    })),
    good_to_know: gtk.map((g: Record<string, unknown>) => ({
      icon: (g.icon as string) ?? 'info',
      title: (g.title as string) ?? '',
      body: (g.body as string) ?? '',
    })),
    event_types: evt.map((e: Record<string, unknown>) => ({
      icon: (e.icon as string) ?? 'party',
      label: (e.label as string) ?? '',
      enabled: (e.enabled as boolean) ?? true,
    })),
  }
}

/**
 * A localizált tartalom-mezők (email tárgy/intro, „jó tudni", feltételek) per-nyelv
 * szerkesztését kezeli a dashboard settings-formokban — a Payload admin nélkül.
 *
 * - A magyar (`hu`) baseline a már betöltött rekordból jön (`huValues`).
 * - Másik nyelvre váltva lustán betölti azt a `?locale=xx&fallback-locale=null` GET-tel
 *   (fallback kikapcsolva → üres marad, ami nincs bevíve), és cache-eli.
 * - Mentéskor az adott nyelvre PATCH-el (`?locale=xx`) — csak a localizált mezőket küldi.
 *
 * A HU mentését a forma normál mentés-útja végzi (a `hu` itt csak megjelenítés/baseline);
 * a `saveLocale('hu')` is működik (a normál PATCH-csel ekvivalens), de a formák a magyart a
 * saját fülmentésükkel írják.
 */
export function useLocalizedFields(opts: {
  collection: 'salons' | 'restaurants'
  id: number | string
  supported: Locale[] | null | undefined
  huValues: LocalizedValues
}) {
  const { collection, id, supported, huValues } = opts
  const available = useMemo(() => resolveAvailableLocales(supported), [supported])

  const [editLocale, setEditLocale] = useState<Locale>('hu')
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Per-nyelv értékcache. A magyar a baseline-ból indul; a többit lustán töltjük.
  const cacheRef = useRef<Partial<Record<Locale, LocalizedValues>>>({ hu: huValues })
  // Trigger a re-renderhez, amikor a cache vagy az aktív nyelv értéke változik.
  const [, force] = useState(0)
  const rerender = () => force((n) => n + 1)

  const current: LocalizedValues = cacheRef.current[editLocale] ?? EMPTY

  /** Nyelvváltás: ha még nincs cache-elve (és nem HU), betölti a Payloadból. */
  const selectLocale = useCallback(
    async (loc: Locale) => {
      if (loc === editLocale) return
      if (cacheRef.current[loc]) {
        setEditLocale(loc)
        return
      }
      if (loc === 'hu') {
        cacheRef.current.hu = huValues
        setEditLocale('hu')
        return
      }
      setLoading(true)
      try {
        const res = await fetch(
          `/api/${collection}/${id}?locale=${loc}&fallback-locale=null&depth=0`,
          { credentials: 'include' },
        )
        if (!res.ok) throw new Error()
        const doc = await res.json()
        cacheRef.current[loc] = fromDoc(doc)
        setEditLocale(loc)
      } catch {
        toast.error('A nyelv betöltése nem sikerült')
      } finally {
        setLoading(false)
      }
    },
    [collection, id, huValues, editLocale],
  )

  /** Az aktív nyelv egy mezőjének módosítása. */
  const setField = useCallback(
    <K extends keyof LocalizedValues>(key: K, value: LocalizedValues[K]) => {
      const base = cacheRef.current[editLocale] ?? EMPTY
      cacheRef.current[editLocale] = { ...base, [key]: value }
      setDirty(true)
      rerender()
    },
    [editLocale],
  )

  /** Az aktív (nem-HU) nyelv localizált mezőit menti a Payloadba. */
  const saveLocale = useCallback(async (): Promise<boolean> => {
    const values = cacheRef.current[editLocale] ?? EMPTY
    try {
      const res = await fetch(`/api/${collection}/${id}?locale=${editLocale}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          booking_email_subject: values.booking_email_subject,
          booking_email_intro: values.booking_email_intro,
          cancel_email_subject: values.cancel_email_subject,
          cancel_email_intro: values.cancel_email_intro,
          reminder_email_subject: values.reminder_email_subject,
          reminder_email_intro: values.reminder_email_intro,
          feedback_email_subject: values.feedback_email_subject,
          feedback_email_intro: values.feedback_email_intro,
          terms_sections: values.terms_sections,
          good_to_know: values.good_to_know,
          // Az esemény-típusok étterem-only mező — a szalon PATCH-be ne kerüljön bele.
          ...(collection === 'restaurants' ? { event_types: values.event_types } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      setDirty(false)
      return true
    } catch {
      toast.error('Mentés sikertelen')
      return false
    }
  }, [collection, id, editLocale])

  return { available, editLocale, current, loading, dirty, selectLocale, setField, saveLocale }
}
