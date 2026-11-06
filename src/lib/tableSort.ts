'use client'

import { useState } from 'react'

/**
 * Rendezés a listákban (a kit `Th` `sort` / `onSort`-ja): az oszlopcímre kattintva rendez, újabb kattintásra fordít.
 * `sortRows`: szám, dátum (ISO), szöveg (magyar ábécé szerint, ékezethelyesen) — az üres érték mindig a végére kerül.
 */
export type SortDir = 'asc' | 'desc'
export type SortValue = string | number | Date | null | undefined

export function useTableSort<K extends string>(initial: { key: K; dir: SortDir } | null = null) {
  const [sort, setSort] = useState(initial)
  const toggle = (key: K) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  /** a `Th`-nak: `<Th {...th('sum')}>Összeg</Th>` */
  const th = (key: K) => ({ sort: sort?.key === key ? sort.dir : null, onSort: () => toggle(key) })
  return { sort, toggle, th }
}

const collator = new Intl.Collator('hu', { numeric: true, sensitivity: 'base' })
export function sortRows<T, K extends string>(rows: T[], sort: { key: K; dir: SortDir } | null, value: (row: T, key: K) => SortValue): T[] {
  if (!sort) return rows
  const m = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key)
    const ex = x == null || x === '', ey = y == null || y === ''
    if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1
    if (x instanceof Date && y instanceof Date) return (x.getTime() - y.getTime()) * m
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * m
    return collator.compare(String(x), String(y)) * m
  })
}
