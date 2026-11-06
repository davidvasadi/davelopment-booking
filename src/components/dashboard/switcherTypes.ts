/** Egy üzlet a fiók-menü üzletváltójában (a szerver `Business`-éből leszűkítve a megjelenítéshez). A régi fejléc-váltó
 *  (StoreSwitcher) helyett a váltás a fiók-menüben (UserMenu) és a Beállítások › Telephelyek alatt van. */
export interface SwitcherBusiness {
  type: 'restaurant' | 'salon'
  id: string
  name: string
  slug: string
  logoUrl: string | null
}
