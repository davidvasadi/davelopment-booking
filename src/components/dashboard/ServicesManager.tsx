'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import type { Service, ServiceCategory, StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PopupModal } from '@/components/ui/popup-modal'
import { Switch } from '@/components/ui/toggle-switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Camera, Loader2, X, Clock, Scissors, Layers, Tag } from 'lucide-react'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { EmptyState } from '@/components/ui/empty-state'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { compressImage } from '@/lib/compressImage'

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  description: z.string().optional(),
  category: z.string().min(1, 'Kötelező'),
  duration_minutes: z.number().min(5),
  price: z.number().min(0),
  currency: z.enum(['HUF', 'EUR']),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

// A relationship-mező kétféleképp jöhet: ID (number|string) vagy a betöltött rekord (depth>0).
// Egységesen string ID-t adunk vissza (a select value-khoz), vagy null-t.
function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') return String((v as { id: string | number }).id)
  return String(v)
}

// A „+ Új kategória" select-érték szentinel — ekkor szabadszöveges mezőt mutatunk.
const NEW_CAT = '__new__'

interface Props {
  salonId: string
  initialServices: Service[]
  staffList: StaffMember[]
  initialCategories: ServiceCategory[]
  supportedLocales?: (Locale | string)[] | null
  /** Idei bevétel kategóriánként (kategória-ID → Ft; a besorolatlan kulcsa '__none__'). */
  revenueByCategory?: Record<string, number>
}

function serviceImageUrl(s: Service): string | null {
  const img = s.image
  if (!img) return null
  if (typeof img === 'object') return (img as Media).url ?? null
  return null
}

function categoryImageUrl(c: ServiceCategory | undefined): string | null {
  if (!c?.image) return null
  if (typeof c.image === 'object') return (c.image as Media).url ?? null
  return null
}

// Kategória-tintek a Crextio referencia szerint (fejléc-csempe egyszínű + sor-ikon gradiens),
// a kategória sorrendje szerint ciklikusan kiosztva. Halvány, deszaturált — nem harsány.
const CAT_TINTS = [
  { head: '#F0E4D4', grad: 'linear-gradient(135deg,#F3E7D6,#E7D2B6)' }, // meleg bézs
  { head: '#EFE2F0', grad: 'linear-gradient(135deg,#EFE2F0,#E0CBE5)' }, // lila
  { head: '#DDEBE5', grad: 'linear-gradient(135deg,#DDEBE5,#C7DCD1)' }, // zöld
  { head: '#DCE6F0', grad: 'linear-gradient(135deg,#DCE6F0,#C3D5E8)' }, // kék
  { head: '#F5E4E1', grad: 'linear-gradient(135deg,#F5E4E1,#EBCCC7)' }, // rózsa
]
const tintFor = (i: number) => CAT_TINTS[((i % CAT_TINTS.length) + CAT_TINTS.length) % CAT_TINTS.length]

