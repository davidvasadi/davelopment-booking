import { nextId, type ComposerBlock } from '@/lib/emailBlocks'
import type { Segment } from '@/lib/marketingSegments'
import type { Locale } from '@/lib/i18n'
import { templateCopy } from '@/lib/marketingTemplateCopy'

/**
 * A Marketing sablon-betöltője (design 13.8: a sablon-szövegek étteremre szólnak) — kész, kampány-típusú levelek
 * blokkokként, a tárggyal és a javasolt célcsoporttal. Felépítésük a bevált hírlevél-minta: figyelemfelkeltő cím,
 * személyes megszólítás, a vendég haszna pontokba szedve, egyetlen jól látható gomb, alatta a sürgetés / apró betű.
 * A számok, árak és ajánlatok minták — betöltés után átírandók; a kép-helyekre a saját fotó kerül.
 * `{keresztnév}` helyére küldéskor a vendég neve.
 */

/** `locale`: a sablon szövegének nyelve (a szerkesztőben épp kiválasztott nyelv) */
export type TemplateCtx = { restaurant: boolean; bookingUrl: string; logo?: string | null; social?: string[]; locale?: Locale }
export type MarketingTemplate = { id: string; title: string; desc: string; subject: string; segments: Segment[]; blocks: ComposerBlock[] }

export function marketingTemplates({ restaurant: r, bookingUrl, logo, social = [], locale = 'hu' }: TemplateCtx): MarketingTemplate[] {
  const id = nextId
  const btn = (label: string): ComposerBlock => ({ id: id(), type: 'button', label, url: bookingUrl, width: 'full' })
  const img = (): ComposerBlock => ({ id: id(), type: 'image', url: '', alt: '', link: '', kind: 'image' })
  const pair = (): ComposerBlock => ({ id: id(), type: 'columns', cols: [{ type: 'image', url: '', alt: '' }, { type: 'image', url: '', alt: '' }] })
  const logoBlock = (): ComposerBlock[] => (logo ? [{ id: id(), type: 'image', url: logo, alt: 'Logó', link: '', kind: 'logo', width: 'md', align: 'center' }] : [])
  const footer = (): ComposerBlock[] => [{ id: id(), type: 'divider' }, ...(social.length ? [{ id: id(), type: 'social_links', links: social.map((url) => ({ url })), align: 'center' } as ComposerBlock] : [])]
  const title = (html: string, align?: 'center'): ComposerBlock => ({ id: id(), type: 'title', html, ...(align ? { align } : {}) })
  const sub = (html: string): ComposerBlock => ({ id: id(), type: 'heading', html })
  const text = (html: string, align?: 'center'): ComposerBlock => ({ id: id(), type: 'text', html, ...(align ? { align } : {}) })
  const small = (html: string, align?: 'center'): ComposerBlock => ({ id: id(), type: 'text', html, fontSize: 12, ...(align ? { align } : {}) })
  const list = (items: string[]): ComposerBlock => ({ id: id(), type: 'bullet_list', html: items.map((x) => `<li>${x}</li>`).join('') })
  const offers = (items: [string, string, string][]): ComposerBlock => ({ id: id(), type: 'offers', items: items.map(([name, was, now]) => ({ name, was, now })) })

  const c = templateCopy(locale, r)
  const promo: MarketingTemplate = {
    id: 'promo', title: c.promo.title, desc: c.promo.desc, subject: c.promo.subject, segments: ['all'],
    blocks: [img(), title(c.promo.h), text(c.promo.p), sub(c.promo.sub), list(c.promo.list), offers(c.promo.offers), btn(c.promo.btn), small(c.promo.small, 'center'), ...footer()],
  }
  const voucher: MarketingTemplate = {
    id: 'voucher', title: c.voucher.title, desc: c.voucher.desc, subject: c.voucher.subject, segments: ['all'],
    blocks: [img(), title(c.voucher.h), text(c.voucher.p), list(c.voucher.list), { id: id(), type: 'voucher', amount: c.voucher.amount, title: c.voucher.vTitle, text: c.voucher.vText, label: c.voucher.vLabel, url: bookingUrl }, small(c.voucher.small, 'center'), ...footer()],
  }
  const winback: MarketingTemplate = {
    id: 'winback', title: c.winback.title, desc: c.winback.desc, subject: c.winback.subject, segments: ['lapsed'],
    blocks: [...logoBlock(), title(c.winback.h, 'center'), text(c.winback.p, 'center'), list(c.winback.list), btn(c.winback.btn), small(c.winback.small, 'center'), ...footer()],
  }
  const news: MarketingTemplate = {
    id: 'news', title: c.news.title, desc: c.news.desc, subject: c.news.subject, segments: ['all'],
    blocks: [img(), title(c.news.h), text(c.news.p), pair(), list(c.news.list), btn(c.news.btn), small(c.news.small, 'center'), ...footer()],
  }
  const hours: MarketingTemplate = {
    id: 'hours', title: c.hours.title, desc: c.hours.desc, subject: c.hours.subject, segments: ['all'],
    blocks: [...logoBlock(), title(c.hours.h), text(c.hours.p), list(c.hours.list), btn(c.hours.btn), small(c.hours.small, 'center'), ...footer()],
  }
  // csoportra szabott: szalonnál a szülinaposok, étteremnél a céges vendégek (a „Kinek megy” szegmensei)
  const special: MarketingTemplate = {
    id: r ? 'company' : 'birthday', title: c.special.title, desc: c.special.desc, subject: c.special.subject, segments: [r ? 'company' : 'birthday'],
    blocks: r
      ? [img(), title(c.special.h), text(c.special.p), ...(c.special.list ? [list(c.special.list)] : []), btn(c.special.btn), small(c.special.small, 'center'), ...footer()]
      : [...logoBlock(), title(c.special.h, 'center'), text(c.special.p, 'center'), btn(c.special.btn), small(c.special.small, 'center'), ...footer()],
  }

  return [promo, voucher, winback, news, hours, special]
}
