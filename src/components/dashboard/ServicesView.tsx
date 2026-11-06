'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Briefcase, List, Plus, Undo2 } from 'lucide-react'
import { Button, EmptyState, ListRow, Meta, PageHead, Pill } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CategoryEditPanel, CategoryList, MobileServiceList, NewServiceCard, ServiceRow, PopularServiceCard, ServiceCard, ServiceEditForm, ServiceFilterBar, ServiceGrid, ServiceSummary, priceLabel, type CategoryFormValue, type ServiceFormValue, type ServiceStaff } from '@/components/blocks/services'
import { uploadMedia } from '@/lib/uploadMedia'
import type { UploadState } from '@/components/blocks/upload'
import { useSortable } from '@/lib/useSortable'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import type { Locale } from '@/lib/i18n'

/** Egy szolgáltatás (a szerver adja). */
export interface ServiceVM {
  id: string
  name: string
  description: string
  categoryId: string | null
  subcategoryId: string | null
  image: { id: number; url: string } | null
  staffIds: string[]
  duration: number
  price: number
  currency: 'HUF' | 'EUR'
  /** online foglalható */
  active: boolean
  /** a hónap foglalásai és bevétele */
  monthCount: number
  monthRevenue: number
  /** az elmúlt 7 hét foglalásai (a legnépszerűbb kártya trendjéhez) */
  weeks: number[]
}
export interface CategoryVM { id: string; name: string; durationLabel: string; description: string; image: { id: number; url: string } | null }

interface Props {
  salonId: string
  services: ServiceVM[]
  categories: CategoryVM[]
  staff: ServiceStaff[]
  /** az előleg-szabály (Beállítások › Előleg), ha be van kapcsolva */
  deposit: { type: 'fixed' | 'percent'; value: number } | null
  /** a hónap ragozva (pl. „Novemberben”) — a havi számok felirata */
  month: string
  /** a regisztráció szakma-sablonjai (az üres állapothoz) */
  templates: [string, string][]
  canManage?: boolean
  /** a foglaló nyelvei (a magyar mindig elöl) — több nyelvnél a név és a leírás nyelvenként szerkeszthető */
  locales: Locale[]
}


const EMPTY_FORM: ServiceFormValue = { name: '', description: '', categoryId: '', subcategoryId: '', duration: 60, price: '', currency: 'HUF', staffIds: [], online: true, img: null }

/**
 * Szolgáltatások (design 8.1–8.5, szalon): kategória-pillek és kereső, kártya-rács (a hónap legnépszerűbbje sötét
 * kártyán, a hónap számaival), szerkesztő-ablak összefoglalóval, kategóriák kezelése (sorrend
 * áthúzással), üres állapot a szakma-sablonokkal; mobilon kategóriánként lista, koppintásra alulról a szerkesztő.
 */
