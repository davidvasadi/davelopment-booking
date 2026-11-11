/** Link a Beállítások › Számlák listára, ami az adott számlát rögtön meg is nyitja (IssuedInvoicesTable: ?invoice=…).
 *  Mindenhol ezt használjuk, ahol számlaszám látszik (utalvány, foglalás előleg-pillje, fizetés-lezárás). */
export function invoiceHref(kind: 'salon' | 'restaurant', number: string): string {
  const base = kind === 'restaurant' ? '/restaurant/settings' : '/dashboard/settings'
  return `${base}?tab=invoices&invoice=${encodeURIComponent(number)}`
}
