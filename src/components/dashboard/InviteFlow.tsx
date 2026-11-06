'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Note } from '@/components/ui-kit'
import { Popup } from '@/components/shared/Popup'
import { InviteModal, type InviteRole, type InviteValue } from '@/components/blocks/team'

/**
 * Munkatárs meghívása (design 16.4) — a Munkatársak oldal és a Beállítások › Csapat & jogok KÖZÖS folyamata: e-mail +
 * név, szerep, és szalonnál melyik munkatárs-profilhoz kösse (új foglalható profil / nem foglalható / meglévő profil).
 * E-mail nélkül, „új profil”-lal belépés nélküli, foglalható munkatársat vesz fel. Siker után az oldal frissül.
 */
export function InviteFlow({ open, onClose, restaurant = false, businessId, roles, freeStaff = [], extraFee, bookable = 0 }: {
  open: boolean
  onClose: () => void
  restaurant?: boolean
  businessId: string
  roles: InviteRole[]
  /** szalon: a még fiókhoz nem kötött munkatárs-profilok (a „Meglévő: …” választáshoz) */
  freeStaff?: { id: string; name: string }[]
  /** a csomag extra díja új foglalható munkatársnál (ha a keret betelt) */
  extraFee?: { fee: number; included: number }
  /** jelenleg foglalható (aktív) munkatársak száma — az extra díj figyelmeztetéshez */
  bookable?: number
}) {
  const router = useRouter()
  const [invite, setInvite] = useState<InviteValue | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setInvite(open ? { email: '', name: '', roleId: roles[0]?.id ?? '', profile: restaurant ? '' : 'new' } : null) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const profiles = restaurant ? [] : [
    { id: 'new', title: 'Új profil létrehozása', desc: 'foglalható lesz, a Naptárban megjelenik' },
    { id: 'none', title: 'Nem foglalható', desc: 'csak a rendszert kezeli (pl. recepció)' },
    ...freeStaff.map((m) => ({ id: m.id, title: `Meglévő: ${m.name}`, desc: 'összeköti a fiókot a profillal' })),
  ]
  const noLogin = !restaurant && !!invite && !invite.email.trim() && invite.profile === 'new'

  const submit = async () => {
    if (!invite) return
    const email = invite.email.trim().toLowerCase()
    const name = invite.name.trim()
    if (noLogin) {
      // belépés nélküli, foglalható profil (pl. aki nem használja a rendszert) — csak a név kell
      if (!name) { toast.error('Add meg a nevét vagy az e-mail-címét'); return }
      setBusy(true)
      try {
        const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, salon: businessId, is_active: true }) })
        if (!res.ok) throw new Error()
        toast.success('Munkatárs hozzáadva'); onClose(); router.refresh()
      } catch { toast.error('A hozzáadás sikertelen') } finally { setBusy(false) }
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Érvényes e-mail-cím kell'); return }
    if (!invite.roleId) { toast.error('Válassz szerepet (a Beállítások › Csapat & jogok › Szerepek alatt hozod létre)'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, name: name || undefined, custom_role: invite.roleId, ...(restaurant ? {} : { profile: invite.profile }) }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'A meghívás sikertelen')
      toast.success('Meghívó elküldve'); onClose(); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'A meghívás sikertelen') } finally { setBusy(false) }
  }

  if (!invite) return null
  return (
    <Popup onClose={onClose}>
      <InviteModal value={invite} onChange={setInvite} roles={roles} profiles={profiles} busy={busy}
        submitLabel={noLogin ? 'Munkatárs hozzáadása' : 'Meghívó küldése'}
        preview={noLogin ? null : `„Meghívtak a csapatba${invite.roleId ? ` (${roles.find((r) => r.id === invite.roleId)?.label ?? ''})` : ''}. A meghívó linkjével saját belépést kapsz.”`}
        onSubmit={() => void submit()} onCancel={onClose} />
      {(noLogin || (!restaurant && invite.profile === 'new')) && extraFee && extraFee.fee > 0 && bookable >= extraFee.included && (
        <Note warn className="mx-auto mt-2 max-w-[880px]">Új foglalható munkatársként +{extraFee.fee.toLocaleString('hu-HU')} Ft-tal nő a havidíj.</Note>
      )}
    </Popup>
  )
}