export function ServicesView({ salonId, services: initial, categories: initialCats, staff, deposit, month, templates, canManage = false, locales }: Props) {
  const router = useRouter()
  const [services, setServices] = useState(initial)
  const [categories, setCategories] = useState(initialCats)
  useEffect(() => { setServices(initial) }, [initial])
  useEffect(() => { setCategories(initialCats) }, [initialCats])
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? ''

  // ── szűrés ──
  const [cat, setCat] = useState(0)
  const [query, setQuery] = useState('')
  const cats: [string, number][] = [['Mind', services.length], ...categories.map((c) => [c.name, services.filter((s) => s.categoryId === c.id).length] as [string, number])]
  const shown = services.filter((s) => (cat === 0 || s.categoryId === categories[cat - 1]?.id) && (!query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase())))
  const popular = useMemo(() => [...services].sort((a, b) => b.monthCount - a.monthCount)[0], [services])
  const depositOf = (price: number, currency: 'HUF' | 'EUR') => (deposit ? `Előleg ${priceLabel(deposit.type === 'percent' ? Math.round((price * deposit.value) / 100) : deposit.value, currency)}` : null)
  const card = (s: ServiceVM) => ({ id: s.id, name: s.name, img: s.image?.url ?? null, price: s.price, currency: s.currency, duration: s.duration, staff: staff.filter((p) => s.staffIds.includes(p.id)), online: s.active })

  // ── szerkesztés (8.3) ──
  const [edit, setEdit] = useState<{ id: string | null; v: ServiceFormValue; imageId: number | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [imageUp, setImageUp] = useState<UploadState | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  // a szerkesztés nyelve: idegen nyelven a név és a leírás az adott nyelvre töltődik és mentődik (?locale=)
  const [loc, setLoc] = useState<Locale>('hu')
  const [locBusy, setLocBusy] = useState(false)
  const [huText, setHuText] = useState<{ name: string; description: string } | null>(null)
  const switchLocale = async (l: Locale) => {
    if (!edit?.id || l === loc) return
    const hu = huText ?? { name: edit.v.name, description: edit.v.description }
    if (!huText) setHuText(hu)
    setLoc(l)
    if (l === 'hu') { setEdit({ ...edit, v: { ...edit.v, ...hu } }); return }
    setLocBusy(true)
    const res = await fetch(`/api/services/${edit.id}?locale=${l}&fallback-locale=null&depth=0`, { credentials: 'include' }).catch(() => null)
    setLocBusy(false)
    const doc = res?.ok ? await res.json() : null
    setEdit((e) => (e ? { ...e, v: { ...e.v, name: doc?.name ?? '', description: doc?.description ?? '' } } : e))
  }
  useEffect(() => { if (!edit) { setLoc('hu'); setHuText(null) } }, [edit])
  const openService = (s: ServiceVM) => setEdit({ id: s.id, imageId: s.image?.id ?? null, v: { name: s.name, description: s.description, categoryId: s.categoryId ?? '', subcategoryId: s.subcategoryId ?? '', duration: s.duration, price: s.price.toLocaleString('hu-HU'), currency: s.currency, staffIds: s.staffIds, online: s.active, img: s.image?.url ?? null } })
  const openNew = () => setEdit({ id: null, imageId: null, v: { ...EMPTY_FORM, categoryId: cat > 0 ? categories[cat - 1]?.id ?? '' : '' } })
  // a mobil fejléc ikonjai (DashboardNav): „+” új szolgáltatás, a szűrő a kategória-lap
  const [catSheet, setCatSheet] = useState(false)
  useEffect(() => {
    const onAdd = () => openNew()
    const onFilter = () => setCatSheet(true)
    window.addEventListener('davelopment:open-services-add', onAdd)
    window.addEventListener('davelopment:open-services-filter', onFilter)
    return () => { window.removeEventListener('davelopment:open-services-add', onAdd); window.removeEventListener('davelopment:open-services-filter', onFilter) }
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const onImage = async (file: File) => {
    if (!edit) return
    try { const m = await uploadMedia(file, setImageUp); setEdit((e) => (e ? { ...e, imageId: m.id, v: { ...e.v, img: m.url } } : e)); setImageUp(null) } catch (err) { toast.error(err instanceof Error ? err.message : 'A kép feltöltése nem sikerült'); setImageUp(null) }
  }
  const save = async () => {
    if (!edit) return
    if (loc !== 'hu' && edit.id) {
      // idegen nyelv: csak a fordítható mezők az adott nyelvre
      setBusy(true)
      const res = await fetch(`/api/services/${edit.id}?locale=${loc}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: edit.v.name.trim() || null, description: edit.v.description.trim() || null }) }).catch(() => null)
      setBusy(false)
      if (!res?.ok) { toast.error('Nem sikerült menteni'); return }
      toast.success('Fordítás mentve')
      setEdit(null)
      return
    }
    const price = Number(edit.v.price.replace(/\s/g, '').replace(',', '.'))
    if (!edit.v.name.trim()) { toast.error('Add meg a szolgáltatás nevét'); return }
    if (!Number.isFinite(price) || price < 0) { toast.error('Adj meg érvényes árat'); return }
    setBusy(true)
    const body = {
      salon: Number(salonId), name: edit.v.name.trim(), description: edit.v.description.trim() || null,
      category: edit.v.categoryId ? Number(edit.v.categoryId) : null, subcategory: edit.v.subcategoryId ? Number(edit.v.subcategoryId) : null,
      image: edit.imageId, staff: edit.v.staffIds.map(Number), duration_minutes: edit.v.duration, price, currency: edit.v.currency, is_active: edit.v.online,
    }
    const res = await fetch(edit.id ? `/api/services/${edit.id}` : '/api/services', { method: edit.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { toast.error('Nem sikerült menteni'); return }
    toast.success(edit.id ? 'Mentve' : 'Létrehozva')
    setEdit(null)
    router.refresh()
  }
  const remove = async () => {
    if (!edit?.id) return
    setBusy(true)
    const res = await fetch(`/api/services/${edit.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    setBusy(false)
    setConfirmDel(false)
    if (!res?.ok) { toast.error('Nem sikerült törölni'); return }
    setServices((p) => p.filter((s) => s.id !== edit.id))
    setEdit(null)
    toast.success('Törölve')
    router.refresh()
  }
  const editing = edit?.id ? services.find((s) => s.id === edit.id) : null
  const form = (stacked: boolean) => edit && (
    <ServiceEditForm stacked={stacked} value={edit.v} onChange={(v) => setEdit({ ...edit, v })} textOnly={loc !== 'hu'} categories={categories.map((c) => [c.id, c.name])} staff={staff}
      onImage={canManage ? onImage : undefined} onImageRemove={canManage && edit.v.img ? () => setEdit({ ...edit, imageId: null, v: { ...edit.v, img: null } }) : undefined} upload={imageUp} />
  )
  // jobbra (szürke): az összefoglaló és a gombok — mint az Új foglalás ablakban
  const summary = edit && (
    <ServiceSummary value={edit.v} staff={staff} category={catName(edit.v.categoryId)} month={month} count={editing?.monthCount ?? 0} revenue={editing?.monthRevenue ?? 0}
      deposit={depositOf(Number(edit.v.price.replace(/\s/g, '')) || 0, edit.v.currency)}
      actions={canManage ? <><Button onClick={save} loading={busy}>Mentés</Button>{edit.id && <Button variant="bad" onClick={() => setConfirmDel(true)}>Törlés</Button>}</> : <Button variant="cell" onClick={() => setEdit(null)}>Bezárás</Button>} />
  )

  // ── kategóriák (8.4) ──
  const [catOpen, setCatOpen] = useState(false)
  const [catEdit, setCatEdit] = useState<{ id: string; v: CategoryFormValue; imageId: number | null } | null>(null)
  const [catBusy, setCatBusy] = useState(false)
  const [catImageUp, setCatImageUp] = useState<UploadState | null>(null)
  const [catLoc, setCatLoc] = useState<Locale>('hu')
  const [catLocBusy, setCatLocBusy] = useState(false)
  const [catHu, setCatHu] = useState<{ name: string; durationLabel: string; description: string } | null>(null)
  useEffect(() => { setCatLoc('hu'); setCatHu(null) }, [catEdit?.id])
  const switchCatLocale = async (l: Locale) => {
    if (!catEdit || l === catLoc) return
    const hu = catHu ?? { name: catEdit.v.name, durationLabel: catEdit.v.durationLabel, description: catEdit.v.description }
    if (!catHu) setCatHu(hu)
    setCatLoc(l)
    if (l === 'hu') { setCatEdit({ ...catEdit, v: { ...catEdit.v, ...hu } }); return }
    setCatLocBusy(true)
    const res = await fetch(`/api/service-categories/${catEdit.id}?locale=${l}&fallback-locale=null&depth=0`, { credentials: 'include' }).catch(() => null)
    setCatLocBusy(false)
    const doc = res?.ok ? await res.json() : null
    setCatEdit((e) => (e ? { ...e, v: { ...e.v, name: doc?.name ?? '', durationLabel: doc?.duration_label ?? '', description: doc?.description ?? '' } } : e))
  }
  const openCat = (id: string) => { const c = categories.find((x) => x.id === id); if (c) setCatEdit({ id, imageId: c.image?.id ?? null, v: { name: c.name, durationLabel: c.durationLabel, description: c.description, img: c.image?.url ?? null } }) }
  const createCat = async () => {
    const res = await fetch('/api/service-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ salon: Number(salonId), name: 'Új kategória', sort_order: categories.length }) }).catch(() => null)
    if (!res?.ok) { toast.error('Nem sikerült létrehozni'); return }
    const { doc } = await res.json()
    const c: CategoryVM = { id: String(doc.id), name: doc.name, durationLabel: '', description: '', image: null }
    setCategories((p) => [...p, c])
    setCatEdit({ id: c.id, imageId: null, v: { name: c.name, durationLabel: '', description: '', img: null } })
  }
  const saveCat = async () => {
    if (!catEdit) return
    setCatBusy(true)
    const text = { name: catEdit.v.name.trim() || null, duration_label: catEdit.v.durationLabel.trim() || null, description: catEdit.v.description.trim() || null }
    const res = await fetch(`/api/service-categories/${catEdit.id}${catLoc !== 'hu' ? `?locale=${catLoc}` : ''}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(catLoc !== 'hu' ? text : { ...text, image: catEdit.imageId }) }).catch(() => null)
    setCatBusy(false)
    if (!res?.ok) { toast.error('Nem sikerült menteni'); return }
    if (catLoc !== 'hu') { toast.success('Fordítás mentve'); setCatEdit(null); return }
    setCategories((p) => p.map((c) => (c.id === catEdit.id ? { ...c, name: catEdit.v.name.trim(), durationLabel: catEdit.v.durationLabel.trim(), description: catEdit.v.description.trim(), image: catEdit.v.img && catEdit.imageId ? { id: catEdit.imageId, url: catEdit.v.img } : null } : c)))
    toast.success('Mentve')
    setCatEdit(null)
    router.refresh()
  }
  const [confirmCatDel, setConfirmCatDel] = useState(false)
  const deleteCat = async () => {
    if (!catEdit) return
    setCatBusy(true)
    const res = await fetch(`/api/service-categories/${catEdit.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    setCatBusy(false)
    setConfirmCatDel(false)
    if (!res?.ok) { toast.error('Nem sikerült törölni'); return }
    setCategories((p) => p.filter((c) => c.id !== catEdit.id))
    setCatEdit(null)
    toast.success('Törölve')
    router.refresh()
  }
  // a kategóriák sorrendje: áthúzás (useSortable), elengedéskor menti
  const catSort = useSortable(categories.map((c) => c.id), (ids) => {
    const next = ids.map((id) => categories.find((c) => c.id === id)!).filter(Boolean)
    setCategories(next)
    void Promise.all(next.map((c, i) => fetch(`/api/service-categories/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ sort_order: i }) })))
      .then((rs) => { if (rs.some((r) => !r.ok)) throw new Error() }).catch(() => toast.error('A sorrend mentése nem sikerült'))
  })
  const onCatImage = async (file: File) => {
    if (!catEdit) return
    try { const m = await uploadMedia(file, setCatImageUp); setCatEdit((e) => (e ? { ...e, imageId: m.id, v: { ...e.v, img: m.url } } : e)); setCatImageUp(null) } catch (err) { toast.error(err instanceof Error ? err.message : 'A kép feltöltése nem sikerült'); setCatImageUp(null) }
  }
  const catRows = catSort.order.map((id) => categories.find((c) => c.id === id)).filter((c): c is CategoryVM => !!c).map((c) => ({ id: c.id, name: c.name, durationLabel: c.durationLabel, count: services.filter((s) => s.categoryId === c.id).length }))

  // ── üres állapot (8.2): a szakma minta-szolgáltatásai ──
  const [tpl, setTpl] = useState(templates[0]?.[0] ?? '')
  const [seeding, setSeeding] = useState(false)
  const seed = async () => {
    setSeeding(true)
    const res = await fetch('/api/seed-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ salonId: Number(salonId), businessTypes: [tpl] }) }).catch(() => null)
    setSeeding(false)
    if (!res?.ok) { toast.error('Nem sikerült betölteni'); return }
    toast.success('Betöltve — írd át nyugodtan')
    router.refresh()
  }

  const head = (
    <PageHead
      title="Szolgáltatások"
      actions={canManage ? <span className="flex gap-1.5 max-lg:hidden"><Button variant="glass" icon={List} onClick={() => setCatOpen(true)}>Kategóriák</Button><Button variant="yellow" icon={Plus} onClick={openNew}>Új szolgáltatás</Button></span> : undefined}
    />
  )
  return (
    <div className="p-4 lg:p-0">
      {services.length === 0 ? (
        <>
          {head}
          <EmptyState icon={Briefcase} title="Még nincs szolgáltatásod" action={canManage ? (
            <span className="flex flex-col items-center gap-3">
              <span className="flex flex-wrap justify-center gap-1.5">{templates.map(([t, l]) => <button key={t} type="button" onClick={() => setTpl(t)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={tpl === t ? 'dark' : 'cell'}>{l}</Pill></button>)}</span>
              <span className="flex gap-1.5"><Button icon={Undo2} onClick={seed} loading={seeding}>Minta-szolgáltatások betöltése</Button><Button variant="glass" icon={Plus} onClick={openNew}>Új szolgáltatás</Button></span>
            </span>
          ) : undefined}>
            Válaszd ki a szakmád, és betöltjük a jellemző szolgáltatásokat árral és időtartammal — utána csak átírod. A foglalóoldalon ezekből választ a vendég.
          </EmptyState>
        </>
      ) : (
        <>
          {/* ── 8.1: desktopon a szűrő és a rács, mobilon (8.5) ugyanazok a kártyák egy oszlopban, a szűrő a fejléc ikonján ── */}
          {head}
          <div className="max-lg:hidden"><ServiceFilterBar cats={cats} active={cat} onPick={setCat} query={query} onQuery={setQuery} /></div>
          {cat > 0 && <div className="lg:hidden"><Button variant="glass" size="sm" onClick={() => setCat(0)}>{cats[cat][0]} · Mind</Button></div>}
            {/* mobil (8.5): alacsony sorok egymás alatt — elöl a legnépszerűbb, utána kategóriánként */}
            <div className="mt-4 lg:hidden">
              <MobileServiceList
                popular={popular && popular.monthCount > 0 && shown.includes(popular) ? <ServiceRow s={card(popular)} popular={{ count: popular.monthCount, month, trend: popular.weeks }} onOpen={() => openService(popular)} /> : null}
                groups={[...categories.map((c) => ({ id: c.id as string | null, h: c.name })), { id: null, h: 'Kategória nélkül' }]
                  .map((g) => ({ h: g.h, rows: shown.filter((x) => x.categoryId === g.id && !(x.id === popular?.id && popular.monthCount > 0)).map((x) => <ServiceRow key={x.id} s={card(x)} deposit={depositOf(x.price, x.currency)} onOpen={() => openService(x)} />) }))
                  .filter((g) => g.rows.length)} />
            </div>
            <ServiceGrid className="mt-4 max-lg:hidden">
              {shown.length === 0 && <Meta className="col-span-full py-10 text-center">Nincs a szűrésnek megfelelő szolgáltatás.</Meta>}
              {/* a hónap legnépszerűbbje elöl, sötét kártyán */}
              {[...shown].sort((a, b) => Number(b.id === popular?.id && b.monthCount > 0) - Number(a.id === popular?.id && a.monthCount > 0)).map((s) => (s.id === popular?.id && popular.monthCount > 0
                ? <PopularServiceCard key={s.id} s={card(s)} count={s.monthCount} month={month} trend={s.weeks} onOpen={() => openService(s)} />
                : <ServiceCard key={s.id} s={card(s)} deposit={depositOf(s.price, s.currency)} onOpen={() => openService(s)} />))}
              {canManage && <NewServiceCard onClick={openNew} />}
            </ServiceGrid>
        </>
      )}

      {/* szerkesztő (8.3): az Új foglalás ablaka — desktopon jobbra szürke összefoglaló, mobilon alulról egy hasábban */}
      <PopupModal open={!!edit} onClose={() => setEdit(null)} title={edit?.v.name || 'Új szolgáltatás'} subtitle={edit ? catName(edit.v.categoryId) || undefined : undefined} maxWidth="sm:max-w-[920px]"
        headerExtra={edit?.id ? <LocaleEditBar available={locales} active={loc} onSelect={(l) => void switchLocale(l)} loading={locBusy} /> : undefined}
        aside={summary}>
        {form(false)}
      </PopupModal>
      <ConfirmDialog open={confirmDel} title="Szolgáltatás törlése" description={edit?.v.name} confirmLabel="Törlés" busy={busy} onConfirm={remove} onCancel={() => setConfirmDel(false)} zIndexClass="z-[100]" />

      {/* kategóriák (8.4): az egységes ablak — balra a lista (áthúzható), jobbra szürkén a kijelölt kategória; mobilon alulról */}
      <PopupModal open={catOpen} onClose={() => { setCatOpen(false); setCatEdit(null) }} title="Kategóriák" maxWidth="sm:max-w-[920px]"
        headerAction={canManage ? <Button variant="yellow" size="sm" icon={Plus} onClick={createCat}>Új kategória</Button> : undefined}
        aside={catEdit
          ? <CategoryEditPanel bare value={catEdit.v} onChange={(v) => setCatEdit({ ...catEdit, v })} onImage={canManage ? onCatImage : undefined} onImageRemove={canManage && catEdit.v.img ? () => setCatEdit({ ...catEdit, imageId: null, v: { ...catEdit.v, img: null } }) : undefined}
              textOnly={catLoc !== 'hu'} top={<LocaleEditBar available={locales} active={catLoc} onSelect={(l) => void switchCatLocale(l)} loading={catLocBusy} />}
              upload={catImageUp} onSave={canManage ? saveCat : undefined} onCancel={() => setCatEdit(null)} onDelete={canManage ? () => setConfirmCatDel(true) : undefined} busy={catBusy} />
          : <Meta className="px-6 pb-6">Válassz egy kategóriát a listából, vagy hozz létre újat.</Meta>}>
        <CategoryList bare rows={catRows} openId={catEdit?.id ?? null} onOpen={openCat} rowProps={canManage ? (id) => catSort.bind(id) as React.HTMLAttributes<HTMLDivElement> : undefined} dragging={catSort.dragging} />
      </PopupModal>
      <ConfirmDialog open={confirmCatDel} title="Kategória törlése" description={`${catEdit?.v.name ?? ''} — a szolgáltatásai kategória nélkül maradnak.`} confirmLabel="Törlés" busy={catBusy} onConfirm={deleteCat} onCancel={() => setConfirmCatDel(false)} zIndexClass="z-[100]" />

      {/* mobil kategória-lap (8.5) */}
      <PopupModal open={catSheet} onClose={() => setCatSheet(false)} title="Kategória" headerAction={<Button variant="ghost" size="sm" onClick={() => setCat(0)}>Alaphelyzet</Button>}>
        <div className="space-y-1">
          {cats.map(([t, n], i) => (
            <button key={t} type="button" onClick={() => { setCat(i); setCatSheet(false) }} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
              <ListRow filled open={i === cat} title={t} trailing={<span className="text-ui-meta text-ui-muted">{n}</span>} />
            </button>
          ))}
        </div>
        {canManage && <Button variant="glass" icon={List} className="mt-4 w-full" onClick={() => { setCatSheet(false); setCatOpen(true) }}>Kategóriák kezelése</Button>}
      </PopupModal>
    </div>
  )
}
