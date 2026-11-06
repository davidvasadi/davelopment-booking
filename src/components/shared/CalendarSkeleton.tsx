import { Card, Skeleton } from '@/components/ui-kit'

/**
 * A Naptár betöltő-váza (`loading.tsx`, szalon és étterem) — a kit <Skeleton>-jával (design 1.11), a Naptár
 * formájában: fejléc, eszköztár-pillek, desktopon a három oszlop (munkatársak · hónap · a nap), mobilon a kompakt hónap.
 */
export function CalendarSkeleton() {
  const person = (i: number) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton round className="h-8 w-8 shrink-0" />
      <span className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-2.5 w-1/3" /></span>
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  )
  const month = (compact: boolean) => (
    <Card className={compact ? 'lg:hidden' : ''}>
      <div className="flex items-center justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-28 rounded-full" /></div>
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
      <div className="mt-5 grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className={compact ? 'h-10' : 'h-20'} />)}
      </div>
    </Card>
  )
  return (
    <div className="space-y-5 p-5 lg:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="space-y-2"><Skeleton className="h-8 w-40 rounded-full" /><Skeleton className="h-3 w-56 lg:hidden" /></span>
        <span className="flex gap-2 max-lg:hidden"><Skeleton className="h-10 w-48 rounded-full" /><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-10 w-32 rounded-full" /></span>
      </div>
      <div className="flex gap-1.5 max-lg:hidden">
        <Skeleton className="h-10 w-56 rounded-full" />
        {['w-20', 'w-24', 'w-20', 'w-28'].map((w, i) => <Skeleton key={i} className={`h-10 rounded-full ${w}`} />)}
      </div>
      {month(true)}
      <div className="grid gap-[5px] max-lg:hidden xl:grid-cols-[minmax(0,1fr)_640px_minmax(0,1fr)]">
        <Card pad="xs">{Array.from({ length: 6 }, (_, i) => person(i))}</Card>
        {month(false)}
        <Card pad="xs">{Array.from({ length: 5 }, (_, i) => person(i))}</Card>
      </div>
    </div>
  )
}
