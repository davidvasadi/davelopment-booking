import { nextId, type ComposerBlock, type ColumnCell } from '@/lib/emailBlocks'

/**
 * Új, üres hírlevél-blokk létrehozása (a Marketing szerkesztő és a Vendég e-mailek szerkesztője használja).
 * A régi, külön blokk-szerkesztő felület innen 2026-11-07-én kikerült — sehol nem volt már bekötve.
 */
type InsertableType = ComposerBlock['type']

/** új, üres blokk — a Marketing szerkesztő (blokk-paletta, beszúrás-lap) is ezt használja */
export function newBlock(type: InsertableType, opts?: { cols?: number; kind?: 'image' | 'youtube'; url?: string }): ComposerBlock {
  const id = nextId()
  switch (type) {
    case 'button': return { id, type: 'button', label: 'Gomb szövege', url: '' }
    case 'divider': return { id, type: 'divider' }
    case 'button_row': return { id, type: 'button_row', items: [{ label: 'Első gomb', url: opts?.url ?? '' }, { label: 'Második gomb', url: '', bg: '#EEEEEE', color: '#383838' }] }
    case 'image': return { id, type: 'image', url: '', alt: '', link: '', kind: opts?.kind ?? 'image' }
    case 'section': return { id, type: 'section', html: '', bg: '#F7F5F0' }
    case 'columns': return { id, type: 'columns', cols: Array.from({ length: opts?.cols ?? 2 }, (): ColumnCell => ({ type: 'empty' })) }
    case 'social_links': return { id, type: 'social_links', links: [{ url: '' }] }
    case 'html': return { id, type: 'html', code: '' }
    case 'code': return { id, type: 'code', code: '' }
    case 'offers': return { id, type: 'offers', items: [{ name: '', was: '', now: '' }, { name: '', was: '', now: '' }] }
    case 'voucher': return { id, type: 'voucher', amount: '20 000 Ft', title: 'Ajándékutalvány', text: 'Online megveszed, e-mailben megy.', label: 'Utalványt veszek', url: opts?.url ?? '' }
    default: return { id, type, html: '' }
  }
}
