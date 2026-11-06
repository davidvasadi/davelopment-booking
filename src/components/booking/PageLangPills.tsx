'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LANG_COOKIE, type Locale } from '@/lib/i18n'
import { LangPills } from '@/components/blocks/public'
import { LangSwitcher } from './LangSwitcher'

/**
 * A foglalóoldal nyelv-váltója a sávban (design 21.1): pillek, az aktív fehér. Ugyanúgy vált, mint eddig: sütibe írja a
 * nyelvet és frissíti az oldalt — az URL nem változik (SEO: ugyanaz a canonical). Ha 3-nál több nyelv van, mobilon a
 * helytakarékos legördülő marad.
 */
export function PageLangPills({ current, available, mobile = false }: { current: Locale; available: Locale[]; mobile?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (available.length <= 1) return null
  if (mobile && available.length > 3) return <LangSwitcher current={current} available={available} variant="dark" />
  const select = (code: string) => {
    if (code === current) return
    document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    start(() => router.refresh())
  }
  return <LangPills langs={available.map((c) => ({ code: c, active: c === current }))} onSelect={select} busy={pending} />
}
