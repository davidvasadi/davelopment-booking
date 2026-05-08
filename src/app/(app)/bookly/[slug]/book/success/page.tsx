import { formatDate } from '@/lib/utils'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ name?: string; service?: string; date?: string; time?: string }>
}) {
  const { slug } = await params
  const { name, service, date, time } = await searchParams

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Foglalás rögzítve!</h1>
          <p className="text-muted-foreground mt-1">
            Hamarosan visszaigazolást küldünk emailben.
          </p>
        </div>
        {(name || service || date) && (
          <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1 text-left">
            {name && <p><span className="text-muted-foreground">Név:</span> {name}</p>}
            {service && <p><span className="text-muted-foreground">Szolgáltatás:</span> {service}</p>}
            {date && <p><span className="text-muted-foreground">Időpont:</span> {formatDate(date)} {time ?? ''}</p>}
          </div>
        )}
        <Link href={`/bookly/${slug}`}>
          <Button variant="outline" className="w-full">Vissza a szalonhoz</Button>
        </Link>
      </div>
    </div>
  )
}
