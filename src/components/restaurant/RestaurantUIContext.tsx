'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

/**
 * Az étterem-dashboard kliens-oldali UI állapota. A Foglalások oldalon a
 * timeline („Idővonal”) nézet teljes szélességet kíván, ezért bevezetjük a
 * **fókusz módot**: ilyenkor a bal oldali nav ikon-only-ra csukódik, és a napi
 * KPI kártyák elrejtődnek. A view állapot a {@link DailyView}-ban él, a nav és a
 * KPI sáv viszont külön komponensek — ez a provider köti össze őket.
 */
type RestaurantUIState = {
  /** Fókusz mód: timeline kapcsolja be, a nav kézi nyitása ki. Vezérli a KPI rejtést. */
  focusMode: boolean
  /** A desktop sidebar összecsukott (ikon-only) állapota. */
  navCollapsed: boolean
  /** Timeline-ra váltáskor: fókusz mód be (nav csuk + KPI rejt). */
  enterFocus: () => void
  /** Lista/Terem nézet vagy kézi nav-nyitás: fókusz mód ki (a view nem változik). */
  exitFocus: () => void
  /** A nav kézi nyit/csuk gombja. Nyitáskor kilép a fókusz módból. */
  toggleNav: () => void
}

const RestaurantUIContext = createContext<RestaurantUIState | null>(null)

export function RestaurantUIProvider({ children }: { children: React.ReactNode }) {
  const [focusMode, setFocusMode] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)

  const enterFocus = useCallback(() => {
    setFocusMode(true)
    setNavCollapsed(true)
  }, [])

  const exitFocus = useCallback(() => {
    setFocusMode(false)
    setNavCollapsed(false)
  }, [])

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev
      // Kézi kinyitás → kilépünk a fókusz módból (KPI visszajön), de a view marad.
      if (!next) setFocusMode(false)
      return next
    })
  }, [])

  return (
    <RestaurantUIContext.Provider value={{ focusMode, navCollapsed, enterFocus, exitFocus, toggleNav }}>
      {children}
    </RestaurantUIContext.Provider>
  )
}

/**
 * A provider olvasása. A `DashboardNav` salon variánsban is renderelődik, ahol
 * nincs provider — ezért hibadobás helyett egy semleges no-op alapértéket adunk.
 */
export function useRestaurantUI(): RestaurantUIState {
  const ctx = useContext(RestaurantUIContext)
  if (ctx) return ctx
  return {
    focusMode: false,
    navCollapsed: false,
    enterFocus: () => {},
    exitFocus: () => {},
    toggleNav: () => {},
  }
}
