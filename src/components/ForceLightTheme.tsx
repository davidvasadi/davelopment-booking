'use client'

import { ThemeProvider } from 'next-themes'

/**
 * A publikus profil- és foglaló-oldalak MINDIG világosak (mint a checkout-oldalak),
 * függetlenül a látogató rendszer-dark-módjától és a tárolt preferenciától.
 *
 * A (app) layout globális next-themes providere a rendszer szerint dark-ot is adhat;
 * itt egy nested provider `forcedTheme="light"`-tal felülírja azt a publikus fán —
 * a felhasználó dashboard-preferenciáját NEM írja át. darkMode:'class' → a `dark`
 * class nem kerül a fára, így a Tailwind dark: variánsok nem aktiválódnak.
 */
export function ForceLightTheme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="light">
      {children}
    </ThemeProvider>
  )
}
