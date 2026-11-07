import { Card, Skeleton } from '@/components/ui-kit'

/**
 * Általános betöltő-váz (`loading.tsx`) minden `force-dynamic` szerver-oldali oldalhoz, aminek nincs saját váza
 * (pl. Áttekintés, Munkatársak). A kit <Skeleton>-jával és <Card>-jával (design 1.11) — ugyanaz a szín és forma,
 * mint a többi vázé (Vendégek, Naptár). Szándékosan általános: fejléc + számok + nagy kártya.
 * A Foglalások oldalnak saját váza van: `BookingsPageSkeleton.tsx`.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-5 p-5 lg:p-0">
      {/* fejléc: cím + gombok helye */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48 rounded-full" />
        <span className="flex items-center gap-2"><Skeleton round className="h-11 w-11" /><Skeleton className="h-11 w-32 rounded-full" /></span>
      </div>
      {/* számok */}
      <div className="grid grid-cols-2 gap-[5px] sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} pad="sm"><Skeleton className="h-3 w-16" /><Skeleton className="mt-3 h-6 w-12" /></Card>
        ))}
      </div>
      {/* nagy tartalom-kártya */}
      <Card>
        <Skeleton className="mb-5 h-6 w-40 rounded-full" />
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 rounded-ui-inner" />)}</div>
      </Card>
    </div>
  )
}
