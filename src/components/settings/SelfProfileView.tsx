'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, FIELD, FieldRow } from '@/components/ui-kit'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { SelfProfilePage, type DeviceRow, type SelfProfileValue } from '@/components/blocks/settings'

/**
 * Beállítások › Saját profil (design 16.17) — a bejelentkezett felhasználó SAJÁT adatai (nem az üzleté): fotó, név,
 * telefon, születésnap, vészhelyzeti kontakt, cím (`/api/user/profile`). A mentés a hub közös sávján megy. Belépés: e-mailes kód
 * vagy Google (jelszó nincs); az aktív eszközök (`/api/auth/sessions`) — bármelyik kijelentkeztethető.
 */

export type SelfProfileData = {
  name: string; email: string; avatarUrl: string | null
  phone: string | null; address: string | null; birthday: string | null; emergency: string | null
  roles: { name: string; role: string }[]
}

/** „most” / „5 perce” / „3 órája” / „2 napja” */
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 2 ? 'most' : m < 60 ? `${m} perce` : m < 1440 ? `${Math.round(m / 60)} órája` : `${Math.round(m / 1440)} napja` }
const ymd = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '')

export function SelfProfileView({ data, onDirtyChange, registerApi }: {
  data: SelfProfileData
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}) {
  const router = useRouter()
  const base = useMemo<SelfProfileValue>(() => ({ name: data.name, phone: data.phone ?? '', birthday: ymd(data.birthday), emergency: data.emergency ?? '', address: data.address ?? '' }), [data])
  const [value, setValue] = useState(base)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const loadDevices = () => {
    void fetch('/api/auth/sessions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((j: { sessions?: { id: string; device: string; lastSeen: string; current: boolean }[] } | null) => {
      if (j?.sessions) setDevices(j.sessions.map((x) => ({ id: x.id, device: x.device, meta: ago(x.lastSeen), current: x.current, mobile: /iPhone|iPad|Android/.test(x.device) })))
    }).catch(() => null)
  }
  useEffect(loadDevices, [])
  const revoke = async (q: string, msg: string) => {
    const res = await fetch(`/api/auth/sessions?${q}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    if (res?.ok) { toast.success(msg); loadDevices() } else toast.error('Nem sikerült kijelentkeztetni.')
  }

  const infoDirty = JSON.stringify(value) !== JSON.stringify(base)
  useEffect(() => { onDirtyChange?.(infoDirty) }, [infoDirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const ref = useRef({ value, infoDirty })
  ref.current = { value, infoDirty }
  useEffect(() => {
    registerApi?.({
      save: async () => {
        const c = ref.current
        if (c.infoDirty && !c.value.name.trim()) { toast.error('A név nem lehet üres'); return false }
        try {
          if (c.infoDirty) {
            const res = await fetch('/api/user/profile', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
              body: JSON.stringify({ name: c.value.name.trim(), phone: c.value.phone, address: c.value.address, birthday: c.value.birthday || null, emergency_contact: c.value.emergency }),
            })
            if (!res.ok) throw new Error()
          }
          return true
        } catch { toast.error('A mentés nem sikerült'); return false }
      },
      discard: () => setValue(base),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])

  const uploadPhoto = async (file: File) => {
    setPhotoBusy(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      toast.success('Profilkép frissítve'); router.refresh()
    } catch { toast.error('Nem sikerült feltölteni a profilképet.') } finally { setPhotoBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const removePhoto = async () => {
    setPhotoBusy(true)
    try {
      const res = await fetch('/api/user/avatar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ avatar_url: null }) })
      if (!res.ok) throw new Error()
      toast.success('Profilkép eltávolítva'); router.refresh()
    } catch { toast.error('Nem sikerült eltávolítani a profilképet.') } finally { setPhotoBusy(false) }
  }
  const logout = async () => {
    await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' }).catch(() => null)
    router.push('/login')
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f) }} />
      <SelfProfilePage save={false} value={value} onChange={setValue} email={data.email} avatar={data.avatarUrl}
        onPhoto={() => fileRef.current?.click()} onRemovePhoto={() => void removePhoto()} photoBusy={photoBusy}
        roles={data.roles.map((r) => [r.name, r.role] as const)}
        login={<>
          <FieldRow label="Belépés módja" hint="jelszó nincs — minden belépésnél kódot küldünk az e-mail-címedre"><span className="text-ui-body text-ui-text">E-mailes kód vagy Google</span></FieldRow>
          <FieldRow label="Munkamenet" hint="7 napig él ezen az eszközön"><Button variant="cell" size="sm" onClick={() => void logout()}>Kijelentkezés</Button></FieldRow>
        </>}
        devices={devices} onRevoke={(id) => void revoke(`id=${encodeURIComponent(id)}`, 'Eszköz kijelentkeztetve')} onRevokeOthers={() => void revoke('others=1', 'Minden más eszköz kijelentkeztetve')}
        birthdayPicker={
          <DatePickerPopover value={value.birthday || '1990-01-01'} onChange={(d) => setValue({ ...value, birthday: d })} yearRange={[1930, new Date().getFullYear()]}
            onClear={value.birthday ? () => setValue({ ...value, birthday: '' }) : undefined} triggerClassName={`${FIELD} h-11 w-full text-left`}>
            {value.birthday ? new Date(`${value.birthday}T12:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }) : <span className="text-ui-muted">Nincs megadva</span>}
          </DatePickerPopover>
        } />

    </>
  )
}
