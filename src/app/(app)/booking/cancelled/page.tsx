import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'

export default async function BookingCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ salon?: string; service?: string; date?: string; time?: string; error?: string; already?: string }>
}) {
  const { salon, service, date, time, error, already } = await searchParams
  const locale = await getLocale()

  const isError = !!error
  const isAlready = !!already

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">

        <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(113,113,122,0.15)' }}>
          <span className="text-2xl">{isError ? '✕' : '✓'}</span>
        </div>

        <div>
          {isError ? (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {error === 'not_found' ? t(locale, 'public.cancel.invalidTitle') : error === 'completed' ? t(locale, 'public.cancel.cannot') : t(locale, 'public.cancel.error')}
              </h1>
              <p className="text-zinc-500 text-sm mt-2">
                {error === 'not_found' && t(locale, 'public.cancel.invalidBody')}
                {error === 'completed' && t(locale, 'public.cancel.cannotBody')}
                {error === 'server' && t(locale, 'public.cancel.serverError')}
              </p>
            </>
          ) : isAlready ? (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.already')}</h1>
              <p className="text-zinc-500 text-sm mt-2">{t(locale, 'public.cancel.alreadyBody')}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight">{t(locale, 'public.cancel.doneTitle')}</h1>
              <p className="text-zinc-500 text-sm mt-2">{t(locale, 'public.cancel.doneBody')}</p>
            </>
          )}
        </div>

        {!isError && !isAlready && salon && (
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5 text-left space-y-2">
            {salon && <div className="flex justify-between text-sm"><span className="text-zinc-500">{t(locale, 'public.cancel.salon')}</span><span className="text-white font-medium">{salon}</span></div>}
            {service && <div className="flex justify-between text-sm"><span className="text-zinc-500">{t(locale, 'email.label.service')}</span><span className="text-white font-medium">{service}</span></div>}
            {date && <div className="flex justify-between text-sm"><span className="text-zinc-500">{t(locale, 'email.label.date')}</span><span className="text-white font-medium">{date} {time ?? ''}</span></div>}
          </div>
        )}

        <Link
          href="/"
          className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center"
        >
          {t(locale, 'public.cancel.backHome')}
        </Link>
      </div>
    </div>
  )
}
