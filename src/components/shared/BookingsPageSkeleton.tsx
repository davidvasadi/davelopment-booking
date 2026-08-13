/**
 * Betöltő-váz a Foglalások/Asztalfoglalások oldalhoz (`loading.tsx`) — a szerver-oldali
 * adatlekérés (force-dynamic) alatt jelenik meg azonnal navigáláskor, amíg a valódi
 * `SalonDailyView`/`DailyView` adatai megérkeznek. Szándékosan durva/általános forma
 * (fejléc-sáv + rácsos kártya), nem pixelpontos másolat — csak a "villanás" ellen kell.
 */
export function BookingsPageSkeleton() {
  return (
    <div className="animate-pulse p-5 lg:p-0 space-y-5">
      {/* Fejléc-sáv: dátum-navigáció + nézet-váltó + gombok helye */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 rounded-full bg-zinc-200/70" />
          <div className="h-10 w-24 rounded-full bg-zinc-200/70" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-zinc-200/70" />
          <div className="h-10 w-10 rounded-full bg-zinc-200/70" />
          <div className="h-10 w-32 rounded-full bg-zinc-200/70" />
        </div>
      </div>

      {/* Rácsos kártya: laza idősáv-imitáció */}
      <div className="rounded-[28px] border border-zinc-100 bg-white p-5 sm:p-6">
        <div className="mb-5 h-6 w-40 rounded-full bg-zinc-200/70" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="flex items-center gap-3">
              <div className="h-4 w-12 shrink-0 rounded bg-zinc-200/70" />
              <div className="flex flex-1 gap-3">
                {Array.from({ length: 4 }).map((_, col) => (
                  <div
                    key={col}
                    className="h-14 flex-1 rounded-2xl bg-zinc-100"
                    style={{ opacity: (row + col) % 3 === 0 ? 0.9 : 0.4 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
