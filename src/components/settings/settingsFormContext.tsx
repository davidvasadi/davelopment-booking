'use client'

import { createContext, useContext } from 'react'

/**
 * A Beállítások-hub (SettingsHub) és a benne MOUNTolt profil-form (Restaurant/Salon
 * SettingsForm) közötti vezérlés. A form-ot a page (Server Component) elemként adja át a
 * hubnak, ezért a `cloneElement`-tel injektált propok az RSC-határon NEM megbízhatóak — a
 * context viszont a fán keresztül tisztán leér a passzolt elemhez is.
 *
 * Ha a context JELEN van (a hub Providere köré rendereli a formot):
 *  - a form NEM rajzolja a saját vízszintes fül-sorát,
 *  - az aktív fül = `controlledTab` (a bal lista dönti el).
 * Ha nincs (a form önállóan renderelődik) → a form a saját belső fülezését használja.
 */
export type SettingsFormCtx = {
  /** melyik form-fület mutassa (general | booking | languages | email | documents | danger) */
  controlledTab: string
}

export const SettingsFormContext = createContext<SettingsFormCtx | null>(null)

export const useSettingsFormContext = () => useContext(SettingsFormContext)
