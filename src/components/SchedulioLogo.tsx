import { cn } from '@/lib/utils'

type Variant = 'auto' | 'dark' | 'light'

interface Props {
  className?: string
  variant?: Variant
  alt?: string
}

const ALT = 'Schedulio by [davelopment]®'

export function SchedulioLogo({ className, variant = 'auto', alt = ALT }: Props) {
  if (variant === 'dark') {
    return <img src="/logo_schedulio_dark.svg" alt={alt} className={cn('w-auto', className)} />
  }
  if (variant === 'light') {
    return <img src="/logo_schedulio_light.svg" alt={alt} className={cn('w-auto', className)} />
  }
  return (
    <>
      <img src="/logo_schedulio_light.svg" alt={alt} className={cn('w-auto block dark:hidden', className)} />
      <img src="/logo_schedulio_dark.svg" alt={alt} className={cn('w-auto hidden dark:block', className)} />
    </>
  )
}
