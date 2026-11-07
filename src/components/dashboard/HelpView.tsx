'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { Button, EmptyState, IconButton, PageHead, SearchField } from '@/components/ui-kit'
import { HelpGroups } from '@/components/blocks/help'
import { helpGroups, type HelpVariant } from '@/lib/helpTopics'
import type { Capability } from '@/lib/permissions'

/**
 * Súgó — szalon és étterem (design 15.1–15.4): kereső (ékezet nélkül is, a részletekben is), a Bevezető indítása, és a
 * témák három csoportban; csak azok, amelyekhez a felhasználónak joga van. `#id` a címben: az a téma nyitva, odagörget.
 */
export function HelpView({ variant, capabilities }: { variant: HelpVariant; capabilities?: Capability[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string[]>([])
  // mobil: a fejléc kereső-ikonja nyitja a keresőmezőt (mint a Munkatársaknál)
  const [mobileSearch, setMobileSearch] = useState(false)
  useEffect(() => {
    // a nagyító ki-be kapcsol: másodszorra törli és bezárja (mint az X)
    const on = () => setMobileSearch((v) => { if (v) setQuery(''); return !v })
    window.addEventListener('davelopment:open-help-search', on)
    return () => window.removeEventListener('davelopment:open-help-search', on)
  }, [])
  const groups = useMemo(() => helpGroups(variant, capabilities ?? null, query), [variant, capabilities, query])
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  const tour = () => window.dispatchEvent(new Event('davelopment:open-onboarding'))

  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id || !groups.some((g) => g.topics.some((t) => t.id === id))) return
    setOpen((o) => [...new Set([...o, id])])
    const t = setTimeout(() => document.getElementById(`tip-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const body = groups.length
    ? <HelpGroups groups={groups} openIds={open} onToggle={toggle} />
    : <EmptyState icon={Search} title={`Nincs találat a „${query}” keresésre`} action={<Button variant="glass" onClick={() => setQuery('')}>Keresés törlése</Button>}>Próbáld más szóval — pl. „utalvány” vagy „előleg”.</EmptyState>

  return (
    <div className="p-4 lg:p-0">
      <div className="max-lg:hidden">
        <PageHead title="Súgó" sub="Minden a rendszerről egy helyen — nyiss ki egy témát a részletekért, vagy keress rá egy funkcióra."
          actions={<><SearchField className="w-[240px]" value={query} onChange={setQuery}>Keresés a súgóban</SearchField><Button variant="glass" icon={Sparkles} onClick={tour}>Bevezető indítása</Button></>} />
      </div>
      <div className="mb-4 lg:hidden">
        <div className="text-ui-num font-light leading-none text-ui-text">Súgó</div>
        {mobileSearch && (
          <div className="ui-pop-in mt-4 flex items-center gap-1.5">
            <SearchField autoFocus className="min-w-0 flex-1" value={query} onChange={setQuery}>Keresés a súgóban</SearchField>
            <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={() => { setQuery(''); setMobileSearch(false) }} />
          </div>
        )}
      </div>
      {body}
      <Button className="mt-4 w-full lg:hidden" icon={Sparkles} onClick={tour}>Bevezető indítása</Button>
    </div>
  )
}
