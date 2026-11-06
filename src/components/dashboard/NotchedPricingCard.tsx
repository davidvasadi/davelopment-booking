'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bemart-sarkú ("notched") pricing-kártya — a Figma-terv (node 342:1252 "Pricing") pontos
 * másolata: a jobb-felső sarok helyén egy recesz, amibe a "Legnépszerűbb"/"Jelenlegi" jelvény
 * illeszkedik, arany hatch-keret a kiemelt csomagnál, üveges kártya a többinél. Megosztott
 * komponens — a Marketing dashboard-oldal ÉS a Beállítások → Fizetések panel is ezt használja
 * a hírlevél-csomagválasztóhoz.
 */

const HATCH = 'repeating-linear-gradient(45deg, #F1CE45 0, #F1CE45 7px, #E6C238 7px, #E6C238 14px)'

/** A kártya tényleges renderelt pixel-méretét méri (ResizeObserver) — a bemart-sarkú
 *  clip-path-hoz kell ABSZOLÚT pixelben, hogy a sarok-radius pontosan ugyanaz legyen, mint a
 *  külső konténer `rounded-[30px]`-e (a Figma-arányos objectBoundingBox verzió ezt eltorzította
 *  responsive szélességnél, mert a sugár is arányosan skálázódott a dobozzal). */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // `useLayoutEffect` (NEM `useEffect`) — az első mérés így a böngésző festése ELŐTT, szinkron
  // fut le, tehát a kártya sosem jelenik meg átmenetileg bemarás nélkül (0 szélességgel), majd
  // "beugorva" a helyes clip-path-ra. Enélkül ez a kezdeti villanás úgy nézett ki, mintha maga a
  // bemarás szélessége animálódna, holott csak a késleltetett méréstől "ugrott" egyet.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // offsetWidth/Height (NEM getBoundingClientRect) — a clip-path a border-boxra vonatkozik,
    // de a saját transformját (pl. a belépő framer-motion scale-animációt) figyelmen kívül
    // hagyja, mert a clip-path az elem LOKÁLIS koordinátarendszerében ül, a transform pedig
    // utána alkalmazódik. getBoundingClientRect ezzel szemben a transformmal MÓDOSÍTOTT dobozt
    // adja vissza — ha az első mérés a scale:0.94 kezdőállapotban futott le (mert a kártya még
    // nem görgött be, a `whileInView` nem indult el), a bemart sarok örökre a kicsinyített
    // mérethez lett kirajzolva, és csak egy tényleges layout-resize (pl. ablakátméretezés)
    // méri újra helyesen — ez okozta az "frissítéskor elcsúszik, átméretezésre helyreáll" hibát.
    const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * Lekerekített téglalap ABSZOLÚT pixel `clip-path: path(...)`-ja — a felső-jobb SAROK helyén
 * (nem attól elszigetelve) egy recesz, ami a kártya TETEJÉTŐL és JOBB SZÉLÉTŐL indul (a normál
 * sarok-lekerekítést ott felváltja), mélységig/szélességig lemetszve. A radius MINDIG megegyezik
 * a külső hatch-konténer `rounded-[30px]`-ével, mert ugyanazt az `r`-t kapja.
 */
function notchedCardPath(w: number, h: number, r: number, notch: { width: number; depth: number; radius: number }): string {
  if (w <= 0 || h <= 0) return 'none'
  const nr = Math.min(notch.radius, notch.depth / 2, notch.width / 2)
  const nx = w - notch.width
  const ny = notch.depth
  const d = `M${r} 0 H${nx - nr} Q${nx} 0 ${nx} ${nr} V${ny - nr} Q${nx} ${ny} ${nx + nr} ${ny} H${w - nr} Q${w} ${ny} ${w} ${ny + nr} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`
  return `path('${d}')`
}

const CARD_RADIUS = 30
const NOTCH_DEPTH = 50
const NOTCH_RADIUS = CARD_RADIUS
// A jelvény körüli belső margó a recesz-kivágásban.
const NOTCH_PAD_X = 20
// FIX recesz-szélesség (NEM a ténylegesen mért jelvény-szélességből számolva) — elég széles a
// leghosszabb valós jelvényhez ("Legjobb deal" + pötty). Korábban ResizeObserver mérte a jelvény
// szövegét, de ez a webfont betöltése UTÁN újramért (a kezdeti méret a fallback betűtípussal
// készült), ami úgy nézett ki, mintha maga a bemarás szélessége animálódna — a fix szélesség ezt
// teljesen kizárja, a jelvény mindig ugyanabban a recesz-méretben, jobbra igazítva jelenik meg.
const NOTCH_WIDTH = 90

