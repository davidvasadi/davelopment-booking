'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import type { Service, StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ArrowLeft, Check, Clock, Loader2, ChevronLeft, ChevronRight, User } from 'lucide-react'

const AVATAR_GRADIENTS = [
  'from-violet-400 to-purple-600',
  'from-blue-400 to-cyan-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-600',
  'from-pink-400 to-fuchsia-600',
  'from-amber-400 to-orange-600',
]
function avatarGradient(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}
import { format, addDays, isSameDay, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'

type Slot = { start: string; end: string }

interface WizardState {
  serviceId: string | null
  staffId: string | null
  date: string
  slot: Slot | null
  name: string
  email: string
  phone: string
  notes: string
}

interface Props {
  salonId: string
  salonSlug: string
  salonName: string
  services: Service[]
  staff: StaffMember[]
  preselectedServiceId?: string | null
  preselectedStaffId?: string | null
}

const HU_DAYS = ['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Szo']

function generateDays(count = 60): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(new Date(), i))
}

function DateStrip({ selected, onChange }: { selected: string; onChange: (d: string) => void }) {
  const days = generateDays(60)
  const selectedDate = new Date(selected + 'T00:00:00')
  const [month, setMonth] = useState(format(selectedDate, 'MMMM', { locale: hu }))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const idx = days.findIndex(d => isSameDay(d, selectedDate))
    if (scrollRef.current && idx >= 0) {
      const el = scrollRef.current.children[idx] as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    setMonth(format(selectedDate, 'MMMM yyyy', { locale: hu }))
  }, [selected])

  const shiftMonth = (dir: 1 | -1) => {
    const cur = days.findIndex(d => isSameDay(d, selectedDate))
    const next = days.find((d, i) => i > cur + 20 * dir && d.getMonth() !== selectedDate.getMonth())
    if (next) onChange(format(next, 'yyyy-MM-dd'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => shiftMonth(-1)} className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-zinc-900 capitalize">{month}</p>
        <button onClick={() => shiftMonth(1)} className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {days.map((d) => {
          const str = format(d, 'yyyy-MM-dd')
          const isSelected = isSameDay(d, selectedDate)
          const today = isToday(d)
          return (
            <button
              key={str}
              onClick={() => onChange(str)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-3 rounded-2xl shrink-0 snap-center transition-all min-w-[52px]',
                isSelected
                  ? 'bg-zinc-950 text-white'
                  : today
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
              )}
            >
              <span className={cn('text-[10px] font-semibold uppercase', isSelected ? 'text-zinc-400' : 'text-zinc-400')}>
                {HU_DAYS[d.getDay()]}
              </span>
              <span className="text-base font-black leading-none">{format(d, 'd')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function BookingWizard({
  salonId, salonSlug, salonName, services, staff, preselectedServiceId, preselectedStaffId,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState(preselectedServiceId ? 1 : 0)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [state, setState] = useState<WizardState>({
    serviceId: preselectedServiceId ?? null,
    staffId: preselectedStaffId ?? null,
    date: format(new Date(), 'yyyy-MM-dd'),
    slot: null,
    name: '', email: '', phone: '', notes: '',
  })

  const set = (patch: Partial<WizardState>) => setState(prev => ({ ...prev, ...patch }))

  const selectedService = services.find(s => String(s.id) === String(state.serviceId))
  const selectedStaff = staff.find(m => String(m.id) === String(state.staffId))
  const selectedDate = new Date(state.date + 'T00:00:00')

  useEffect(() => {
    if (step !== 2 || !state.serviceId || !state.date) return
    setLoadingSlots(true)
    setSlots([])
    const params = new URLSearchParams({
      salonId, serviceId: state.serviceId, date: state.date,
      ...(state.staffId ? { staffId: state.staffId } : {}),
    })
    fetch(`/api/bookly/slots?${params}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => toast.error('Nem sikerült betölteni az időpontokat'))
      .finally(() => setLoadingSlots(false))
  }, [step, state.serviceId, state.staffId, state.date, salonId])

  const submit = async () => {
    if (!state.serviceId || !state.slot || !state.staffId) return
    if (!state.name || state.name.length < 2) { toast.error('Add meg a neved'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) { toast.error('Érvényes email szükséges'); return }
    if (state.phone.replace(/\s/g, '').length < 7) { toast.error('Érvényes telefonszám szükséges'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bookly/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId, serviceId: state.serviceId, staffId: state.staffId,
          date: state.date, start_time: state.slot.start, end_time: state.slot.end,
          customer_name: state.name, customer_email: state.email,
          customer_phone: state.phone, notes: state.notes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Hiba')
      }
      const params = new URLSearchParams({
        name: state.name, service: selectedService?.name ?? '',
        date: state.date, time: state.slot.start,
      })
      router.push(`/bookly/${salonSlug}/book/success?${params}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  const STEPS = ['Szolgáltatás', 'Munkatárs', 'Dátum & Időpont', 'Adatok']

  return (
    <div className="min-h-screen bg-[#F5F4F2] flex flex-col">

      {/* Header */}
      <header className="bg-[#F5F4F2] px-5 pt-12 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 0) router.push(`/bookly/${salonSlug}`)
              else if (step === 2 && state.staffId !== null && preselectedStaffId) setStep(0)
              else setStep(step - 1)
            }}
            className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-xs text-zinc-400 font-medium">{salonName}</p>
            <p className="text-sm font-bold text-zinc-900">{STEPS[step]}</p>
          </div>
          <div className="h-10 w-10" />
        </div>

        {/* Step dots */}
        <div className="max-w-lg mx-auto flex items-center gap-1.5 justify-center mt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all',
                i < step ? 'h-1.5 w-1.5 bg-zinc-950' :
                i === step ? 'h-1.5 w-5 bg-zinc-950' :
                'h-1.5 w-1.5 bg-zinc-300'
              )}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-5 pb-32 pt-2 space-y-4">

        {/* Step 0: Service */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1">Melyik<br />szolgáltatást?</h2>
            <p className="text-sm text-zinc-500 mb-6">Válassz az elérhető szolgáltatások közül</p>
            <div className="space-y-3">
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => { set({ serviceId: s.id, slot: null }); setStep(1) }}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl shadow-sm p-5 transition-all hover:shadow-md',
                    state.serviceId === s.id ? 'ring-2 ring-zinc-950' : ''
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-zinc-900">{s.name}</p>
                      {s.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{s.description}</p>}
                      <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{s.duration_minutes} perc
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-black text-base text-zinc-900">{formatPrice(s.price, s.currency)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Staff */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1">Válassz<br />munkatársat</h2>
            <p className="text-sm text-zinc-500 mb-6">Kivel szeretnél foglalni?</p>

            {/* Any staff card */}
            <button
              onClick={() => { set({ staffId: null, slot: null }); setStep(2) }}
              className={cn(
                'w-full text-left bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 mb-3 transition-all hover:shadow-md',
                state.staffId === null ? 'ring-2 ring-zinc-950' : ''
              )}
            >
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-zinc-900">Bármelyik szabad</p>
                <p className="text-xs text-zinc-400 mt-0.5">A legelső szabad időpontot ajánljuk</p>
              </div>
              {state.staffId === null && <Check className="h-4 w-4 text-zinc-950 ml-auto shrink-0" />}
            </button>

            {/* Staff grid cards */}
            <div className="grid grid-cols-2 gap-3">
              {staff.map(m => {
                const avatarUrl = m.avatar && typeof m.avatar === 'object'
                  ? (m.avatar as Media).url ?? null : null
                const isSelected = state.staffId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { set({ staffId: m.id, slot: null }); setStep(2) }}
                    className={cn(
                      'relative bg-white rounded-2xl shadow-sm overflow-hidden aspect-[4/5] transition-all hover:shadow-md',
                      isSelected ? 'ring-2 ring-zinc-950' : ''
                    )}
                  >
                    {/* Photo or placeholder */}
                    <div className="absolute inset-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={m.name} className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${avatarGradient(m.name)} flex items-end pb-12 justify-center`}>
                          <span className="text-7xl font-black text-white/20 select-none">
                            {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Arrow badge */}
                    <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                      {isSelected
                        ? <Check className="h-3.5 w-3.5 text-zinc-950" />
                        : <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                      }
                    </div>
                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white font-bold text-sm leading-tight">{m.name}</p>
                      {m.bio && <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{m.bio}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2: Date + Time */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1">Mikor<br />legyen?</h2>
            <p className="text-sm text-zinc-500 mb-6">Válassz napot és szabad időpontot</p>

            {/* Date strip */}
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
              <DateStrip
                selected={state.date}
                onChange={(d) => set({ date: d, slot: null })}
              />
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
                {format(selectedDate, 'EEEE, MMMM d.', { locale: hu })}
              </p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-zinc-400 py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Betöltés...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">Erre a napra nincs szabad időpont.</p>
                  <p className="text-xs text-zinc-400 mt-1">Válassz másik napot.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => { set({ slot }); setStep(3) }}
                      className={cn(
                        'py-3 rounded-xl text-sm font-bold transition-all',
                        state.slot?.start === slot.start
                          ? 'bg-zinc-950 text-white shadow-md'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      )}
                    >
                      {slot.start}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Customer info */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-1">Az adataid</h2>
            <p className="text-sm text-zinc-500 mb-6">Töltsd ki az adataidat a foglalás megerősítéséhez</p>

            {/* Booking summary card */}
            <div className="bg-zinc-950 rounded-2xl p-5 mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-zinc-400 text-xs font-medium mb-1">Foglalás összegzése</p>
                <p className="text-white font-black text-base">{selectedService?.name}</p>
                <p className="text-zinc-400 text-xs mt-1">
                  {selectedStaff ? selectedStaff.name : 'Bármelyik munkatárs'} · {format(selectedDate, 'MMM d.', { locale: hu })} · {state.slot?.start}
                </p>
              </div>
              {selectedService && (
                <div className="text-right shrink-0">
                  <p className="text-white font-black text-lg">{formatPrice(selectedService.price, selectedService.currency)}</p>
                  <p className="text-zinc-500 text-xs">{selectedService.duration_minutes} perc</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Teljes név *</Label>
                <Input
                  value={state.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="Kovács János"
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Email cím *</Label>
                <Input
                  type="email"
                  value={state.email}
                  onChange={e => set({ email: e.target.value })}
                  placeholder="nev@email.hu"
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Telefonszám *</Label>
                <Input
                  type="tel"
                  value={state.phone}
                  onChange={e => set({ phone: e.target.value })}
                  placeholder="+36 30 123 4567"
                  className="h-12 rounded-xl bg-zinc-50 border-0 text-sm font-medium focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Megjegyzés</Label>
                <Textarea
                  value={state.notes}
                  onChange={e => set({ notes: e.target.value })}
                  placeholder="Pl. allergiák, különleges kérések..."
                  rows={3}
                  className="rounded-xl bg-zinc-50 border-0 text-sm font-medium resize-none focus-visible:ring-1 focus-visible:ring-zinc-900"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F5F4F2] px-5 py-5 border-t border-zinc-200/50">
        <div className="max-w-lg mx-auto">
          {step === 0 && (
            state.serviceId ? (
              <button
                onClick={() => setStep(state.staffId !== null ? 2 : 1)}
                className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
              >
                <span>{selectedService?.name}</span>
                <span className="flex items-center gap-2 text-zinc-400">
                  {selectedService && formatPrice(selectedService.price, selectedService.currency)} <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl bg-zinc-200 flex items-center justify-center">
                <p className="text-sm text-zinc-400 font-medium">Válassz egy szolgáltatást</p>
              </div>
            )
          )}
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
            >
              <span>{state.staffId === null ? 'Bármelyik munkatárs' : selectedStaff?.name}</span>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </button>
          )}
          {step === 2 && (
            state.slot ? (
              <button
                onClick={() => setStep(3)}
                className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg flex items-center justify-between px-6"
              >
                <span>{format(selectedDate, 'MMM d.', { locale: hu })} · {state.slot.start}</span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            ) : (
              <div className="w-full h-14 rounded-2xl bg-zinc-200 flex items-center justify-center">
                <p className="text-sm text-zinc-400 font-medium">Válassz időpontot</p>
              </div>
            )
          )}
          {step === 3 && (
            <button
              onClick={submit}
              disabled={submitting || !state.name || !state.email || !state.phone}
              className="w-full h-14 rounded-2xl bg-zinc-950 text-white font-black text-sm hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Küldés...</> : 'Foglalás megerősítése →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
