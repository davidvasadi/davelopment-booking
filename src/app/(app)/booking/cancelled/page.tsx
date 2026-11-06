import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui-kit'
import { GuestResult, GuestShell } from '@/components/blocks/guest-pages'

/** Szalon: a lemondás eredménye (a megerősítő űrlap után ide jön a vendég) — design 21.12. */
export default async function BookingCancelledPage({ searchParams }: {
  searchParams: Promise<{ salon?: string; slug?: string; service?: string; date?: string; time?: string; error?: string; already?: string }>
}) {
  const { salon, slug, service, date, time, error, already } = await searchParams
  const locale = await getLocale()
  const biz = salon ? { name: salon } : null
  const home = slug ? `/${slug}` : null

  if (error) {
    const title = error === 'not_found' ? t(locale, 'public.cancel.invalidTitle') : error === 'completed' ? t(locale, 'public.cancel.cannot') : t(locale, 'public.cancel.error')
    const text = error === 'not_found' ? t(locale, 'public.cancel.invalidBody') : error === 'completed' ? t(locale, 'public.cancel.cannotBody') : t(locale, 'public.cancel.serverError')
    return <GuestShell biz={biz}><GuestResult tone="bad" title={title} text={text} /></GuestShell>
  }
  if (already) return <GuestShell biz={biz}><GuestResult tone="cell" title={t(locale, 'public.cancel.already')} text={t(locale, 'public.cancel.alreadyBody')} /></GuestShell>

  const rows: [string, string][] = [
    ...(service ? [[t(locale, 'email.label.service'), service] as [string, string]] : []),
    ...(date ? [[t(locale, 'public.cancel.when'), `${date} ${time ?? ''}`.trim()] as [string, string]] : []),
  ]
  return (
    <GuestShell biz={biz}>
      <GuestResult tone="ok" title={t(locale, 'public.cancel.doneTitle')} text={t(locale, 'public.cancel.doneBody')} rows={rows}>
        {home && <Button href={home}>{t(locale, 'public.cancel.backToPlace')}</Button>}
      </GuestResult>
    </GuestShell>
  )
}
