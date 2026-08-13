'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const stored = (localStorage.getItem('theme') as Theme | null) ?? 'system'
    setTheme(stored)
    applyTheme(stored)
  }, [])

  function handleSetTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('theme', t)
    applyTheme(t)
  }

  return <Ctx.Provider value={{ theme, setTheme: handleSetTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)

// Az app NEM egy kész, végigvitt dark-mode dizájn — a legtöbb komponens explicit
// világos színekkel van stílusozva (a Backstage a kivétel, DE az is kézzel sötét, nem ezen a
// .dark CSS-class-mechanizmuson keresztül). Nincs sehol felhasználói dark-mode kapcsoló (a
// `useTheme` hookot semmi nem hívja) — a "system" alapérték ezelőtt CSENDBEN rákapcsolta a
// .dark class-t az egész appra, ha a tulaj OS-e sötét témás volt, ami a globals.css .dark{}
// felülírásait aktiválta azokon a (jellemzően shadcn-alap) komponenseken, amik még a generikus
// bg-background/border-input CSS-var-osztályokat használják — miközben a kézzel stílusozott
// komponensek világosak maradtak, "félig sötét, félig világos, olvashatatlan" UI-t okozva.
// Amíg nincs valódi, végigvitt dark-mode + felhasználói kapcsoló, a .dark SOSE aktiválódjon
// automatikusan az OS-preferencia alapján.
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
