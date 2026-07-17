'use client'

/**
 * Saját profil szerkesztő — a Beállítások „Saját profil" fülének tartalma (Crextio-stílus).
 * A BEJELENTKEZETT user SAJÁT fiókját szerkeszti (tulaj/vezető/alkalmazott egyaránt).
 *
 * Szekciók (üveges kártyák):
 *  1. Fejléc: nagy avatar (feltöltés/eltávolítás) + név + email (email csak nézet — login-azonosító)
 *  2. Személyes adatok: név, telefon, cím, születésnap, vészhelyzeti kontakt  (/api/user/profile)
 *  3. Szerep / üzletek (csak nézet): hol tulaj, hol alkalmazott
 *  4. Jelszó: régi + új  (/api/user/password — Google-usernél a régi-jelszó ellenőrzés elbukik)
 *
 * Az avatar-feltöltés a dedikált POST /api/user/avatar-t hívja (szerver-oldali media-create a
 * saját auth alapján — így NEM 403-azik, mint a közvetlen /api/media hívás).
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Camera, Eye, EyeOff, Check, Shield, Store } from 'lucide-react'
import { UserAvatar } from './UserAvatar'

export interface ProfileRoleInfo {
  type: 'salon' | 'restaurant'
  name: string
  roleName: string
  isOwner: boolean
}

interface Fields {
  phone?: string | null
  address?: string | null
  birthday?: string | null
  emergency_contact?: string | null
}

const CARD = 'rounded-[20px] border border-line bg-[var(--dav-glass,rgba(255,255,255,.6))] p-5 sm:p-6'
const LABEL = 'mb-1.5 block text-[12.5px] font-medium text-ink-soft'
const INPUT =
  'w-full h-[44px] rounded-[12px] bg-white border border-line text-ink placeholder:text-ink-soft2/70 px-3.5 text-sm outline-none transition-colors focus:border-gold/60 focus:ring-2 focus:ring-gold/25'

/** ISO datetime → YYYY-MM-DD (a date input-hoz). */
function ymd(v?: string | null): string {
  if (!v) return ''
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}

export function ProfileEditor({
  name: initialName,
  email,
  avatarUrl,
  fields,
  roles = [],
}: {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  fields?: Fields
  roles?: ProfileRoleInfo[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)

  // Személyes mezők — helyi state, egyben mentve.
  const [form, setForm] = useState({
    name: initialName ?? '',
    phone: fields?.phone ?? '',
    address: fields?.address ?? '',
    birthday: ymd(fields?.birthday),
    emergency_contact: fields?.emergency_contact ?? '',
  })
  const [savingInfo, setSavingInfo] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const [showPwSection, setShowPwSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  async function saveInfo() {
    if (savingInfo) return
    if (!form.name.trim()) { toast.error('A név nem lehet üres'); return }
    setSavingInfo(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone,
          address: form.address,
          birthday: form.birthday || null,
          emergency_contact: form.emergency_contact,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profil mentve')
      router.refresh()
    } catch {
      toast.error('A profil mentése sikertelen')
    } finally {
      setSavingInfo(false)
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      toast.success('Profilkép frissítve')
      router.refresh()
    } catch {
      toast.error('Nem sikerült feltölteni a profilképet.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAvatar() {
    if (uploading) return
    setUploading(true)
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar_url: null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profilkép eltávolítva')
      router.refresh()
    } catch {
      toast.error('Nem sikerült eltávolítani a profilképet.')
    } finally {
      setUploading(false)
    }
  }

  async function savePassword() {
    if (savingPw) return
    if (newPassword.length < 6) { toast.error('Az új jelszó legalább 6 karakter legyen.'); return }
    if (!currentPassword) { toast.error('Add meg a jelenlegi jelszavad.'); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'hiba')
      toast.success('Jelszó megváltoztatva')
      setCurrentPassword('')
      setNewPassword('')
      setShowPwSection(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'A jelszó módosítása sikertelen')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
      />

      {/* 1. Fejléc-kártya: avatar + név + email */}
      <div className={`${CARD} flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left`}>
        <div className="relative shrink-0">
          <UserAvatar name={form.name} src={avatarUrl} size={84} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Profilkép cseréje"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink-dark text-white ring-2 ring-white transition-transform hover:scale-105 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" strokeWidth={1.9} />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-semibold text-ink">{form.name || 'Fiók'}</div>
          {email && <div className="truncate text-[13.5px] text-ink-soft mt-0.5">{email}</div>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-line-strong disabled:opacity-50"
            >
              Kép feltöltése
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
              >
                Eltávolítás
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Személyes adatok */}
      <div className={CARD}>
        <div className="mb-4 text-[15px] font-semibold text-ink">Személyes adatok</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>Név</label>
            <input value={form.name} onChange={set('name')} placeholder="Teljes név" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Email <span className="text-ink-soft2">(bejelentkezéshez)</span></label>
            <input value={email ?? ''} disabled className={`${INPUT} bg-[#faf9f6] text-ink-soft cursor-not-allowed`} />
          </div>
          <div>
            <label className={LABEL}>Telefon</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+36 …" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Születésnap</label>
            <input type="date" value={form.birthday} onChange={set('birthday')} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Vészhelyzeti kontakt</label>
            <input value={form.emergency_contact} onChange={set('emergency_contact')} placeholder="Név · telefon" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Cím</label>
            <input value={form.address} onChange={set('address')} placeholder="Irányítószám, város, utca" className={INPUT} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={saveInfo}
            disabled={savingInfo}
            className="flex h-11 items-center gap-2 rounded-full bg-ink-dark px-6 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Változtatások mentése
          </button>
        </div>
      </div>

      {/* 3. Szerep / üzletek (csak nézet) */}
      {roles.length > 0 && (
        <div className={CARD}>
          <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Shield className="h-[18px] w-[18px] text-ink-soft" strokeWidth={1.8} /> Szerepeim
          </div>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1EEE6] text-ink">
                  <Store className="h-[16px] w-[16px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-ink">{r.name}</div>
                  <div className="truncate text-[12px] text-ink-soft">{r.type === 'restaurant' ? 'Étterem' : 'Szalon'}</div>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold"
                  style={r.isOwner ? { background: '#E7F1E9', color: '#3B6B4B' } : { background: '#F1EEE6', color: '#86826F' }}
                >
                  {r.roleName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Jelszó */}
      <div className={CARD}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-ink">Jelszó</div>
          {!showPwSection && (
            <button
              type="button"
              onClick={() => setShowPwSection(true)}
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-line-strong"
            >
              Megváltoztatás
            </button>
          )}
        </div>
        {showPwSection && (
          <div className="mt-4 space-y-2.5">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Jelenlegi jelszó"
              className={INPUT}
            />
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Új jelszó (min. 6 karakter)"
                className={`${INPUT} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft2 transition-colors hover:text-ink"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={savePassword}
                disabled={savingPw}
                className="flex h-11 items-center gap-2 rounded-full bg-ink-dark px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Jelszó mentése
              </button>
              <button
                type="button"
                onClick={() => { setShowPwSection(false); setCurrentPassword(''); setNewPassword('') }}
                className="h-11 rounded-full px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-white"
              >
                Mégse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
