import { formatDate } from '@/lib/utils'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n'

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ name?: string; service?: string; date?: string; time?: string }>
}) {
  const { slug } = await params
  const { name, service, date, time } = await searchParams
  const locale = await getLocale()

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4 sm:p-6">
      <div
        className="w-full max-w-md rounded-[34px] p-8 shadow-[0_34px_70px_-34px_rgba(80,70,30,.20),0_0_0_1px_rgba(120,110,70,.06)] sm:p-10"
        style={{ background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
      >
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold/20">
          <Check className="h-8 w-8 text-ink" strokeWidth={2.4} />
        </div>
        <div>
          <h1 className="text-[26px] font-light tracking-[-0.01em] text-ink">{t(locale, 'public.success.title')}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {t(locale, 'public.success.subtitle')}
          </p>
        </div>
        {(name || service || date) && (
          <div className="space-y-1 rounded-[18px] bg-white p-4 text-left text-[13.5px] shadow-[0_1px_2px_rgba(80,70,30,0.05),0_16px_38px_-30px_rgba(80,70,30,0.22)]">
            {name && <p><span className="text-ink-soft">{t(locale, 'email.label.name')}:</span> <span className="font-medium text-ink">{name}</span></p>}
            {service && <p><span className="text-ink-soft">{t(locale, 'email.label.service')}:</span> <span className="font-medium text-ink">{service}</span></p>}
            {date && <p><span className="text-ink-soft">{t(locale, 'email.label.time')}:</span> <span className="font-medium text-ink">{formatDate(date)} {time ?? ''}</span></p>}
          </div>
        )}
        <Link
          href={`/${slug}`}
          className="flex h-12 w-full items-center justify-center rounded-full bg-ink-dark text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {t(locale, 'public.success.back')}
        </Link>
      </div>
      </div>
    </div>
  )
}
