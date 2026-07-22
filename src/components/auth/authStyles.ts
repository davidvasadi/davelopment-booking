/**
 * Közös Crextio-stílusú osztályok az auth-felülethez (login, register wizardok).
 * Egy helyen → a tempó/kinézet globálisan hangolható innen (mint a motion.ts az animációknál).
 *
 * Tokenek: docs/ui-ux-reference + globals.css `--dav-*`. A mezők FEHÉREK (nem krém) — lásd a
 * „nincs krém a mezőkön" szabályt: bg-white + border-line-strong + gold fókusz.
 */

/** Fő szöveges input (világos felületen, pl. a jobb panel / kártya). */
export const authInputBase =
  'w-full h-[50px] rounded-[14px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 px-4 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'

/** Input a SÖTÉT panelen / mobil splash-en (ink-dark háttéren). */
export const authInputDark =
  'w-full h-[50px] rounded-[14px] bg-white/[0.06] border border-white/10 text-white placeholder:text-white/35 px-4 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:border-gold/50 backdrop-blur-[10px]'

/** Mező-címke. */
export const authLabelBase = 'text-[12.5px] font-medium text-ink-soft'

/** Címke a sötét panelen. */
export const authLabelDark = 'text-[12.5px] font-medium text-white/60'

/** Elsődleges CTA pill (sötét gomb világos felületen). */
export const authPillBtn =
  'w-full h-12 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 touch-manipulation'

/** Elsődleges CTA a sötét panelen / splash-en (fehér gomb sötét felületen). */
export const authPillBtnLight =
  'w-full h-14 rounded-dav-pill bg-white hover:bg-white/95 text-ink font-semibold text-base transition-colors disabled:opacity-40 flex items-center justify-center gap-2 backdrop-blur-[10px] touch-manipulation'

/** Másodlagos / ghost gomb (keretes, transzparens). */
export const authGhostBtn =
  'w-full h-12 rounded-dav-pill border border-line-strong text-ink font-medium text-sm transition-colors hover:bg-paper flex items-center justify-center gap-2 touch-manipulation'

/** Ghost gomb a sötét panelen. */
export const authGhostBtnDark =
  'w-full h-14 rounded-dav-pill border border-white/15 text-white/80 font-medium text-base transition-colors hover:bg-white/5 backdrop-blur-[10px] flex items-center justify-center gap-2 touch-manipulation'

/** „vagy" elválasztó a Google-gomb fölött (világos). */
export const authDivider = 'flex items-center gap-3 text-[11px] uppercase tracking-widest text-ink-soft2'
export const authDividerDark = 'flex items-center gap-3 text-[11px] uppercase tracking-widest text-white/40'

/** Állapot-ikon box (siker/hiba a wizard végén / forgot success). */
export const authIconBox = 'h-14 w-14 rounded-2xl bg-gold/15 flex items-center justify-center'

/** Piros hibaszöveg a mező alatt. */
export const authErrorText = 'text-xs text-bad'
export const authErrorTextDark = 'text-xs text-red-400'

/** A látható márkanév az auth-felületen (szöveges hivatkozásokhoz). */
export const BRAND_NAME = 'davelopment booking'
export const BRAND_COPYRIGHT = '© 2026 [davelopment]®'
