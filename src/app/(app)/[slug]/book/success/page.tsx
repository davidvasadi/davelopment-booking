import { formatDate } from '@/lib/utils'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui-kit'
import { GuestResult, GuestShell } from '@/components/blocks/guest-pages'

/** Foglalás sikeres (a régi foglalási útvonal vége; a mostani foglaló a kártyán belül mutatja) — design 21.12. */
export default async function BookingSuccessPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ name?: string; service?: string; date?: string; time?: string }>
}) {
  const { slug } = await params
  const { name, service, date, time } = await searchParams
  const locale = await getLocale()
  const rows: [string, string][] = [
    ...(name ? [[t(locale, 'email.label.name'), name] as [string, string]] : []),
    ...(service ? [[t(locale, 'email.label.service'), service] as [string, string]] : []),
    ...(date ? [[t(locale, 'email.label.time'), `${formatDate(date)} ${time ?? ''}`.trim()] as [string, string]] : []),
  ]
  return (
    <GuestShell biz={null}>
      <GuestResult tone="ok" title={t(locale, 'public.success.title')} text={t(locale, 'public.success.subtitle')} rows={rows}>
        <Button href={`/${slug}`}>{t(locale, 'public.success.back')}</Button>
      </GuestResult>
    </GuestShell>
  )
}
