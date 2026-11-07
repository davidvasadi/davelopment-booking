import { Card, Skeleton } from '@/components/ui-kit'

/**
 * Betöltő-váz a Foglalások oldalhoz (`loading.tsx`, szalon és étterem) — navigáláskor azonnal, amíg a napi nézet adatai
 * megérkeznek. A kit <Skeleton>-jával és <Card>-jával (design 1.11), a többi vázzal egyező színnel; durva forma:
 * fejléc (dátum + gombok), alatta az idővonal-szerű kártya.
 */
export function BookingsPageSkeleton() {
  return (
    <div className="space-y-5 p-5 lg:p-0">
      {/* fejléc: cím, dátum-lapozó, gombok */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48 rounded-full" />
        <span className="flex items-center gap-2">
          <Skeleton round className="h-11 w-11" /><Skeleton className="h-11 w-44 rounded-full" /><Skeleton round className="h-11 w-11" />
          <Skeleton round className="h-11 w-11 max-lg:hidden" /><Skeleton round className="h-11 w-11 max-lg:hidden" /><Skeleton className="h-11 w-36 rounded-full max-lg:hidden" />
        </span>
      </div>
      {/* idővonal-szerű kártya */}
      <Card>
        <Skeleton className="mb-5 h-3 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton round className="h-9 w-9 shrink-0" />
              <Skeleton className="h-14 flex-1 rounded-ui-inner" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
