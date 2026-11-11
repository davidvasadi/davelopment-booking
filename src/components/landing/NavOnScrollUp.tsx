'use client'

import { useEffect, useState } from 'react'
import { HeroNav } from '@/components/landing/sections/Hero'

/** Visszagörgetéskor előjövő menü: lefelé görgetve rejtve, felfelé görgetve (a hero alatt) lecsúszik a képernyő tetejére —
 *  ugyanaz a középre összehúzott menü, fehér, finoman elmosott sávon. A hero tetején a saját (álló) menü látszik. */
// mobilon TÖMÖR fehér: az iOS 26 Safari ennek a színét veszi a felső sávnak, az áttetszőt szürkének látja.
// Elrejtve `invisible` is (nem csak kitolva): különben az iOS 26 Safari ezt a fixed, tetőt érintő elemet veszi a felső
// sáv színének (fehér), a hero színes rétege helyett
export function NavOnScrollUp() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const on = () => {
      const y = window.scrollY
      if (y < 400) setShow(false)
      else if (y < last - 4) setShow(true)
      else if (y > last + 4) setShow(false)
      last = y
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <div aria-hidden={!show} className={`fixed inset-x-0 top-0 z-[60] border-b border-ui-divider bg-white px-4 py-2 lg:bg-white/85 lg:backdrop-blur-xl transition-[transform,visibility] duration-300 ease-out lg:px-5 ${show ? 'visible translate-y-0' : 'pointer-events-none invisible -translate-y-full'}`}>
      <div className="mx-auto max-w-[1040px]"><HeroNav theme="light" pillId="k2-nav-sticky" variant="plain" /></div>
    </div>
  )
}
