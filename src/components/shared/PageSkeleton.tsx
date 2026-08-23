/**
 * Általános betöltő-váz (`loading.tsx`) minden `force-dynamic` szerver-oldali oldalhoz,
 * aminek nincs saját, testreszabott skeletonja (pl. Áttekintés, Naptár, Munkatársak,
 * Backstage-oldalak). Szándékosan generikus forma (fejléc + KPI-sor + nagy kártya) —
 * nem pixelpontos másolata egyik oldalnak sem, csak a navigáláskori üres villanás ellen kell.
 * A Foglalások oldalnak van saját, testreszabott verziója: `BookingsPageSkeleton.tsx`.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse p-5 lg:p-0 space-y-5">
      {/* Fejléc-sáv: cím + gombok helye */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-48 rounded-full bg-zinc-200/70" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-zinc-200/70" />
          <div className="h-10 w-32 rounded-full bg-zinc-200/70" />
        </div>
      </div>

      {/* KPI-sor */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-zinc-100 bg-white p-4">
            <div className="h-3 w-16 rounded bg-zinc-200/70" />
            <div className="mt-3 h-5 w-10 rounded bg-zinc-200/70" />
          </div>
        ))}
      </div>

      {/* Nagy tartalom-kártya */}
      <div className="rounded-[28px] border border-zinc-100 bg-white p-5 sm:p-6">
        <div className="mb-5 h-6 w-40 rounded-full bg-zinc-200/70" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-2xl bg-zinc-100" style={{ opacity: i % 2 === 0 ? 0.9 : 0.5 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
