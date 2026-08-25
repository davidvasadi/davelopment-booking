'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Send, Loader2, X } from 'lucide-react'

/**
 * Segítő megkeresés egy konkrét fiókhoz a `/backstage/churn` kockázat-listáiból — a cél NEM
 * fizetési felszólítás, hanem "elakadtál valahol? segítünk" jellegű, támogató üzenet. Ugyanazt
 * a már meglévő `/api/backstage/broadcast` végpontot hívja `target:'custom'`-mal, egyetlen
 * ownerId-vel — nem kellett hozzá új backend, a push-küldés is már be van kötve bele.
 */
const TEMPLATES: Record<'trial' | 'past_due', { title: string; body: string }> = {
  trial: {
    title: 'Elakadtál valahol?',
    body: 'Láttuk, hogy hamarosan lejár a próbaidőszakod, de még nem sokat foglaltál — ha bármi nem világos a beállításban, szívesen segítünk, csak válaszolj erre az üzenetre.',
  },
  past_due: {
    title: 'Gond volt a fizetéssel?',
    body: 'Úgy tűnik, a legutóbbi terhelés nem sikerült — ez leggyakrabban egyszerű kártya-probléma, nem szándékos lemondás. Ha segítségre van szükséged a rendezéshez, szólj nyugodtan.',
  },
}

export function HelpOutreachButton({ ownerId, ownerName, context }: { ownerId: string; ownerName: string; context: 'trial' | 'past_due' }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(TEMPLATES[context].title)
  const [body, setBody] = useState(TEMPLATES[context].body)
  const [sending, setSending] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  async function send() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/backstage/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, target: 'custom', ownerIds: [ownerId] }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Üzenet elküldve — ${ownerName}`)
      setOpen(false)
    } catch {
      toast.error('Nem sikerült elküldeni.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Segítő üzenet küldése"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft2 transition-colors hover:bg-white hover:text-ink"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-[18px] border border-line bg-white p-4 shadow-dav-card"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-ink">Segítő üzenet — {ownerName}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-ink-soft2 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-2 h-9 w-full rounded-[10px] border border-line bg-white px-3 text-[13px] text-ink focus:border-line-strong focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed text-ink focus:border-line-strong focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !title.trim() || !body.trim()}
            className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-ink-dark text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Küldés
          </button>
        </div>
      )}
    </div>
  )
}
