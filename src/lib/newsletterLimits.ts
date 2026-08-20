/**
 * A hírlevél-küldés MINDEN fizetős csomaghoz (Starter/Pro/Egyedi) BEÉPÍTVE jár — nincs többé
 * önálló, kapcsolható hírlevél-csomag. A havi email-keret a csomag szerint dől el, lásd
 * `monthlyEmailCapForTier` a `src/lib/tier.ts`-ben.
 *
 * `hasActivePackage` a régi (kikapcsolható) modellből maradt meg, mindig `true`-t ad vissza —
 * a két publikus hívási hely (`RestaurantPublicView.tsx`, `[slug]/page.tsx`) így módosítás
 * nélkül helyesen viselkedik (a hírlevél-feliratkozás mindig elérhető a publikus oldalon).
 */
export function hasActivePackage(_pkg: string | null | undefined): boolean {
  return true
}
