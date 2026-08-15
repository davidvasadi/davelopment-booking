import Link from 'next/link'

export default async function MarketingUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const isError = !!error

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(113,113,122,0.15)' }}
        >
          <span className="text-2xl">{isError ? '✕' : '✓'}</span>
        </div>

        <div>
          {isError ? (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight">Érvénytelen link</h1>
              <p className="text-zinc-500 text-sm mt-2">Ez a leiratkozó link már nem érvényes, vagy hiba történt. Kérjük, próbáld újra a legutóbbi hírlevélben kapott linkkel.</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight">Sikeresen leiratkoztál</h1>
              <p className="text-zinc-500 text-sm mt-2">Mostantól nem küldünk több marketing-hírlevelet erre a címre. A foglalásaiddal kapcsolatos emaileket (visszaigazolás, emlékeztető) ez nem érinti.</p>
            </>
          )}
        </div>

        <Link
          href="/"
          className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center"
        >
          Vissza a főoldalra
        </Link>
      </div>
    </div>
  )
}
