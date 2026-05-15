'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type FormData = z.infer<typeof schema>

export function BackstageLoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Hibás email vagy jelszó')
      const json = await res.json()
      if (json?.user?.role !== 'admin') {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        throw new Error('Csak admin fiókok férhetnek hozzá')
      }
      router.push('/bookly/backstage')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bejelentkezés sikertelen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-white font-black text-xl tracking-tight">Bookly</p>
          <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-widest mt-0.5">Backstage</p>
        </div>

        <h1 className="text-white font-black text-2xl tracking-tight mb-1">Belépés</h1>
        <p className="text-zinc-500 text-sm mb-8">Operátori hozzáférés</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-sm">Email</Label>
            <input
              type="email"
              placeholder="admin@pelda.hu"
              className={`w-full h-11 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.email ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-600'}`}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-red-400">Érvényes email szükséges</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-400 text-sm">Jelszó</Label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`w-full h-11 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 pr-11 text-sm focus:outline-none transition-colors ${errors.password ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-600'}`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">Minimum 6 karakter</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-white text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 mt-2 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><span>Belépés</span><ArrowRight className="h-4 w-4" /></>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