/** Kompakt Ft nagy összegre (a referencia „2,4 M Ft" formátuma). */
function compactFt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M Ft`
  if (n >= 10_000) return `${Math.round(n / 1000)} e Ft`
  return `${n.toLocaleString('hu-HU')} Ft`
}


export default function ServicesManager({ salonId, initialServices, staffList, initialCategories, supportedLocales, revenueByCategory }: Props) {
  const [services, setServices] = useState(initialServices)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Nyelvkészlet a szalon supported_locales-éből (HU mindig benne). A name/description
  // localizált mezők — szerkesztéskor nyelvenként vihetők be a `?locale=` paraméterrel.
  const availableLocales = resolveAvailableLocales(supportedLocales)
  const [editLocale, setEditLocale] = useState<Locale>('hu')
  const [localeLoading, setLocaleLoading] = useState(false)

  const [imageId, setImageId] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageModified, setImageModified] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // A kategóriák mostantól rekordok (service-categories). ID szerint tartjuk; a foglaló és a
  // csoportosítás is ID-alapú, a megjelenített név a rekord name-je.
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories)
  const catById = new Map(categories.map(c => [String(c.id), c]))

  const [newCatName, setNewCatName] = useState('')

  // Category metadata editing — most ID alapján (a szerkesztett kategória rekordja).
  const [catSheetOpen, setCatSheetOpen] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [catDurationLabel, setCatDurationLabel] = useState('')
  const [catImageId, setCatImageId] = useState<number | null>(null)
  const [catImagePreview, setCatImagePreview] = useState<string | null>(null)
  const [uploadingCatImage, setUploadingCatImage] = useState(false)
  const [catImageModified, setCatImageModified] = useState(false)
  const [catSubmitting, setCatSubmitting] = useState(false)
  const catFileRef = useRef<HTMLInputElement>(null)

  // Kategória-szerkesztés nyelve (name + duration_label localizált). HU az alap; más nyelvre
  // váltva lekérdezzük az adott nyelvi tartalmat, mentéskor `?locale=`-lal PATCH-eljük.
  const [catEditLocale, setCatEditLocale] = useState<Locale>('hu')
  const [catLocaleLoading, setCatLocaleLoading] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'HUF', is_active: true, duration_minutes: 60, price: 0 },
  })

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])

  const openAdd = () => {
    reset({ name: '', description: '', category: '', duration_minutes: 60, price: 0, currency: 'HUF', is_active: true })
    setNewCatName('')
    setEditing(null)
    setEditLocale('hu')
    setImageId(null)
    setImagePreview(null)
    setImageModified(false)
    setSelectedStaffIds([])
    setOpen(true)
  }

  const openEdit = (s: Service) => {
    reset({
      name: s.name,
      description: s.description ?? '',
      category: relId(s.category) ?? '',
      duration_minutes: s.duration_minutes,
      price: s.price,
      currency: s.currency ?? 'HUF',
      is_active: s.is_active ?? true,
    })
    setNewCatName('')
    setEditing(s)
    setEditLocale('hu')
    const url = serviceImageUrl(s)
    setImagePreview(url)
    const media = s.image && typeof s.image === 'object' ? (s.image as Media) : null
    setImageId(media ? Number(media.id) : null)
    setImageModified(false)
    setSelectedStaffIds((s.staff ?? []).map(sm => String(typeof sm === 'string' || typeof sm === 'number' ? sm : (sm as StaffMember).id)))
    setOpen(true)
  }

  // Szerkesztési nyelv váltása a service-sheetben. HU-ra váltva az alap (editing) name/description
  // tér vissza; más nyelvre váltva lekérdezzük az adott nyelvi tartalmat (üres → a mező üres marad,
  // így látszik, mit kell még kitölteni; mentéskor üresen a HU fallback érvényesül a foglalón).
  const selectEditLocale = async (loc: Locale) => {
    if (loc === editLocale) return
    if (loc === 'hu') {
      setEditLocale('hu')
      setValue('name', editing?.name ?? '')
      setValue('description', editing?.description ?? '')
      return
    }
    if (!editing) return
    setLocaleLoading(true)
    try {
      const res = await fetch(`/api/services/${editing.id}?locale=${loc}&fallback-locale=null&depth=0`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      setEditLocale(loc)
      setValue('name', doc.name ?? '')
      setValue('description', doc.description ?? '')
    } catch {
      toast.error('A nyelvi tartalom betöltése sikertelen')
    } finally {
      setLocaleLoading(false)
    }
  }

  const openCatEdit = (catId: string) => {
    const existing = catById.get(catId)
    if (!existing) return
    setEditingCatId(catId)
    setCatEditLocale('hu')
    setEditingCatName(existing.name)
    setCatDurationLabel(existing.duration_label ?? '')
    const imgUrl = categoryImageUrl(existing)
    setCatImagePreview(imgUrl)
    const media = existing.image && typeof existing.image === 'object' ? (existing.image as Media) : null
    setCatImageId(media ? Number(media.id) : null)
    setCatImageModified(false)
    setCatSheetOpen(true)
  }

  // Kategória szerkesztési nyelvének váltása. HU-ra az alap (rekord) name/duration_label tér vissza;
  // más nyelvre lekérdezzük az adott nyelvi tartalmat (üres → üres mező, HU fallback a foglalón).
  const selectCatEditLocale = async (loc: Locale) => {
    if (loc === catEditLocale || !editingCatId) return
    if (loc === 'hu') {
      const existing = catById.get(editingCatId)
      setCatEditLocale('hu')
      setEditingCatName(existing?.name ?? '')
      setCatDurationLabel(existing?.duration_label ?? '')
      return
    }
    setCatLocaleLoading(true)
    try {
      const res = await fetch(`/api/service-categories/${editingCatId}?locale=${loc}&fallback-locale=null&depth=0`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      setCatEditLocale(loc)
      setEditingCatName(doc.name ?? '')
      setCatDurationLabel(doc.duration_label ?? '')
    } catch {
      toast.error('A nyelvi tartalom betöltése sikertelen')
    } finally {
      setCatLocaleLoading(false)
    }
  }

  // Kategória-rekord létrehozása név alapján (a service-űrlap „+ Új kategória" ágához). A létrehozott
  // rekordot felvesszük a state-be, és visszaadjuk az ID-ját.
  const createCategory = async (name: string): Promise<string> => {
    const res = await fetch('/api/service-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, salon: salonId }),
    })
    if (!res.ok) throw new Error()
    const json = await res.json()
    // A route a doc-ot közvetlenül is visszaadhatja (nem { doc }-ba csomagolva) — mindkét alak,
    // és sose kerüljön érvénytelen elem a listába.
    const saved: ServiceCategory = (json?.doc ?? json) as ServiceCategory
    if (!saved?.id) throw new Error('Érvénytelen szerver-válasz')
    setCategories(prev => [...prev, saved])
    return String(saved.id)
  }

  const handleImagePick = async (file: File) => {
    setUploadingImage(true)
    setImagePreview(URL.createObjectURL(file))
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      const json = await res.json()
      setImageId(json.doc.id)
      setImagePreview(json.doc.url)
      setImageModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setImagePreview(null)
      setImageId(null)
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async () => {
    if (imageId) {
      await fetch(`/api/media/${imageId}`, { method: 'DELETE', credentials: 'include' })
    }
    setImagePreview(null)
    setImageId(null)
    setImageModified(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleCatImagePick = async (file: File) => {
    setUploadingCatImage(true)
    setCatImagePreview(URL.createObjectURL(file))
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      const json = await res.json()
      setCatImageId(json.doc.id)
      setCatImagePreview(json.doc.url)
      setCatImageModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setCatImagePreview(null)
      setCatImageId(null)
    } finally {
      setUploadingCatImage(false)
    }
  }

  const removeCatImage = () => {
    setCatImagePreview(null)
    setCatImageId(null)
    setCatImageModified(true)
    if (catFileRef.current) catFileRef.current.value = ''
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      // Idegen nyelv szerkesztése: csak a localizált mezőket (name/description) PATCH-eljük az adott
      // nyelvre — a nem-localizált mezők (ár, kategória, kép) a HU rekordon közösek, nem írjuk felül.
      if (editLocale !== 'hu' && editing) {
        const res = await fetch(`/api/services/${editing.id}?locale=${editLocale}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: data.name, description: data.description || null }),
        })
        if (!res.ok) throw new Error()
        setOpen(false)
        toast.success('Fordítás mentve')
        return
      }

      // A „+ Új kategória" ág: előbb létrehozzuk a kategória-rekordot, az ID-ját mentjük a service-re.
      let categoryId = data.category
      if (categoryId === NEW_CAT) {
        if (!newCatName.trim()) { toast.error('Add meg az új kategória nevét'); setSubmitting(false); return }
        categoryId = await createCategory(newCatName.trim())
      }
      const { category: _c, ...rest } = data
      const body: Record<string, unknown> = {
        ...rest,
        category: Number(categoryId),
        salon: salonId,
        staff: selectedStaffIds.map(Number),
      }
      if (imageModified) body.image = imageId ?? null
      const url = editing ? `/api/services/${editing.id}` : '/api/services'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: Service = json.doc
      setServices(prev => editing ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved])
      setOpen(false)
      toast.success(editing ? 'Frissítve' : 'Létrehozva')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  const onCatSubmit = async () => {
    if (!editingCatId) return
    setCatSubmitting(true)
    try {
      // Idegen nyelven csak a localizált mezőket (name, duration_label) PATCH-eljük az adott nyelvre;
      // a kép és a salon a HU rekordon közös. A lista HU-n jelenik meg, így a state-et nem írjuk át.
      if (catEditLocale !== 'hu') {
        const res = await fetch(`/api/service-categories/${editingCatId}?locale=${catEditLocale}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: editingCatName, duration_label: catDurationLabel || null }),
        })
        if (!res.ok) throw new Error()
        setCatSheetOpen(false)
        toast.success('Fordítás mentve')
        return
      }

      const body: Record<string, unknown> = {
        name: editingCatName,
        salon: salonId,
        duration_label: catDurationLabel || null,
      }
      if (catImageModified) body.image = catImageId ?? null

      const res = await fetch(`/api/service-categories/${editingCatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: ServiceCategory = json.doc

      setCategories(prev => prev.map(c => String(c.id) === String(saved.id) ? saved : c))
      setCatSheetOpen(false)
      toast.success('Kategória frissítve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setCatSubmitting(false)
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a szolgáltatást?')) return
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setServices(prev => prev.filter(s => String(s.id) !== id))
      setOpen(false)
      toast.success('Szolgáltatás törölve')
    } catch {
      toast.error('Hiba történt a törlés során')
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a kategóriát?')) return
    try {
      const res = await fetch(`/api/service-categories/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json.error ?? 'Törlés sikertelen')
        return
      }
      setCategories(prev => prev.filter(c => String(c.id) !== id))
      if (watch('category') === id) setValue('category', '')
      setCatSheetOpen(false)
      toast.success('Kategória törölve')
    } catch {
      toast.error('Hiba történt a törlés során')
    }
  }

  // Inline aktív/inaktív váltás a sor toggle-jéből — optimista frissítés, hibánál visszaáll.
  const toggleActive = async (s: Service) => {
    const next = !(s.is_active !== false)
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, is_active: next } : x))
    try {
      const res = await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? 'Aktiválva' : 'Kikapcsolva')
    } catch {
      setServices(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !next } : x))
      toast.error('Nem sikerült frissíteni')
    }
  }

  // Csoportosítás kategória-ID szerint (a relationship-ből). A megjelenített nevet a kategória-rekord
  // adja (catById); ismeretlen/üres → 'Egyéb'. Az alkategória is ID-kulcs.
  const categoryMap = services.reduce((acc, s) => {
    const cat = relId(s.category) ?? '__none__'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, Service[]>)

  const catName = (id: string): string => (id === '__none__' ? 'Egyéb' : catById.get(id)?.name ?? 'Egyéb')

  const catCount = new Set(services.map(s => relId(s.category) ?? '__none__')).size
  const avgPrice = services.length ? Math.round(services.reduce((sum, s) => sum + (s.price || 0), 0) / services.length) : 0
  const heroCurrency = services[0]?.currency ?? 'HUF'

  const revByCat = revenueByCategory ?? {}
  const totalRevenue = Object.values(revByCat).reduce((a, b) => a + b, 0)
  const useRevenue = totalRevenue > 0
  const barEntries = Object.entries(categoryMap)
    .map(([id, items]) => ({
      id,
      count: items.length,
      val: useRevenue ? (revByCat[id] ?? 0) : items.length,
    }))
    .filter(d => d.count > 0 && d.val > 0)
    .sort((a, b) => b.val - a.val)
  const barTotal = barEntries.reduce((n, d) => n + d.val, 0) || 1

  return (
    <>
      <PageHeader
        eyebrow="Katalógus"
        title="Szolgáltatások"
        description="Aktív kínálat, árak és időtartamok kategóriánként"
        action={
          <button
            onClick={openAdd}
            aria-label="Új szolgáltatás"
            className="flex h-11 items-center gap-2 rounded-dav-pill bg-ink-dark px-3.5 text-sm font-semibold text-white transition-colors hover:bg-ink sm:px-5"
          >
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">Új szolgáltatás</span>
          </button>
        }
        className="mb-6"
      />

      <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {barEntries.length > 0 && (
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={barEntries.map((d, i) => ({
              label: catName(d.id),
              pct: Math.round((d.val / barTotal) * 100),
              value: useRevenue ? undefined : d.count,
              suffix: useRevenue ? undefined : ' db',
              background: i === 0 ? '#1D1C19' : i === 1 ? '#F1CE45' : 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)',
              color: i === 0 ? '#fff' : i === 1 ? '#1D1C19' : '#57564f',
              border: i >= 2 ? '1px solid var(--dav-line-strong)' : undefined,
            }))}
          />
        )}
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <CountUpKpi icon="scissors" value={services.length} label="Szolgáltatás" />
          <CountUpKpi icon="layers" value={catCount} label="Kategória" />
          <CountUpKpi icon="tag" value={avgPrice} label="Átlagár" suffix={heroCurrency === 'EUR' ? ' €' : ' Ft'} group />
        </div>
      </div>

      {services.length === 0 ? (
        <DashboardCard noPadding>
          <EmptyState icon={Scissors} title="Még nincs szolgáltatás" description="Add hozzá az elsőt a katalógushoz!" />
        </DashboardCard>
      ) : (
        <div className="space-y-4">
          {Object.entries(categoryMap).map(([categoryId, items], catIdx) => {
            const catRecord = categoryId === '__none__' ? undefined : catById.get(categoryId)
            const catImgUrl = categoryImageUrl(catRecord)
            const catLabel = catName(categoryId)
            const tint = tintFor(catIdx)

            return (
              <div key={categoryId} className="dav-card-glass rounded-[22px] px-3.5 py-4 sm:rounded-[26px] sm:px-[22px] sm:py-5">
                <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {catImgUrl ? (
                      <div className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-[12px]">
                        <img src={catImgUrl} alt={catLabel} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]" style={{ background: tint.head }}>
                        <Scissors className="h-[19px] w-[19px] text-ink/55" strokeWidth={1.7} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold text-ink">{catLabel}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-soft2">
                        {items.length} szolgáltatás
                        {catRecord?.duration_label && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{catRecord.duration_label}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {catRecord && (
                    <button
                      onClick={() => openCatEdit(categoryId)}
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_2px_6px_rgba(80,70,30,.07)] transition-colors hover:bg-paper"
                      title="Kategória szerkesztése"
                    >
                      <Pencil className="h-[15px] w-[15px]" strokeWidth={1.8} />
                    </button>
                  )}
                </div>

                <div className="mt-1 divide-y divide-line/70">
                  {items.map((s) => {
                    const imgUrl = serviceImageUrl(s)
                    const active = s.is_active !== false
                    const staffMembers = (s.staff ?? []).filter((x): x is StaffMember => typeof x === 'object' && x !== null)
                    return (
                      <div
                        key={s.id}
                        className="group flex items-center gap-3 rounded-[16px] px-1 py-3 transition-colors hover:bg-[var(--dav-glass)] sm:gap-4 sm:px-2"
                      >
                        <button onClick={() => openEdit(s)} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                            style={imgUrl ? undefined : { background: tint.grad }}
                          >
                            {imgUrl
                              ? <img src={imgUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                              : <Scissors className="h-5 w-5 text-ink/55" strokeWidth={1.7} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-ink">{s.name}</p>
                            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                              {!active ? (
                                <span className="rounded-[7px] bg-[#E7E1D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">Inaktív</span>
                              ) : staffMembers.length > 0 ? (
                                <>
                                  <div className="flex shrink-0">
                                    {staffMembers.slice(0, 4).map((m, mi) => (
                                      <span key={m.id} className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-ink-dark text-[9px] font-semibold text-gold ${mi > 0 ? '-ml-[7px]' : ''}`}>
                                        {m.name.slice(0, 1).toUpperCase()}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="truncate text-[12px] text-ink-soft">{staffMembers.map(m => m.name).join(', ')}</span>
                                </>
                              ) : (
                                <span className="text-[12px] text-ink-soft2">Nincs hozzárendelt szakember</span>
                              )}
                            </div>
                          </div>
                        </button>
                        <span className="hidden shrink-0 items-center gap-1.5 rounded-[10px] bg-[#EFEEE9] px-3 py-1.5 text-[13px] font-medium text-ink sm:inline-flex">
                          <Clock className="h-3.5 w-3.5 text-ink-soft" />{s.duration_minutes} perc
                        </span>
                        <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink sm:text-[16px]">{formatPrice(s.price, s.currency)}</span>
                        <Switch checked={active} onChange={() => toggleActive(s)} size="sm" ariaLabel={active ? 'Aktív' : 'Inaktív'} />
                        <button onClick={() => openEdit(s)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink" title="Szerkesztés"><Pencil className="h-[14px] w-[14px]" /></button>
                        <button onClick={() => deleteService(String(s.id))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-red-50 hover:text-red-500" title="Törlés"><Trash2 className="h-[14px] w-[14px]" /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Service edit — felugró modal (mint az étterem foglalás-szerkesztője) */}
      <PopupModal open={open} onClose={() => setOpen(false)} title={editing ? 'Szolgáltatás szerkesztése' : 'Új szolgáltatás'}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {editing && availableLocales.length > 1 && (
              <LocaleEditBar
                available={availableLocales}
                active={editLocale}
                onSelect={selectEditLocale}
                loading={localeLoading}
              />
            )}

            {editLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-soft">Kép</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-full h-32 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors border border-zinc-200"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
                  ) : imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Előnézet" className="h-full w-full object-cover object-top" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-400">
                      <Camera className="h-6 w-6" />
                      <span className="text-xs font-medium">Kép hozzáadása</span>
                    </div>
                  )}
                </button>
                {imagePreview && !uploadingImage && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImagePick(f) }}
              />
            </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Név *</Label>
              <Input className="h-11 rounded-xl" {...register('name')} placeholder={editLocale !== 'hu' ? (editing?.name ?? '') : undefined} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Leírás</Label>
              <Textarea className="rounded-xl" {...register('description')} rows={3} placeholder={editLocale !== 'hu' ? (editing?.description ?? '') : undefined} />
            </div>

            {editLocale === 'hu' && (
            <>
            <div className="space-y-1.5">
                <Label className="text-sm font-medium">Kategória *</Label>
                <div className="flex gap-2">
                  <Select value={watch('category') || ''} onValueChange={v => setValue('category', v)}>
                    <SelectTrigger className="h-11 flex-1 rounded-xl"><SelectValue placeholder="Válassz kategóriát" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value={NEW_CAT}>+ Új kategória</SelectItem>
                    </SelectContent>
                  </Select>
                  {watch('category') && watch('category') !== NEW_CAT && (
                    <button
                      type="button"
                      onClick={() => openCatEdit(watch('category'))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft hover:bg-paper transition-colors"
                      title="Kategória szerkesztése / törlése"
                    >
                      <Pencil className="h-[14px] w-[14px]" />
                    </button>
                  )}
                </div>
                {watch('category') === NEW_CAT && (
                  <Input
                    className="h-11 rounded-xl mt-2"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="Pl. Fodrászat, Körmös, Fogászat"
                  />
                )}
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Időtartam (perc) *</Label>
                <Input type="number" min={5} step={5} className="h-11 rounded-xl" {...register('duration_minutes', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ár *</Label>
                <Input type="number" min={0} className="h-11 rounded-xl" {...register('price', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Pénznem</Label>
              <Select value={watch('currency')} onValueChange={v => setValue('currency', v as 'HUF' | 'EUR')}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HUF">HUF (Ft)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {staffList.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Szakemberek <span className="font-normal text-ink-soft2">(kik végzik)</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {staffList.map(m => {
                    const sel = selectedStaffIds.includes(String(m.id))
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedStaffIds(prev =>
                          sel ? prev.filter(id => id !== String(m.id)) : [...prev, String(m.id)]
                        )}
                        className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-all"
                        style={{
                          background: sel ? '#1D1C19' : 'transparent',
                          color: sel ? '#fff' : '#57564f',
                          border: `1px solid ${sel ? '#1D1C19' : '#d9d4c5'}`,
                        }}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-ink-soft2">Ha nincs kiválasztva, az összes aktív szakember foglalható</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" className="h-4 w-4 rounded" {...register('is_active')} />
              <Label htmlFor="active" className="text-sm">Aktív (foglalható)</Label>
            </div>
            </>
            )}
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="w-full h-12 rounded-dav-pill bg-ink-dark hover:bg-ink text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mentés...' : editLocale !== 'hu' ? 'Fordítás mentése' : 'Mentés'}
            </button>
            {editing && editLocale === 'hu' && (
              <button
                type="button"
                onClick={() => deleteService(String(editing.id))}
                className="w-full h-11 rounded-dav-pill border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold text-sm transition-colors"
              >
                Szolgáltatás törlése
              </button>
            )}
          </form>
      </PopupModal>

      {/* Category metadata — felugró modal */}
      <PopupModal open={catSheetOpen} onClose={() => setCatSheetOpen(false)} title={`Kategória: ${editingCatName}`}>
          <div className="space-y-4">
            {availableLocales.length > 1 && (
              <LocaleEditBar
                available={availableLocales}
                active={catEditLocale}
                onSelect={selectCatEditLocale}
                loading={catLocaleLoading}
              />
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kategória neve *</Label>
              <Input
                className="h-11 rounded-xl"
                value={editingCatName}
                onChange={e => setEditingCatName(e.target.value)}
                placeholder={catEditLocale !== 'hu' ? (catById.get(editingCatId ?? '')?.name ?? '') : 'Pl. Fodrászat, Körmös'}
              />
            </div>

            {catEditLocale === 'hu' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Borítókép</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => catFileRef.current?.click()}
                  className="relative w-full h-40 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors border border-zinc-200"
                >
                  {uploadingCatImage ? (
                    <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
                  ) : catImagePreview ? (
                    <>
                      <img src={catImagePreview} alt="Előnézet" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-400">
                      <Camera className="h-6 w-6" />
                      <span className="text-xs font-medium">Borítókép hozzáadása</span>
                    </div>
                  )}
                </button>
                {catImagePreview && !uploadingCatImage && (
                  <button
                    type="button"
                    onClick={removeCatImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>
              <input
                ref={catFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCatImagePick(f) }}
              />
            </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Időtartam felirat</Label>
              <Input
                className="h-11 rounded-xl"
                placeholder={catEditLocale !== 'hu' ? (catById.get(editingCatId ?? '')?.duration_label ?? 'Pl. 30-90 perc') : 'Pl. 30-90 perc'}
                value={catDurationLabel}
                onChange={e => setCatDurationLabel(e.target.value)}
              />
              <p className="text-xs text-zinc-400 dark:text-white/30">Megjelenik a foglalási oldalon a kategória alatt</p>
            </div>

            <button
              type="button"
              onClick={onCatSubmit}
              disabled={catSubmitting || uploadingCatImage}
              className="w-full h-12 rounded-dav-pill bg-ink-dark hover:bg-ink text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {catSubmitting ? 'Mentés...' : catEditLocale !== 'hu' ? 'Fordítás mentése' : 'Mentés'}
            </button>
            {catEditLocale === 'hu' && editingCatId && (
              <button
                type="button"
                onClick={() => deleteCategory(editingCatId)}
                className="w-full h-11 rounded-dav-pill border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold text-sm transition-colors"
              >
                Kategória törlése
              </button>
            )}
          </div>
      </PopupModal>
    </>
  )
}
