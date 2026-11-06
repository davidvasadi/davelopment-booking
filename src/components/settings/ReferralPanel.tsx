'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Gift } from 'lucide-react'
import { toast } from 'sonner'
import { ReferralCard } from '@/components/blocks/brand'
import { ReferralPage } from '@/components/blocks/referral'
import { QrSvg } from '@/components/blocks/qr'
import { Pill } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { APP_URL } from '@/lib/brand'
import type { ReferralSummary } from '@/lib/referrals'
import { displayCode } from '@/lib/referralCode'

const MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getDate()}.` }

/** Az ajánló adatai (`/api/referral`) és a megosztás műveletei — a Telephelyek kártyája és a Partnerprogram oldal közös
 *  része. `card(props)`: az élő ajánló-kártya; `qr`: a QR-popup (a kártya mellé kell tenni). */
function useReferral() {
  const [data, setData] = useState<ReferralSummary | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  useEffect(() => {
    void fetch('/api/referral', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => null)
  }, [])
  if (!data) return null
  const url = `${APP_URL}/r/${displayCode(data.code).toLowerCase()}`
  const text = `Szia! Én a davelopment bookingot használom a foglalásokra — online foglalás, emlékeztetők, vendéglista egy helyen. Ezzel a linkkel 30 napig ingyen kipróbálhatod, kártya nélkül: ${url.replace(/^https?:\/\//, '')}`
  const copyText = () => void navigator.clipboard?.writeText(text).then(() => toast.success('Üzenet másolva — illeszd be, ahova küldenéd'))
  const share = () => { if (navigator.share) void navigator.share({ title: 'davelopment booking', text }).catch(() => null); else copyText() }
  const card = (p: { className?: string; labeled?: boolean; badge?: React.ReactNode }) => (
    <ReferralCard wide {...p} url={url}
      onCopy={() => void navigator.clipboard?.writeText(url).then(() => toast.success('Link másolva'))}
      share={{
        whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
        email: `mailto:?subject=${encodeURIComponent('Online foglalás — 30 nap ingyen')}&body=${encodeURIComponent(text)}`,
        onShare: share,
        onQr: () => setQrOpen(true),
      }}
      stats={{ clicks: data.clicks, registered: data.registered, subscribed: data.subscribed }}
      rows={data.rows.map((r) => ({ key: r.id, name: r.name, date: day(r.date), status: r.status }))} />
  )
  const qr = (
    <PopupModal open={qrOpen} onClose={() => setQrOpen(false)} title="Ajánló QR-kód" subtitle="Beolvasva a regisztráció nyílik meg a kódoddal." maxWidth="sm:max-w-[420px]">
      {/* középen a faviconunk (fehér keretben — a QR magas hibajavítással készül, így beolvasható marad) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <QrSvg url={url} logo={<img src="/icons/favico_light.svg?v=2" alt="" className="h-full w-full object-contain" />} className="mx-auto h-64 w-64" />
      <div className="mt-3 text-center text-ui-meta text-ui-muted">{url.replace(/^https?:\/\//, '')}</div>
    </PopupModal>
  )
  return { url, card, qr, share, copyText }
}

/** Beállítások › Telephelyek (design 16.16): a letisztult ajánló-kártya; a jobb hasáb alján a pill a Partnerprogram
 *  oldalra visz (`partnerHref`). Csak a fiók tulajdonosának. */
export function ReferralPanel({ className, partnerHref }: { className?: string; partnerHref?: string }) {
  const r = useReferral()
  if (!r) return null
  const badge = partnerHref ? <Link href={partnerHref} className="rounded-full outline-none transition-opacity hover:opacity-85"><Pill tone="yellow" icon={Gift}>+1 hónap ingyen</Pill></Link> : undefined
  return <>{r.card({ className, badge })}{r.qr}</>
}

/** A Partnerprogram oldal tartalma (design 20.1, a davelopment-rész nélkül): a kártya feliratos gombokkal, a lépések,
 *  a szabályok és a kész üzenet. */
export function PartnerProgramBody() {
  const r = useReferral()
  if (!r) return null
  return <><ReferralPage card={r.card({ labeled: true })} url={r.url} onCopyMessage={r.copyText} onShareMessage={r.share} />{r.qr}</>
}
