'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { UtensilsCrossed, Scissors, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { HoverArrow } from '@/components/ui/HoverArrow'

type BizType = 'salon' | 'restaurant'

/**
 * Több-üzlet: új szalon/étterem hozzáadása bejelentkezett felhasználónak.
 * Jelszó/újraregisztráció NÉLKÜL — csak az üzlet adatai. A POST /api/business/add köti a
 * meglévő userhez, beállítja az aktív üzletet és visszaadja a redirect-célt.
 */
export function NewBusinessForm({ alreadyPaying }: { alreadyPaying: boolean }) {
  const router = useRouter()
  const [type, setType] = useState<BizType>('salon')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      toast.error('Adj meg egy nevet (min. 2 karakter)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/business/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: name.trim(), city: city.trim() || undefined, phone: phone.trim() || undefined }),
      })
      const data = (await res.json().catch(() => null)) as { redirectTo?: string; error?: string } | null
      if (!res.ok || !data?.redirectTo) {
        throw new Error(data?.error || 'Nem sikerült létrehozni az üzletet')
      }
      toast.success('Üzlet létrehozva!')
      router.push(data.redirectTo)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-5">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="w-full max-w-md"
      >
        <motion.button
          variants={fadeUp}
          onClick={() => router.back()}
          className="group mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Vissza
        </motion.button>

        <motion.div variants={fadeUp} className="mb-7">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Új üzlet<br />hozzáadása</h1>
          <p className="mt-2 text-sm text-zinc-500">
            A meglévő fiókodhoz adsz hozzá egy új üzletet — nem kell újra bejelentkezned.
          </p>
        </motion.div>

        <form onSubmit={submit} className="space-y-5">
          {/* Típusválasztó */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
            {([
              { v: 'salon' as const, label: 'Szalon', icon: Scissors },
              { v: 'restaurant' as const, label: 'Étterem', icon: UtensilsCrossed },
            ]).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all',
                  type === v
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-md'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-bold">{label}</span>
              </button>
            ))}
          </motion.div>

          <motion.div variants={fadeUp}>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              {type === 'salon' ? 'Szalon neve' : 'Étterem neve'}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'salon' ? 'pl. Tóth Fodrászat' : 'pl. Kis Bistro'}
              className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none transition-colors"
              autoFocus
            />
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Város</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Budapest"
                className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+36 ..."
                className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none transition-colors"
              />
            </div>
          </motion.div>

          {/* Próbaidő-szabály jelzése */}
          <motion.div variants={fadeUp}>
            <div className={cn(
              'rounded-xl px-4 py-3 text-xs',
              alreadyPaying ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800',
            )}>
              {alreadyPaying
                ? 'A fiókod aktív előfizetésű, ezért ennek az üzletnek a díja azonnal hozzáadódik a havi előfizetésedhez (egy összevont számla).'
                : 'Ez az üzlet a fiókod közös próbaidőszaka alá kerül — még nem kell fizetned.'}
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <button
              type="submit"
              disabled={submitting}
              className="group w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Üzlet létrehozása
                  <HoverArrow className="h-4 w-4" />
                </>
              )}
            </button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  )
}
