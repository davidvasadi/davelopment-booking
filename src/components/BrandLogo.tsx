import { cn } from '@/lib/utils'

type Variant = 'auto' | 'dark' | 'light'

interface Props {
  className?: string
  variant?: Variant
  alt?: string
}

const ALT = 'davelopment Booking'

export function BrandLogo({ className, variant = 'auto', alt = ALT }: Props) {
  if (variant === 'dark') {
    return <img src="/logo_davelopment_booking_dark.svg" alt={alt} className={cn('w-auto', className)} />
  }
  if (variant === 'light') {
    return <img src="/logo_davelopment_booking_light.svg" alt={alt} className={cn('w-auto', className)} />
  }
  return (
    <>
      <img src="/logo_davelopment_booking_light.svg" alt={alt} className={cn('w-auto block dark:hidden', className)} />
      <img src="/logo_davelopment_booking_dark.svg" alt={alt} className={cn('w-auto hidden dark:block', className)} />
    </>
  )
}
