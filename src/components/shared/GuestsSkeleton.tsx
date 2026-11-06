import { Card, Skeleton } from '@/components/ui-kit'

/**
 * A Vendégek betöltő-váza (`loading.tsx`, szalon és étterem) — a kit <Skeleton>-jával (design 1.11), a Vendégek
 * formájában: fejléc a csíkkal és a számokkal, térkép mellett a visszatérő arány és az érkezések, a négy szám, a lista
 * az adatlappal. Mobilon a lista.
 */
export function GuestsSkeleton() {
  const row = (i: number) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton round className="h-8 w-8 shrink-0" />
      <span className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-2.5 w-1/5" /></span>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
  return (
    <div className="space-y-5 p-5 lg:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="space-y-2"><Skeleton className="h-9 w-44 rounded-full" /><Skeleton className="h-3 w-52" /></span>
        <Skeleton className="h-10 w-28 rounded-full max-lg:hidden" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6 max-lg:hidden">
        <Skeleton className="h-14 w-[560px] max-w-full rounded-full" />
        <span className="flex gap-8">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-28" />)}</span>
      </div>
      <div className="grid gap-[5px] max-lg:hidden lg:h-[560px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-full rounded-ui-card" />
        <span className="flex flex-col gap-[5px]"><Skeleton className="h-40 rounded-ui-card" /><Skeleton className="flex-1 rounded-ui-card" /></span>
      </div>
      <Card pad="xs">{Array.from({ length: 8 }, (_, i) => row(i))}</Card>
    </div>
  )
}
