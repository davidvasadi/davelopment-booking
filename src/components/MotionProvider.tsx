'use client'

import { MotionConfig } from 'framer-motion'

/**
 * Globális framer-motion konfiguráció.
 *
 * `reducedMotion="user"` — ha a látogató az operációs rendszerében bekapcsolta a
 * „csökkentett mozgás" beállítást (`prefers-reduced-motion: reduce`), a framer-motion
 * automatikusan kikapcsolja a `transform`/`layout` alapú animációkat (slide, scale,
 * parallax), és csak az `opacity`-átmeneteket engedi. Így egyetlen ponton teljesül a
 * `reduced-motion` akadálymentességi szabály az EGÉSZ appban (a `src/lib/motion.ts`
 * presetjeit használó ~20+ komponens is beleértve), a presetek módosítása nélkül.
 *
 * Lásd: docs/ui-ux-reference/accessibility-checklist.md §1 (reduced-motion), §7 (parallax-subtle).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
