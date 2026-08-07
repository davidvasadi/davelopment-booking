'use client'

import { Share2, MessageCircle } from 'lucide-react'

function FacebookIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.987C18.343 21.128 22 16.991 22 12z" />
    </svg>
  )
}

function InstagramIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TipShareRow({ title, url }: { title: string; url: string }) {
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-[8px] shrink-0'
  const iconStyle = { background: '#3B3B3B' }
  const iconColor = { color: '#ffffff' }

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        /* felhasználó megszakította — nincs teendő */
      }
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
  }

  const handleInstagram = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url)
    }
    window.open('https://instagram.com', '_blank', 'noopener,noreferrer')
  }

  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const smsHref = `sms:?body=${encodeURIComponent(`${title} ${url}`)}`

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleShare} aria-label="Megosztás" className={iconBtn} style={iconStyle}>
        <Share2 className="h-3.5 w-3.5" style={iconColor} />
      </button>
      <button type="button" onClick={handleInstagram} aria-label="Megosztás Instagramon" className={iconBtn} style={iconStyle}>
        <InstagramIcon className="h-3.5 w-3.5" style={iconColor} />
      </button>
      <a href={fbHref} target="_blank" rel="noopener noreferrer" aria-label="Megosztás Facebookon" className={iconBtn} style={iconStyle}>
        <FacebookIcon className="h-3.5 w-3.5" style={iconColor} />
      </a>
      <a href={smsHref} aria-label="Megosztás üzenetben" className={iconBtn} style={iconStyle}>
        <MessageCircle className="h-3.5 w-3.5" style={iconColor} />
      </a>
    </div>
  )
}
