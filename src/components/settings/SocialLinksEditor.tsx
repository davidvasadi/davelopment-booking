'use client'

import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'

/**
 * Közösségi linkek szerkesztője — a hírlevél-szerkesztő (NewsletterBlockEditor) mintáját
 * követi: NINCS kézi platform-választó, a felhasználó csak beilleszti a linket, az ikont a
 * domainből ismerjük fel élőben (lib/socialLinks.ts). Bármilyen platform linkje működik.
 */
export function SocialLinksEditor({
  value, onChange, inputClassName,
}: {
  value: string[]
  onChange: (next: string[]) => void
  inputClassName?: string
}) {
  const update = (i: number, url: string) => {
    const next = [...value]
    next[i] = url
    onChange(next)
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, ''])

  return (
    <div className="space-y-2">
      {value.map((url, i) => {
        const platform = url.trim() ? detectPlatform(url) : null
        return (
          <div key={i} className="flex items-center gap-2">
            <img
              src={platform ? socialIconDataUri(platform) : socialIconDataUri('website')}
              alt={platform ? SOCIAL_LABELS[platform] : ''}
              className={`h-9 w-9 shrink-0 rounded-full ${platform ? '' : 'opacity-30'}`}
            />
            <Input
              className={inputClassName}
              value={url}
              onChange={(e) => update(i, e.target.value)}
              type="url"
              placeholder="https://instagram.com/felhasznalonev"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Link eltávolítása"
              className="shrink-0 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-bad/10 hover:text-bad"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" /> Link hozzáadása
      </button>
    </div>
  )
}
