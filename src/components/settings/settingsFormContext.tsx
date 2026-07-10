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
 *  - a form NEM rajzolja a saját mentés-sávját (a hub KÖZÖS lebegő sávja menti),
 *  - az aktív fül = `controlledTab` (a bal lista dönti el).
 * Ha nincs (a form önállóan renderelődik) → a form a saját belső fülezését + mentés-sávját használja.
 *
 * A `reportDirty` + `registerApi` a FELFELÉ irányuló csatorna: a form jelzi az aktív fül
 * mentetlen-állapotát és regisztrálja a mentés/elvetés műveletet, hogy a hub egyetlen közös
 * „Mentetlen változások" sávból tudja menteni/elvetni az épp látszó form-fület.
 */
export type SettingsFormApi = {
  /** Az AKTÍV fül mentése (a form belső logikájával). `true`, ha sikeres. */
  save: () => Promise<boolean>
  /** Az AKTÍV fül változásainak elvetése (vissza az utoljára mentett állapotra). */
  discard: () => void
}

export type SettingsFormCtx = {
  /** melyik form-fület mutassa (general | booking | languages | email | documents | danger) */
  controlledTab: string
  /** a form ezen jelzi az aktív fül mentetlen-állapotát a hub közös mentés-sávjának */
  reportDirty?: (dirty: boolean) => void
  /** a form ezen regisztrálja a mentés/elvetés műveletet (a hub sávja ezt hívja) */
  registerApi?: (api: SettingsFormApi) => void
}

export const SettingsFormContext = createContext<SettingsFormCtx | null>(null)

export const useSettingsFormContext = () => useContext(SettingsFormContext)
