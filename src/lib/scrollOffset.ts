import type { useScroll } from 'framer-motion'

type Offset = NonNullable<NonNullable<Parameters<typeof useScroll>[0]>['offset']>

/**
 * A „cover” görgetési sáv (az elem alja belép → teteje kilép) úgy, hogy a framer NATÍV, hardveres ViewTimeline-ja
 * fusson. A framer beépített mintája fordítva van megadva (['end start', 'start end'] → `cover 0%–100%`), a JS-es
 * tartalékban (natív támogatás nélkül, pl. Firefox) viszont ugyanez fordított irányt jelentene — ezért csak natív
 * támogatásnál adjuk ezt, különben a hagyományos ['start end', 'end start']-et (ami ott helyesen fut).
 */
export const COVER_OFFSET: Offset =
  typeof window !== 'undefined' && 'ViewTimeline' in window ? ['end start', 'start end'] : ['start end', 'end start']

/**
 * A natív (WAAPI) görgetés-animáció a sávon KÍVÜL nem tartja az első/utolsó értéket: a böngésző az elem alapállapotáig
 * (pl. teljes opacity, transform nélkül) interpolál — ettől „össze-vissza” villog, és túl korán „visszazár”. Ezért a
 * bemeneti tartományt kiterjesztjük 0-ra és 1-re, a két végén az első/utolsó értéket ismételve.
 * Használat: `const [i, o] = padRange([0.2, 0.5], [0, 1]); useTransform(progress, i, o)`.
 */
export function padRange<T>(input: number[], output: T[]): [number[], T[]] {
  const i = [...input], o = [...output]
  if (i[0] > 0) { i.unshift(0); o.unshift(o[0]) }
  if (i[i.length - 1] < 1) { i.push(1); o.push(o[o.length - 1]) }
  return [i, o]
}
