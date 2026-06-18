import { formatDate } from '@/lib/utils'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t(locale, 'public.success.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t(locale, 'public.success.subtitle')}
          </p>
        </div>
        {(name || service || date) && (
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1 text-left">
            {name && <p><span className="text-muted-foreground">{t(locale, 'email.label.name')}:</span> {name}</p>}
            {service && <p><span className="text-muted-foreground">{t(locale, 'email.label.service')}:</span> {service}</p>}
            {date && <p><span className="text-muted-foreground">{t(locale, 'email.label.time')}:</span> {formatDate(date)} {time ?? ''}</p>}
          </div>
        )}
        <Link href={`/${slug}`}>
          <Button variant="outline" className="w-full">{t(locale, 'public.success.back')}</Button>
        </Link>
      </div>
    </div>
  )
}