export function NotchedPricingCard({ featured, badgeLabel, dotColor = '#A8A496', title, priceStrike, priceMain, priceUnit, sub, extra, feats, cta }: {
  featured: boolean
  badgeLabel: string | null
  /** A jelvény melletti kis színes pötty — csomagonként eltérő, hogy a szinteket vizuálisan
   *  is megkülönböztesse (nem csak a szöveg). Alapból semleges szürke. */
  dotColor?: string
  title: string
  /** Áthúzott, halványabb "eredeti" ár a `priceMain` ELŐTT (pl. éves kedvezménynél a havi
   *  listaár) — csak akkor jelenik meg, ha meg van adva. */
  priceStrike?: string
  priceMain: string
  priceUnit: string
  sub: string
  /** Opcionális extra tartalom az ár/alcím ALATT, a szaggatott elválasztó ELŐTT (pl. havi/éves
   *  ciklus-váltó egy csúszkával) — a legtöbb hívónak nincs rá szüksége. */
  extra?: React.ReactNode
  feats: { label: string; included: boolean }[]
  cta: React.ReactNode
}) {
  const [innerRef, size] = useElementSize<HTMLDivElement>()
  // A recesz MINDIG ott van, minden kártyán (egységes sziluett), FIX szélességgel — lásd
  // `NOTCH_WIDTH` fenti megjegyzését. Reszponzív védelem: a recesz SOSE lehet szélesebb, mint a
  // kártya saját mért szélességének ~62%-a — keskeny elrendezésnél a jelvény szövege inkább
  // kisebb betűvel fér el, nem törheti szét a geometriát.
  const rawNotchWidth = badgeLabel ? NOTCH_WIDTH : 90
  const notchWidth = size.width > 0 ? Math.min(rawNotchWidth, size.width * 0.62) : rawNotchWidth
  const clipPath = notchedCardPath(size.width, size.height, CARD_RADIUS, { width: notchWidth, depth: NOTCH_DEPTH, radius: NOTCH_RADIUS })

  const body = (
    <div
      ref={innerRef}
      className={cn('flex h-full flex-col rounded-[30px] p-5 pt-8 sm:p-6 sm:pt-9', featured ? 'bg-ui-dark text-white' : 'dav-card-glass')}
      style={{ clipPath }}
    >
      <div className={cn('text-[20px] font-light leading-7 tracking-[-0.02em]', featured ? 'text-white' : 'text-ui-text')}>{title}</div>
      <div className="mt-2 flex items-end gap-2">
        {priceStrike && (
          <span className={cn('text-[22px] font-light leading-none line-through', featured ? 'text-white/30' : 'text-ui-muted')}>{priceStrike}</span>
        )}
        <span className={cn('text-[36px] font-light leading-none tracking-[-0.03em]', featured ? 'text-ui-yellow' : 'text-ui-text')}>{priceMain}</span>
        <span className={cn('mb-0.5 text-[15px] font-medium', featured ? 'text-white/50' : 'text-ui-muted')}>{priceUnit}</span>
      </div>
      <div className={cn('mt-1.5 text-[12px] font-medium', featured ? 'text-white/50' : 'text-ui-muted')}>{sub}</div>
      {extra && <div className="mt-3.5">{extra}</div>}
      <div className={cn('my-4 border-t border-dashed', featured ? 'border-white/15' : 'border-ui-divider')} />
      <div className="flex flex-1 flex-col gap-3">
        {feats.map((f, i) => <Feat key={i} dark={featured} included={f.included}>{f.label}</Feat>)}
      </div>
      <div className="mt-6">{cta}</div>
    </div>
  )

  return (
    <div className="relative flex h-full flex-col">
      {badgeLabel && (
        <span
          className={cn('absolute z-10 flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold sm:text-[12.5px]', featured ? 'text-ui-dark' : 'text-ui-text')}
          style={{ right: NOTCH_PAD_X, top: NOTCH_DEPTH / 2, transform: 'translateY(-50%)', maxWidth: notchWidth - NOTCH_PAD_X * 1.5 }}
        >
          {badgeLabel}
          <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: dotColor }} />
        </span>
      )}
      {featured ? (
        <div className="h-full rounded-[30px] p-[3px]" style={{ backgroundImage: HATCH, boxShadow: '0 30px 60px -26px rgba(40,35,15,.5)' }}>
          {body}
        </div>
      ) : body}
    </div>
  )
}

export function Feat({ dark, included = true, children }: { dark?: boolean; included?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={included ? { background: '#74AA19' } : undefined}
      >
        {included
          ? <Check className="h-3 w-3" strokeWidth={3} style={{ color: '#1D1C19' }} />
          : <X className="h-3 w-3" strokeWidth={2.5} style={{ color: dark ? 'rgba(255,255,255,.35)' : '#B8B2A0' }} />}
      </span>
      <span className={cn('text-[12.5px] font-medium', !included ? (dark ? 'text-white/35' : 'text-ui-muted') : dark ? 'text-white/70' : 'text-ui-muted')}>{children}</span>
    </div>
  )
}
