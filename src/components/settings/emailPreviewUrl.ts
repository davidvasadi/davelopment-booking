import { blocksToHtml, parseEmailBlocks, type ComposerBlock } from '@/lib/emailBlocks'

/** A settings „Email" fül előnézet-gombjához tartozó URL-építő. A jelenlegi
 *  (akár mentetlen) mező-állapotot átadja a /api/email-preview route-nak. A bevezető
 *  blokk-alapú — itt alakítjuk MÁR RENDERELT HTML-lé (ugyanaz a minta, mint a marketing
 *  hírlevél élő előnézete), a preview-route ezt kapja, nem nyers blokk-JSON-t. */
export function emailPreviewUrl(
  type: 'restaurant' | 'salon',
  v: {
    booking_email_intro?: unknown
    email_show_phone?: boolean | null
    email_show_email?: boolean | null
    email_show_address?: boolean | null
    email_show_directions?: boolean | null
    email_show_terms?: boolean | null
    email_contact_phone?: string | null
    email_directions_address?: string | null
  },
  locale: string = 'hu',
  /** Melyik email vázát renderelje: confirm | cancel | reminder | feedback | notify. */
  state: string = 'confirm',
  /** Az adott email-típus bevezető blokkjai (ha megadva, felülírja a v.booking_email_intro-t). */
  introOverride?: ComposerBlock[],
): string {
  const introBlocks = introOverride ?? parseEmailBlocks(v.booking_email_intro)
  const q = new URLSearchParams({
    type,
    locale,
    state,
    intro: blocksToHtml(introBlocks),
    phone: v.email_show_phone ? '1' : '0',
    cmail: v.email_show_email ? '1' : '0',
    addr: v.email_show_address ? '1' : '0',
    dir: v.email_show_directions ? '1' : '0',
    terms: v.email_show_terms === false ? '0' : '1',
    contactPhone: v.email_contact_phone ?? '',
    dirAddr: v.email_directions_address ?? '',
  })
  return `/api/email-preview?${q.toString()}`
}

/** Az előnézetet új lapon nyitja, űrlap-POST-tal (nem URL-paraméterekkel): a bevezető HTML
 *  hosszabb tartalomnál túllépte az URL-hossz korlátot, és az előnézet nem nyílt meg. */
export function openEmailPreview(...args: Parameters<typeof emailPreviewUrl>): void {
  const url = new URL(emailPreviewUrl(...args), window.location.origin)
  const form = document.createElement('form')
  form.method = 'post'
  form.action = url.pathname
  form.target = '_blank'
  form.style.display = 'none'
  for (const [k, v] of url.searchParams.entries()) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = k
    input.value = v
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  form.remove()
}
