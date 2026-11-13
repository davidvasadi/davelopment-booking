/** A helyszíni fizetés módja egy foglaláson (pl. „készpénz”) — az adatlap és a szerkesztő összegzése is ezt mutatja
 *  „Fizetés” címkével; az összeget nem ismételjük, az ott már szerepel. */
const METHOD: Record<string, string> = { cash: 'készpénz', card: 'bankkártya', transfer: 'átutalás', link: 'fizetési link' }

export function paidMethod(b: { paid_at?: string | null; pay_method?: string | null } | null | undefined): string | null {
  if (!b?.paid_at) return null
  return METHOD[b.pay_method ?? ''] ?? null
}
