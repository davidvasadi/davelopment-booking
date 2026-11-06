import { redirect } from 'next/navigation'

/** Az Asztalok a Beállításokba költözött (design 16.22: Beállítások › Asztalok & termek — a szerkesztő és az online
 *  kapacitás egy helyen). A régi cím (könyvjelző, Súgó, import „Asztalok megnyitása”) ide irányít. */
export default function RestaurantTablesPage() {
  redirect('/restaurant/settings?tab=tables')
}
