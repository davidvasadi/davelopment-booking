'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'
import {
  Type, LayoutGrid, Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered,
  RectangleHorizontal, Minus, Trash2, Bold, Italic, Underline, Strikethrough, Link2,
  AlignLeft, AlignCenter, AlignRight, Paintbrush, Image as ImageIcon, Play, GripVertical,
  Rows2, Columns2, Columns3, Columns4, Share2, Code2, Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonHover } from '@/lib/motion'
import { COLORS, escapeHtml } from '@/lib/emailLayout'
import { compressImage } from '@/lib/compressImage'

/**
 * Blokk-alapú hírlevél-szerkesztő — a Resend-féle sablon-builder vizuális nyelvét követi
 * (lebegő fekete ikon-sín bal oldalon, kattintásra kinyíló fekete flyout-menü blokk-
 * típusokkal). YouTube/X/Diagram embedek egyik email-kliensben sem futnak (nincs iframe/JS) —
 * ezért ezek is (a valódi Resend-szerkesztőhöz hasonlóan) egy sima, kattintható KÉP-blokkot
 * szúrnak be, opcionális kimenő linkkel.
 */

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `blk-${Date.now()}-${idCounter}`
}

type TextAlign = 'left' | 'center' | 'right'
type SocialPlatform =
  | 'facebook' | 'instagram' | 'x' | 'tiktok' | 'linkedin' | 'youtube' | 'pinterest'
  | 'whatsapp' | 'telegram' | 'snapchat' | 'threads' | 'twitch' | 'github' | 'website'

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', linkedin: 'LinkedIn',
  youtube: 'YouTube', pinterest: 'Pinterest', whatsapp: 'WhatsApp', telegram: 'Telegram',
  snapchat: 'Snapchat', threads: 'Threads', twitch: 'Twitch', github: 'GitHub', website: 'Weboldal',
}
/** A Resend mintájára: NINCS kézi platform-választó — a felhasználó csak beilleszti a linket,
 *  a platformot a domainből ismerjük fel (nem tárolt mező, mindig az URL-ből számoljuk, hogy
 *  sose menjen szét a kettő). Ami nincs a listában, az "website" glóbusz-ikont kap — tehát
 *  BÁRMILYEN platform linkje működik, nem csak a felsoroltak. */
const PLATFORM_HOSTS: { platform: SocialPlatform; hosts: string[] }[] = [
  { platform: 'facebook', hosts: ['facebook.com', 'fb.com'] },
  { platform: 'instagram', hosts: ['instagram.com'] },
  { platform: 'x', hosts: ['x.com', 'twitter.com'] },
  { platform: 'tiktok', hosts: ['tiktok.com'] },
  { platform: 'linkedin', hosts: ['linkedin.com'] },
  { platform: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { platform: 'pinterest', hosts: ['pinterest.com'] },
  { platform: 'whatsapp', hosts: ['whatsapp.com', 'wa.me'] },
  { platform: 'telegram', hosts: ['telegram.org', 't.me'] },
  { platform: 'snapchat', hosts: ['snapchat.com'] },
  { platform: 'threads', hosts: ['threads.net'] },
  { platform: 'twitch', hosts: ['twitch.tv'] },
  { platform: 'github', hosts: ['github.com'] },
]
function detectPlatform(rawUrl: string): SocialPlatform {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const match = PLATFORM_HOSTS.find(({ hosts }) => hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    if (match) return match.platform
  } catch {
    // még félkész/érvénytelen URL — nincs felismerhető platform
  }
  return 'website'
}

/** Ink-sötét kör-jelvény VALÓDI márka-ikonnal — a Lucide-ban nincsenek márka-logók (szándékosan,
 *  licenc miatt egyik generikus ikonkészlet sem tartalmaz védjegyzett logókat), ezért a "Simple
 *  Icons" (simpleicons.org, MIT licenc, npm: `simple-icons`) hivatalos, pontos SVG-útvonalait
 *  ágyazzuk be — ugyanaz a forrás, amit a legtöbb weboldal/app használ márka-ikonokhoz. Minden
 *  ikon saját 24×24-es koordinátarendszerű, `translate(8,8) scale(.8333)`-mal illesztve a 36×36-os
 *  körbe (20×20 méretben, középre). A LinkedIn-nek nincs bejegyzése a Simple Icons-ban (a
 *  Microsoft/LinkedIn kérésére eltávolították) — ott marad az "in" glif. */
const SOCIAL_GLYPH: Record<SocialPlatform, string> = {
  facebook: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></g>',
  instagram: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></g>',
  x: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></g>',
  tiktok: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></g>',
  linkedin: '<text x="18" y="18" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">in</text>',
  youtube: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></g>',
  pinterest: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></g>',
  whatsapp: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></g>',
  telegram: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></g>',
  snapchat: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></g>',
  threads: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"/></g>',
  twitch: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></g>',
  github: '<g fill="#fff" transform="translate(8,8) scale(0.8333)"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></g>',
  website: '<circle cx="18" cy="18" r="7.2" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M10.8 18h14.4M18 10.8c2.1 1.9 3.2 4.6 3.2 7.2s-1.1 5.3-3.2 7.2c-2.1-1.9-3.2-4.6-3.2-7.2s1.1-5.3 3.2-7.2Z" fill="none" stroke="#fff" stroke-width="1.3"/>',
}
function socialIconDataUri(platform: SocialPlatform): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18" fill="#3B3B3B"/>${SOCIAL_GLYPH[platform]}</svg>`,
  )}`
}

/** Egy oszlop-cella tartalma — NEM csak szöveg, hanem kép/gomb is lehet (a teljes, egymásba
 *  ágyazott blokk-rendszer/drag&drop egy jóval nagyobb átépítés lenne, de a leggyakoribb
 *  tartalom-típusok így már elérhetők soronként, típus-váltóval). */
export type ColumnCell =
  | { type: 'empty' }
  | { type: 'text'; html: string; align?: TextAlign; color?: string | null; bg?: string | null }
  | { type: 'image'; url: string; alt: string; link?: string }
  | { type: 'button'; label: string; url: string }

export type ComposerBlock =
  | { id: string; type: 'text' | 'title' | 'subtitle' | 'heading' | 'bullet_list' | 'numbered_list'; html: string; align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number }
  | { id: string; type: 'button'; label: string; url: string; align?: TextAlign }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; url: string; alt: string; link?: string; align?: TextAlign; kind?: 'image' | 'youtube' }
  | { id: string; type: 'section'; html: string; bg?: string | null }
  | { id: string; type: 'columns'; cols: ColumnCell[] }
  | { id: string; type: 'social_links'; links: { url: string }[]; align?: TextAlign }
  | { id: string; type: 'html'; code: string }
  | { id: string; type: 'code'; code: string }

function textBlockStyle(b: { align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number }, extra: string): string {
  const align = b.align && b.align !== 'left' ? `text-align:${b.align};` : ''
  const bg = b.bg ? `background:${b.bg};padding:10px 14px;border-radius:8px;` : ''
  // A szín/betűméret/sorköz a bázis-stílus UTÁN kerül a style-attribútumba, így felülírja a
  // típusonkénti alapértéket (böngésző: azonos property-nél a KÉSŐBBI deklaráció nyer).
  const color = b.color ? `color:${b.color};` : ''
  const fontSize = b.fontSize ? `font-size:${b.fontSize}px;` : ''
  const lineHeight = b.lineHeight ? `line-height:${b.lineHeight};` : ''
  return `${extra}${align}${bg}${color}${fontSize}${lineHeight}`
}

/** A szerkesztő `contentEditable` mezője (lásd `EditableBlock`) Enterre új sort `<div>`-ként szúr
 *  be (böngésző-alapértelmezett viselkedés), NEM `<br>`-t. Ez a kimenő email-HTML-ben, ahol a
 *  tartalom `<p>`/`<h1>`-szerű elembe kerül, ÉRVÉNYTELEN beágyazás — a böngésző/email-kliens az
 *  ELSŐ beágyazott `<div>`-nél lezárja a szülő `<p>`-t, minden AZUTÁNI sor elveszíti a
 *  blokk-szintű stílust (szín/háttér/igazítás). A `<div>` sortöréseket ezért `<br>`-re cseréljük,
 *  mielőtt bármilyen `<p>`/`<h1..h3>`/`<td>` elembe kerülnének. */
function sanitizeInlineHtml(html: string): string {
  return html.replace(/<\/div>\s*<div>/gi, '<br>').replace(/<\/?div>/gi, '')
}

// ── YouTube-borítókép ────────────────────────────────────────────────────────────
// A YouTube API-kulcs nélkül is kiszolgál egy kiszámítható borítókép-URL-t bármelyik videóhoz
// — ezt használjuk ki: a felhasználó csak beilleszti a videó linkjét, a videó-ID-t innen
// nyerjük ki, a többi automatikus (borítókép + lejátszás-gomb overlay + link a videóra).
const PLAY_ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)"/><path d="M26 20l20 12-20 12z" fill="#fff"/></svg>',
)}`

function parseYouTubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.replace(/^www\./, '').endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
      if (m) return m[2]
    }
    return null
  } catch {
    return null
  }
}
function youtubeThumbUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

export function blocksToHtml(blocks: ComposerBlock[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case 'title':
        return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${COLORS.text};line-height:1.25;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h1>`
      case 'subtitle':
        return `<h2 style="margin:0 0 10px;font-size:18px;font-weight:600;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h2>`
      case 'heading':
        return `<h3 style="margin:0 0 8px;font-size:16px;font-weight:600;color:${COLORS.text};line-height:1.3;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</h3>`
      case 'bullet_list':
        return `<ul style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ul>`
      case 'numbered_list':
        return `<ol style="margin:0 0 14px;padding-left:20px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${b.html}</ol>`
      case 'button': {
        const align = b.align ?? 'left'
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;${align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : ''}"><tr><td style="background:${COLORS.ink};border-radius:999px"><a href="${b.url || '#'}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:999px">${escapeHtml(b.label || 'Gomb')}</a></td></tr></table>`
      }
      case 'divider':
        return `<hr style="margin:18px 0;border:none;border-top:1px solid ${COLORS.border}" />`
      case 'image': {
        if (!b.url) return ''
        const align = b.align ?? 'left'
        const img = b.kind === 'youtube'
          ? `<span style="position:relative;display:inline-block;max-width:100%"><img src="${b.url}" alt="${escapeHtml(b.alt)}" style="max-width:100%;border-radius:10px;display:block;border:0" /><img src="${PLAY_ICON_DATA_URI}" alt="" width="60" height="60" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border:0" /></span>`
          : `<img src="${b.url}" alt="${escapeHtml(b.alt)}" style="max-width:100%;border-radius:10px;display:inline-block;border:0" />`
        const inner = b.link?.trim() ? `<a href="${b.link.trim()}" target="_blank" style="text-decoration:none">${img}</a>` : img
        return `<p style="margin:0 0 14px;text-align:${align}">${inner}</p>`
      }
      case 'section':
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr><td style="padding:20px;border-radius:14px;background:${b.bg || '#F7F5F0'};color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere">${sanitizeInlineHtml(b.html)}</td></tr></table>`
      case 'columns': {
        const n = b.cols.length || 1
        const width = Math.floor(100 / n)
        const cells = b.cols.map((c) => {
          let inner = ''
          if (c.type === 'text') {
            const style = `${c.align && c.align !== 'left' ? `text-align:${c.align};` : ''}${c.bg ? `background:${c.bg};padding:10px 14px;border-radius:8px;` : ''}${c.color ? `color:${c.color};` : ''}`
            const cellHtml = sanitizeInlineHtml(c.html)
            inner = style ? `<div style="${style}">${cellHtml}</div>` : cellHtml
          }
          else if (c.type === 'image' && c.url) {
            const img = `<img src="${c.url}" alt="${escapeHtml(c.alt)}" style="max-width:100%;border-radius:8px;display:block;border:0" />`
            inner = c.link?.trim() ? `<a href="${c.link.trim()}" style="text-decoration:none">${img}</a>` : img
          } else if (c.type === 'button') {
            inner = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${COLORS.ink};border-radius:999px"><a href="${c.url || '#'}" style="display:inline-block;padding:10px 18px;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:999px">${escapeHtml(c.label || 'Gomb')}</a></td></tr></table>`
          }
          return `<td style="width:${width}%;vertical-align:top;padding:0 10px;color:${COLORS.text};font-size:14px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere">${inner}</td>`
        }).join('')
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;table-layout:fixed"><tr>${cells}</tr></table>`
      }
      case 'social_links': {
        const items = b.links.filter((l) => l.url.trim()).map((l) => {
          const platform = detectPlatform(l.url)
          return `<td style="padding:0 6px"><a href="${l.url.trim()}" style="display:inline-block;text-decoration:none"><img src="${socialIconDataUri(platform)}" width="36" height="36" alt="${escapeHtml(SOCIAL_LABELS[platform])}" style="display:block;border:0;border-radius:999px" /></a></td>`
        }).join('')
        if (!items) return ''
        // A HTML `align` attribútum táblázatokon a "left"/"right"-ot megbízhatóan lebegtetésre
        // fordítja böngészőkben, de a "center" támogatása következetlen (több helyen simán
        // hatástalan) — ezért ehelyett CSS margóval középre igazítunk, ugyanúgy, mint a gomb-
        // blokknál (`case 'button'` fentebb) — ez megbízhatóan működik minden esetben.
        const align = b.align ?? 'center'
        const marginStyle = align === 'center' ? 'margin:0 auto 14px' : align === 'right' ? 'margin:0 0 14px 0;margin-left:auto' : 'margin:0 0 14px'
        return `<table role="presentation" cellpadding="0" cellspacing="0" style="${marginStyle}"><tr>${items}</tr></table>`
      }
      case 'html':
        return b.code || ''
      case 'code':
        return b.code ? `<p style="margin:0 0 14px;text-align:center"><code style="display:inline-block;padding:10px 18px;border-radius:8px;background:${COLORS.muted};border:1px dashed ${COLORS.border};font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:14px;color:${COLORS.text};letter-spacing:.04em">${escapeHtml(b.code)}</code></p>` : ''
      case 'text':
      default:
        return `<p style="margin:0 0 14px;color:${COLORS.text};font-size:14px;line-height:1.65;word-break:break-word;overflow-wrap:anywhere;${textBlockStyle(b, '')}">${sanitizeInlineHtml(b.html)}</p>`
    }
  }).join('')
}

export function emptyTextBlock(): ComposerBlock {
  return { id: nextId(), type: 'text', html: '' }
}

type InsertableType = ComposerBlock['type']
type RailItem = { type: InsertableType; label: string; icon: typeof Type; cols?: number; kind?: 'image' | 'youtube' }

const TEXT_ITEMS: RailItem[] = [
  { type: 'text', label: 'Szöveg', icon: Pilcrow },
  { type: 'title', label: 'Cím', icon: Heading1 },
  { type: 'subtitle', label: 'Alcím', icon: Heading2 },
  { type: 'heading', label: 'Kiemelés', icon: Heading3 },
  { type: 'bullet_list', label: 'Felsorolás', icon: List },
  { type: 'numbered_list', label: 'Számozott lista', icon: ListOrdered },
]

const IMAGE_ITEMS: RailItem[] = [
  { type: 'image', label: 'Kép', icon: ImageIcon },
  { type: 'image', label: 'YouTube', icon: Play, kind: 'youtube' },
]

const LAYOUT_ITEMS: RailItem[] = [
  { type: 'button', label: 'Gomb', icon: RectangleHorizontal },
  { type: 'divider', label: 'Elválasztó', icon: Minus },
  { type: 'section', label: 'Szakasz', icon: Rows2 },
  { type: 'columns', label: '2 oszlop', icon: Columns2, cols: 2 },
  { type: 'columns', label: '3 oszlop', icon: Columns3, cols: 3 },
  { type: 'columns', label: '4 oszlop', icon: Columns4, cols: 4 },
  { type: 'social_links', label: 'Közösségi linkek', icon: Share2 },
  { type: 'html', label: 'HTML', icon: Code2 },
  { type: 'code', label: 'Kód', icon: Braces },
]

const RAIL_GROUPS: { key: 'text' | 'image' | 'layout'; icon: typeof Type; items: RailItem[]; title: string }[] = [
  { key: 'text', icon: Type, items: TEXT_ITEMS, title: 'Szöveg-blokkok' },
  { key: 'image', icon: ImageIcon, items: IMAGE_ITEMS, title: 'Média' },
  { key: 'layout', icon: LayoutGrid, items: LAYOUT_ITEMS, title: 'Elemek' },
]

const PLACEHOLDER: Record<string, string> = {
  text: 'Írj egy bekezdést…',
  title: 'Cím…',
  subtitle: 'Alcím…',
  heading: 'Kiemelt szöveg…',
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Szöveg',
  title: 'Cím',
  subtitle: 'Alcím',
  heading: 'Kiemelés',
  bullet_list: 'Felsorolás',
  numbered_list: 'Számozott lista',
}
const TEXT_TYPE_OPTIONS = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list'] as const

function newBlock(type: InsertableType, opts?: { cols?: number; kind?: 'image' | 'youtube' }): ComposerBlock {
  const id = nextId()
  switch (type) {
    case 'button': return { id, type: 'button', label: 'Gomb szövege', url: '' }
    case 'divider': return { id, type: 'divider' }
    case 'image': return { id, type: 'image', url: '', alt: '', link: '', kind: opts?.kind ?? 'image' }
    case 'section': return { id, type: 'section', html: '', bg: '#F7F5F0' }
    case 'columns': return { id, type: 'columns', cols: Array.from({ length: opts?.cols ?? 2 }, (): ColumnCell => ({ type: 'empty' })) }
    case 'social_links': return { id, type: 'social_links', links: [{ url: '' }] }
    case 'html': return { id, type: 'html', code: '' }
    case 'code': return { id, type: 'code', code: '' }
    default: return { id, type, html: '' }
  }
}

/** Apple-szerű "genie" belépő — a UserMenu fiók-popoverének bevált mintája (spring
 *  scale+fade, a gyerek-sorok streamszerű stagger-rel folynak be utána). */
const FLYOUT_PANEL = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 520, damping: 28, mass: 0.9, staggerChildren: 0.03, delayChildren: 0.04 } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: 0.12, ease: 'easeIn' as const } },
}
const FLYOUT_ITEM = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

/** A `ComposerBlock` union `align`/`bg` mezői OPCIONÁLISAK — friss blokkon (pl. `{ id, type:
 *  'text', html: '' }`) a mező szó szerint nincs is jelen, csak akkor kerül rá, ha valaki
 *  ténylegesen módosította. Ezért a támogatottságot a `type` alapján kell eldönteni, NEM a
 *  `'align' in block` futásidejű ellenőrzéssel (az egy friss blokknál mindig hamis lenne). */
const ALIGN_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list', 'button', 'image']
const BG_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list', 'section']
/** Betűszín/betűméret/sorköz csak a "valódi" szöveg-blokkokon értelmezhető (gomb/kép/szakasz
 *  kimarad — azoknak nincs ilyen mezőjük az adatmodellben). */
const TEXT_STYLE_TYPES: ComposerBlock['type'][] = ['text', 'title', 'subtitle', 'heading', 'bullet_list', 'numbered_list']

/** A 4. sín-gomb ("Formázás") tartalma NEM blokk-beszúrás, hanem a fókuszált blokk (vagy —
 *  ha épp egy oszlop-cella van fókuszban — a cella) igazítását/szín-mezőit szerkeszti — ezért
 *  nem illik a `RailFlyout` insertable-item mintájába, saját komponenst kapott. A támogatott
 *  mezőket (és jelenlegi értéküket) a HÍVÓ számolja ki — a blokk és a cella eltérő típus, ezt
 *  a komponensnek nem kell ismernie, csak a végeredményt kapja meg. */
function FormatFlyout({ hasTarget, supportsAlign, supportsBg, supportsColor, supportsSize, currentAlign, currentBg, currentColor, currentFontSize, currentLineHeight, onAlign, onBg, onColor, onFontSize, onLineHeight, align = 'top' }: {
  hasTarget: boolean
  supportsAlign: boolean
  supportsBg: boolean
  supportsColor: boolean
  supportsSize: boolean
  currentAlign: TextAlign
  currentBg: string | null
  currentColor: string | null
  currentFontSize: number | undefined
  currentLineHeight: number | undefined
  onAlign: (a: TextAlign) => void
  onBg: (bg: string | null) => void
  onColor: (c: string | null) => void
  onFontSize: (n: number | undefined) => void
  onLineHeight: (n: number | undefined) => void
  align?: 'top' | 'bottom'
}) {
  return (
    <motion.div
      variants={FLYOUT_PANEL}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: 'left center' }}
      className={cn(
        'absolute left-full z-30 ml-2 w-56 rounded-2xl bg-ink-dark p-3 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]',
        align === 'top' ? 'top-0' : 'bottom-0',
      )}
    >
      {!hasTarget ? (
        <p className="px-1 py-1.5 text-[12.5px] text-white/50">Jelölj ki egy blokkot a tartalomban.</p>
      ) : !supportsAlign && !supportsBg ? (
        <p className="px-1 py-1.5 text-[12.5px] text-white/50">Ez a blokk-típus nem támogat formázást.</p>
      ) : (
        <div className="space-y-3">
          {supportsAlign && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Igazítás</p>
              <div className="flex items-center gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <motion.button
                    key={a}
                    type="button"
                    variants={buttonHover}
                    initial="rest"
                    whileHover="hover"
                    whileTap="hover"
                    onClick={() => onAlign(a)}
                    className={cn('flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white', currentAlign === a && 'bg-white/15 text-white')}
                    title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
                  >
                    {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {supportsColor && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Betűszín</p>
              <div className="flex items-center gap-2 px-1">
                <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-[7px] border border-white/15">
                  <span className="absolute inset-0" style={{ background: currentColor ?? '#3B3B3B' }} />
                  <input type="color" value={currentColor ?? '#3B3B3B'} onChange={(e) => onColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                {currentColor && (
                  <button type="button" onClick={() => onColor(null)} className="text-[11.5px] font-medium text-white/50 hover:text-white">törlés</button>
                )}
              </div>
            </div>
          )}
          {supportsBg && (
            <div>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Háttérszín</p>
              <div className="flex items-center gap-2 px-1">
                <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-[7px] border border-white/15">
                  <span className="absolute inset-0" style={{ background: currentBg ?? '#ffffff' }} />
                  <input type="color" value={currentBg ?? '#ffffff'} onChange={(e) => onBg(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                {currentBg && (
                  <button type="button" onClick={() => onBg(null)} className="text-[11.5px] font-medium text-white/50 hover:text-white">törlés</button>
                )}
              </div>
            </div>
          )}
          {supportsSize && (
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Betűméret</p>
                <div className="flex items-center gap-1.5 rounded-[8px] bg-white/10 px-2">
                  <input
                    type="number"
                    min={10}
                    max={48}
                    placeholder="Alap"
                    value={currentFontSize ?? ''}
                    onChange={(e) => onFontSize(e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 w-full min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                  />
                  <span className="shrink-0 text-[11px] text-white/40">px</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/40">Sorköz</p>
                <div className="flex items-center gap-1.5 rounded-[8px] bg-white/10 px-2">
                  <input
                    type="number"
                    min={1}
                    max={3}
                    step={0.1}
                    placeholder="Alap"
                    value={currentLineHeight ?? ''}
                    onChange={(e) => onLineHeight(e.target.value ? Number(e.target.value) : undefined)}
                    className="h-8 w-full min-w-0 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function RailFlyout({ items, onPick, align = 'top' }: { items: RailItem[]; onPick: (item: RailItem) => void; align?: 'top' | 'bottom' }) {
  return (
    <motion.div
      variants={FLYOUT_PANEL}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ transformOrigin: 'left center' }}
      className={cn(
        'absolute left-full z-30 ml-2 max-h-[80vh] w-52 overflow-y-auto rounded-2xl bg-ink-dark p-1.5 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]',
        align === 'top' ? 'top-0' : 'bottom-0',
      )}
    >
      {items.map((it, i) => (
        <motion.button
          variants={FLYOUT_ITEM}
          key={`${it.type}-${i}`}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(it)}
          whileHover={{ x: 2 }}
          whileTap={{ x: 2 }}
          transition={{ duration: 0.12 }}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <it.icon className="h-4 w-4 shrink-0 text-white/60" strokeWidth={1.8} />
          {it.label}
        </motion.button>
      ))}
    </motion.div>
  )
}

/** KontentEditable szöveg-blokk — a DOM-ot csak MOUNTKOR töltjük fel (üresen indul minden új
 *  blokk), utána a böngésző saját szerkesztés-állapotát sose írjuk felül React-ből — így a
 *  kurzor sosem ugrik el gépelés közben. Kifelé csak `onInput`-tal jelentünk. */
function EditableBlock({ type, html, align, bg, color, fontSize, lineHeight, autoFocus, cellIndex, onInput }: { type: string; html: string; align?: TextAlign; bg?: string | null; color?: string | null; fontSize?: number; lineHeight?: number; autoFocus?: boolean; cellIndex?: number; onInput: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !ref.current) return
    seeded.current = true
    if (type === 'bullet_list' || type === 'numbered_list') ref.current.innerHTML = html || '<li></li>'
    else ref.current.innerHTML = html
    if (autoFocus) ref.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, html])

  const cls = cn(
    'w-full min-w-0 break-words bg-transparent outline-none [&:empty]:before:text-ink-soft2 [&:empty]:before:content-[attr(data-placeholder)]',
    type === 'title' && 'text-[22px] font-bold text-ink',
    type === 'subtitle' && 'text-[17px] font-semibold text-ink',
    type === 'heading' && 'text-[15px] font-semibold text-ink',
    type === 'text' && 'text-[14px] text-ink',
    (type === 'bullet_list') && 'list-disc pl-5 text-[14px] text-ink [&:empty]:before:content-none',
    (type === 'numbered_list') && 'list-decimal pl-5 text-[14px] text-ink [&:empty]:before:content-none',
  )

  const Tag = type === 'bullet_list' ? 'ul' : type === 'numbered_list' ? 'ol' : 'div'
  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onInput((e.target as HTMLElement).innerHTML)}
      data-placeholder={PLACEHOLDER[type]}
      data-cell-index={cellIndex ?? undefined}
      className={cls}
      style={{
        textAlign: align ?? 'left',
        background: bg ?? undefined,
        padding: bg ? '10px 14px' : undefined,
        borderRadius: bg ? '8px' : undefined,
        color: color ?? undefined,
        fontSize: fontSize ? `${fontSize}px` : undefined,
        lineHeight: lineHeight ?? undefined,
      }}
    />
  )
}

type ImageBlock = Extract<ComposerBlock, { type: 'image' }>

/** Kép-blokk szerkesztő — ugyanaz a feltöltés-minta, mint a szalon/étterem logó/borítókép
 *  feltöltésénél (`SalonSettingsForm.tsx`): kliens-oldali tömörítés (`compressImage`) + FormData
 *  POST a Payload `/api/media` végpontjára. */
function ImageBlockEditor({ block, onChange }: { block: ImageBlock; onChange: (patch: Partial<ImageBlock>) => void }) {
  const [uploading, setUploading] = useState(false)
  const [ytInput, setYtInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      onChange({ url: json.doc.url })
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(false)
    }
  }

  const applyYoutube = (raw: string) => {
    const id = parseYouTubeId(raw)
    if (!id) { toast.error('Ez nem egy felismerhető YouTube-link.'); return }
    onChange({ url: youtubeThumbUrl(id), link: youtubeWatchUrl(id), alt: block.alt || 'YouTube videó' })
  }

  const alignRow = block.url ? (
    <div className="flex items-center gap-1">
      {(['left', 'center', 'right'] as const).map((a) => (
        <motion.button
          key={a}
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ align: a })}
          className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (block.align ?? 'left') === a && 'bg-paper text-ink')}
          title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
        >
          {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
        </motion.button>
      ))}
    </div>
  ) : null

  if (block.kind === 'youtube') {
    return (
      <div className="space-y-2 py-1.5">
        {alignRow}
        {block.url ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.url} alt={block.alt} className="max-h-48 rounded-[10px] border border-line" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
            </div>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => onChange({ url: '', link: '' })} title="Videó eltávolítása" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm transition-colors hover:text-[#C0392B]">
              <Trash2 className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        ) : (
          <input
            value={ytInput}
            onChange={(e) => {
              const v = e.target.value
              setYtInput(v)
              if (parseYouTubeId(v)) applyYoutube(v)
            }}
            placeholder="YouTube videó linkje…"
            autoFocus
            className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
        )}
        <input
          value={block.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Alternatív szöveg (alt)"
          className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 py-1.5">
      {alignRow}
      {block.url ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.alt} className="max-h-48 rounded-[10px] border border-line" />
          <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => onChange({ url: '' })} title="Kép törlése" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm transition-colors hover:text-[#C0392B]">
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      ) : (
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-full max-w-[320px] items-center justify-center rounded-[10px] border border-dashed border-line-strong text-[13px] font-medium text-ink-soft2 hover:border-gold/60 hover:text-ink disabled:opacity-60"
        >
          {uploading ? 'Feltöltés…' : 'Kép feltöltése'}
        </motion.button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
      <input
        value={block.alt}
        onChange={(e) => onChange({ alt: e.target.value })}
        placeholder="Alternatív szöveg (alt)"
        className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      />
      <input
        value={block.link ?? ''}
        onChange={(e) => onChange({ link: e.target.value })}
        placeholder="Link a képre kattintva (opcionális)"
        className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      />
    </div>
  )
}

/** Egy oszlop-cella szerkesztője — üresen 3 típus közül lehet választani (Szöveg/Kép/Gomb),
 *  utána a választott típus szerkesztő-felülete jelenik meg, egy "ürítés" gombbal visszaváltva
 *  üres állapotba. */
function ColumnCellEditor({ cell, cellIndex, onChange, onFocus }: { cell: ColumnCell; cellIndex: number; onChange: (next: ColumnCell) => void; onFocus: () => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      onChange({ type: 'image', url: json.doc.url, alt: '' })
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(false)
    }
  }

  if (cell.type === 'empty') {
    return (
      <div className="flex h-9 items-center justify-center gap-1">
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ type: 'text', html: '' })}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink"
          title="Szöveg"
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </motion.button>
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
          title="Kép"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </motion.button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
        <motion.button
          type="button"
          variants={buttonHover}
          initial="rest"
          whileHover="hover"
          whileTap="hover"
          onClick={() => onChange({ type: 'button', label: 'Gomb', url: '' })}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-soft2 transition-colors hover:bg-paper hover:text-ink"
          title="Gomb"
        >
          <RectangleHorizontal className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5" onClick={onFocus}>
      <div className="flex justify-end">
        <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={(e) => { e.stopPropagation(); onChange({ type: 'empty' }) }} className="text-ink-soft2 transition-colors hover:text-[#C0392B]" title="Cella ürítése">
          <Trash2 className="h-3.5 w-3.5" />
        </motion.button>
      </div>
      {cell.type === 'text' && (
        <EditableBlock type="text" html={cell.html} align={cell.align} color={cell.color} bg={cell.bg} cellIndex={cellIndex} onInput={(html) => onChange({ ...cell, html })} />
      )}
      {cell.type === 'image' && (
        cell.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cell.url} alt={cell.alt} className="w-full rounded-[8px]" />
        ) : (
          <>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex h-16 w-full items-center justify-center rounded-[8px] border border-dashed border-line-strong text-[12px] text-ink-soft2 hover:border-gold/60 hover:text-ink disabled:opacity-60">
              {uploading ? 'Feltöltés…' : 'Kép feltöltése'}
            </motion.button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = '' }} />
          </>
        )
      )}
      {cell.type === 'button' && (
        <div className="space-y-1.5">
          <input value={cell.label} onChange={(e) => onChange({ ...cell, label: e.target.value })} placeholder="Gomb szövege" className="block h-8 w-full rounded-[8px] border border-line-strong bg-white px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60" />
          <input value={cell.url} onChange={(e) => onChange({ ...cell, url: e.target.value })} placeholder="https://…" className="block h-8 w-full rounded-[8px] border border-line-strong bg-white px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60" />
        </div>
      )}
    </div>
  )
}

/** Egy blokk-sor — `Reorder.Item`-ként, saját `dragControls`-szal, hogy CSAK a bal szélen lévő
 *  fogópont indítson húzást (`dragListener={false}`), ne az egész blokk (ami elvinné a
 *  contentEditable-ök normál kattintás/szövegkijelölés viselkedését). */
function BlockRow({
  block: b,
  isFocused,
  focusedCellIndex,
  onFocusBlock,
  onFocusCell,
  remove,
  patch,
  updateHtml,
  updateButton,
}: {
  block: ComposerBlock
  isFocused: boolean
  focusedCellIndex: number | null
  onFocusBlock: () => void
  onFocusCell: (index: number) => void
  remove: (id: string) => void
  patch: (id: string, fn: (b: ComposerBlock) => ComposerBlock) => void
  updateHtml: (id: string, html: string) => void
  updateButton: (id: string, field: 'label' | 'url', value: string) => void
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="div"
      value={b}
      dragListener={false}
      dragControls={dragControls}
      data-block-id={b.id}
      onFocusCapture={onFocusBlock}
      onClick={onFocusBlock}
      className={cn('group relative rounded-[10px] px-2 py-1.5 transition-colors hover:bg-paper/70', isFocused && 'bg-paper/50')}
    >
      {/* Húzó fogópont a bal szélen, függőlegesen középen — csak a pöttyök, nincs kör/keret
          körülötte (mindig látható, nem hoverre jelenik meg). */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="absolute left-1 top-1/2 z-10 flex h-6 w-4 -translate-y-1/2 cursor-grab items-center justify-center text-ink-soft2 active:cursor-grabbing"
        title="Húzd az átrendezéshez"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <motion.button
        type="button"
        variants={buttonHover}
        initial="rest"
        whileHover="hover"
        whileTap="hover"
        onClick={() => remove(b.id)}
        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-white text-ink-soft shadow-[0_1px_4px_rgba(0,0,0,.12)] hover:text-[#C0392B]"
        title="Blokk törlése"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </motion.button>

      {b.type === 'divider' ? (
        <hr className="my-3 border-t border-line" />
      ) : b.type === 'button' ? (
        <div className="space-y-2 py-1.5 pl-6">
          <div className="mb-1 flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onClick={() => patch(b.id, (x) => (x.type === 'button' ? { ...x, align: a } : x))}
                className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (b.align ?? 'left') === a && 'bg-paper text-ink')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
              </motion.button>
            ))}
          </div>
          <input
            value={b.label}
            onChange={(e) => updateButton(b.id, 'label', e.target.value)}
            placeholder="Gomb szövege"
            className="inline-flex h-9 items-center rounded-full bg-ink-dark px-4 text-[13px] font-semibold text-white outline-none placeholder:text-white/50"
          />
          <input
            value={b.url}
            onChange={(e) => updateButton(b.id, 'url', e.target.value)}
            placeholder="https://…"
            className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
        </div>
      ) : b.type === 'image' ? (
        <div className="pl-6">
          <ImageBlockEditor block={b} onChange={(p) => patch(b.id, (x) => (x.type === 'image' ? { ...x, ...p } : x))} />
        </div>
      ) : b.type === 'section' ? (
        <div className="space-y-1.5 py-1.5 pl-6">
          <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink" title="Háttérszín">
            <Paintbrush className="h-3 w-3" />
            <input
              type="color"
              value={b.bg ?? '#F7F5F0'}
              onChange={(e) => patch(b.id, (x) => (x.type === 'section' ? { ...x, bg: e.target.value } : x))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <div style={{ background: b.bg ?? '#F7F5F0', borderRadius: 10, padding: 14 }}>
            <EditableBlock type="text" html={b.html} autoFocus={isFocused} onInput={(html) => updateHtml(b.id, html)} />
          </div>
        </div>
      ) : b.type === 'columns' ? (
        // A cellák a sorban lévő legmagasabb testvérhez igazodnak (böngésző-alapértelmezett grid
        // `align-items: stretch`), hogy a sor mindig egyenletes/rendezett maradjon. Ha egy cella
        // tartalma (pl. üres állapot ikon-sora, vagy egy rövid "közösségi link" szerkesztő)
        // rövidebb, mint a sor legmagasabb testvére, a `flex justify-center` FÜGGŐLEGESEN
        // KÖZÉPRE igazítja a stretchelt dobozon belül — így nem egy csúnya, tetejére tapadt,
        // alul üresen lógó dobozként hat, hanem szándékosan középre rendezettként. A `layout`
        // propon keresztül a méretváltás (üres → kitöltött állapot) framer-motion-nal simán
        // animálódik — ekkor a TÖBBI cella is vele animálva nő/csökken, mert a sor egy közös
        // magasságra igazodik.
        <div className="grid gap-2 py-1.5 pl-6" style={{ gridTemplateColumns: `repeat(${b.cols.length}, minmax(0,1fr))` }}>
          {b.cols.map((c, i) => (
            <motion.div
              key={i}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className={cn(
                'flex flex-col justify-center rounded-[10px] border border-dashed p-2 transition-colors',
                focusedCellIndex === i ? 'border-gold bg-gold/5' : 'border-line-strong',
              )}
            >
              <ColumnCellEditor
                cell={c}
                cellIndex={i}
                onFocus={() => onFocusCell(i)}
                onChange={(next) => patch(b.id, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === i ? next : cc)) } : x))}
              />
            </motion.div>
          ))}
        </div>
      ) : b.type === 'social_links' ? (
        <div className="space-y-2 pb-1.5 pl-6 pt-6">
          <div className="mb-1 flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, align: a } : x))}
                className={cn('flex h-6 w-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink', (b.align ?? 'center') === a && 'bg-paper text-ink')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
              </motion.button>
            ))}
          </div>
          {b.links.map((l, i) => {
            const platform = detectPlatform(l.url)
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex h-10 flex-1 items-center gap-2 rounded-[10px] border border-line-strong bg-white pl-1.5 pr-3 focus-within:ring-2 focus-within:ring-gold/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={socialIconDataUri(platform)} alt={SOCIAL_LABELS[platform]} className="h-7 w-7 shrink-0 rounded-full" />
                  <input
                    value={l.url}
                    onChange={(e) => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: x.links.map((ll, li) => (li === i ? { ...ll, url: e.target.value } : ll)) } : x))}
                    placeholder="https://instagram.com/felhasznalonev"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
                  />
                </div>
                <motion.button
                  type="button"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  whileTap="hover"
                  onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: x.links.filter((_, li) => li !== i) } : x))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 transition-colors hover:text-[#C0392B]"
                  title="Link törlése"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => patch(b.id, (x) => (x.type === 'social_links' ? { ...x, links: [...x.links, { url: '' }] } : x))}
            className="text-[12px] font-semibold text-ink-soft hover:text-ink"
          >
            + Link hozzáadása
          </button>
        </div>
      ) : b.type === 'html' ? (
        <textarea
          value={b.code}
          onChange={(e) => patch(b.id, (x) => (x.type === 'html' ? { ...x, code: e.target.value } : x))}
          placeholder="<div>Egyedi HTML…</div>"
          rows={4}
          className="w-full resize-y rounded-[10px] border border-line-strong bg-white py-2 pl-6 pr-3 font-mono text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      ) : b.type === 'code' ? (
        <input
          value={b.code}
          onChange={(e) => patch(b.id, (x) => (x.type === 'code' ? { ...x, code: e.target.value } : x))}
          placeholder="pl. KEDVEZMENY20"
          className="block h-9 w-full max-w-[320px] rounded-[10px] border border-line-strong bg-white py-0 pl-6 pr-3 font-mono text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        />
      ) : (
        <div className="pl-6">
          <EditableBlock type={b.type} html={b.html} align={b.align} bg={b.bg} color={b.color} fontSize={b.fontSize} lineHeight={b.lineHeight} autoFocus={isFocused} onInput={(html) => updateHtml(b.id, html)} />
        </div>
      )}
    </Reorder.Item>
  )
}

export function NewsletterBlockEditor({ blocks, onChange }: { blocks: ComposerBlock[]; onChange: (b: ComposerBlock[]) => void }) {
  const [openMenu, setOpenMenu] = useState<'text' | 'image' | 'layout' | 'format' | null>(null)
  // Melyik blokkot szerkeszted épp — a bal sínből beszúrt új blokk EMÖGÉ kerül, nem mindig a
  // lista végére (mint egy Notion-szerű szerkesztőben: oda kerül, ahol éppen dolgozol).
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Melyik oszlop-CELLA van fókuszban — ha ez be van állítva, a bal sínből választott elem NEM
  // új top-level blokkot szúr be, hanem ebbe a cellába kerül (ez helyettesíti a korábbi,
  // cellánként háromszor ismételt Szöveg/Kép/Gomb választó-gombokat, ami 4 oszlopnál kilátszott
  // a képernyőből — most a MEGLÉVŐ bal sáv szolgál választóként, ahogy a canvas többi részén is).
  const [focusedCell, setFocusedCell] = useState<{ blockId: string; index: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Szöveg-kijelöléskor lebegő "bubble" eszköztár jelenik meg a kijelölés fölött (mint a
  // referencia-szerkesztőben) — típus-váltó legördülő + igazítás + inline formázás.
  const [bubble, setBubble] = useState<{ top: number; left: number; blockId: string; cellIndex?: number } | null>(null)
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !containerRef.current) { setBubble(null); return }
      const range = sel.getRangeAt(0)
      if (!containerRef.current.contains(range.commonAncestorContainer)) { setBubble(null); return }
      // Oszlop-cellák tartalma UGYANAZT a `data-block-id`-t örökli (az egész oszlop-blokk sora
      // hordozza), de a cella saját contentEditable-jén van egy `data-cell-index` is — ez teszi
      // lehetővé, hogy a bubble a KONKRÉT cellára célozzon, ne a teljes oszlop-blokkra (aminek
      // típusa 'columns', tehát önmagában sose "szöveg-szerű").
      let node: Node | null = range.commonAncestorContainer
      let blockId: string | null = null
      let cellIndex: number | undefined
      while (node) {
        if (node instanceof HTMLElement) {
          if (cellIndex === undefined && node.dataset.cellIndex !== undefined) cellIndex = Number(node.dataset.cellIndex)
          if (node.dataset.blockId) { blockId = node.dataset.blockId; break }
        }
        node = node.parentNode
      }
      if (!blockId) { setBubble(null); return }
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) { setBubble(null); return }
      setBubble({ top: rect.top, left: rect.left + rect.width / 2, blockId, cellIndex })
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  // A bal sáv MINDIG a szokásos top-level beszúrást végzi, akkor is, ha épp egy oszlop-cella van
  // fókuszban — a cellák saját, helyi ikon-sorral (Szöveg/Kép/Gomb/Közösségi) kapnak tartalmat,
  // nem a sávból. (Korábban a sáv a fókuszált cellába routolt, ami zavaró volt: ha valaki egy
  // cellára kattintott, majd a sávból Képet/YouTube-ot választott top-level beszúrás szándékkal,
  // az véletlenül a cellába szúrt be.)
  const insert = (item: RailItem) => {
    const block = newBlock(item.type, { cols: item.cols, kind: item.kind })
    const idx = focusedId ? blocks.findIndex((b) => b.id === focusedId) : -1
    if (idx === -1) onChange([...blocks, block])
    else onChange([...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)])
    setFocusedId(block.id)
    setFocusedCell(null)
    setOpenMenu(null)
  }
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const patch = (id: string, fn: (b: ComposerBlock) => ComposerBlock) => onChange(blocks.map((b) => (b.id === id ? fn(b) : b)))
  const updateHtml = (id: string, html: string) =>
    onChange(blocks.map((b) => (b.id === id && b.type !== 'button' && b.type !== 'divider' && b.type !== 'image' && b.type !== 'columns' && b.type !== 'social_links' && b.type !== 'html' && b.type !== 'code' ? { ...b, html } : b)))
  const updateButton = (id: string, field: 'label' | 'url', value: string) =>
    onChange(blocks.map((b) => (b.id === id && b.type === 'button' ? { ...b, [field]: value } : b)))
  const updateType = (id: string, type: typeof TEXT_TYPE_OPTIONS[number]) =>
    onChange(blocks.map((b) => (b.id === id && b.type !== 'button' && b.type !== 'divider' && b.type !== 'image' && b.type !== 'section' && b.type !== 'columns' && b.type !== 'social_links' && b.type !== 'html' && b.type !== 'code' ? { ...b, type } : b)))
  // FONTOS: a `'align' in x` / `'bg' in x` futásidejű ellenőrzés HAMIS egy friss blokkon, mert
  // ott a mező szó szerint nincs jelen (csak `align?`/`bg?`, sose lett még beállítva) — emiatt
  // korábban a formázás-gombok némán nem csináltak semmit. A TÍPUS alapján kell eldönteni, nem a
  // property jelenléte alapján (a cast biztonságos, mert a listák pontosan a union tagjait
  // sorolják fel, amiken az adott mező ténylegesen létezik).
  const setAlign = (id: string, a: TextAlign) => patch(id, (x) => (ALIGN_TYPES.includes(x.type) ? { ...x, align: a } as ComposerBlock : x))
  const setBg = (id: string, bg: string | null) => patch(id, (x) => (BG_TYPES.includes(x.type) ? { ...x, bg } as ComposerBlock : x))
  const setColor = (id: string, color: string | null) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, color } as ComposerBlock : x))
  const setFontSize = (id: string, fontSize: number | undefined) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, fontSize } as ComposerBlock : x))
  const setLineHeight = (id: string, lineHeight: number | undefined) => patch(id, (x) => (TEXT_STYLE_TYPES.includes(x.type) ? { ...x, lineHeight } as ComposerBlock : x))
  /** Ugyanez oszlop-cella szöveg-tartalmára — a `columns` blokk `cols` tömbjének adott elemét
   *  frissíti, nem a blokkot magát (a blokk típusa `'columns'` marad). */
  const setCellAlign = (blockId: string, cellIndex: number, a: TextAlign) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, align: a } : cc)) } : x))
  const setCellColor = (blockId: string, cellIndex: number, color: string | null) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, color } : cc)) } : x))
  const setCellBg = (blockId: string, cellIndex: number, bg: string | null) =>
    patch(blockId, (x) => (x.type === 'columns' ? { ...x, cols: x.cols.map((cc, ci) => (ci === cellIndex && cc.type === 'text' ? { ...cc, bg } : cc)) } : x))

  const exec = (cmd: string) => document.execCommand(cmd, false)

  const focusedBlock = blocks.find((b) => b.id === focusedId)
  const setFocusedAlign = (a: TextAlign) => { if (focusedId) setAlign(focusedId, a) }
  const setFocusedBg = (bg: string | null) => { if (focusedId) setBg(focusedId, bg) }
  const setFocusedColor = (c: string | null) => { if (focusedId) setColor(focusedId, c) }
  const setFocusedFontSize = (n: number | undefined) => { if (focusedId) setFontSize(focusedId, n) }
  const setFocusedLineHeight = (n: number | undefined) => { if (focusedId) setLineHeight(focusedId, n) }

  // A "Formázás" sín-panel a fókuszált BLOKKOT szerkeszti — DE ha épp egy oszlop-cella van
  // fókuszban (`focusedCell`), a cella szöveg-tartalmát kell célozni, nem a körülötte lévő
  // `columns` blokkot (aminek önmagában nincs se igazítása, se színe). Ugyanaz a panel, más cél.
  const focusedCellData = focusedCell
    ? (() => {
        const parent = blocks.find((b) => b.id === focusedCell.blockId)
        const cell = parent?.type === 'columns' ? parent.cols[focusedCell.index] : null
        return cell?.type === 'text' ? cell : null
      })()
    : null
  const formatTarget = focusedCell
    ? {
        hasTarget: !!focusedCellData,
        supportsAlign: !!focusedCellData,
        supportsBg: !!focusedCellData,
        supportsColor: !!focusedCellData,
        supportsSize: false,
        currentAlign: (focusedCellData?.align || 'left') as TextAlign,
        currentBg: focusedCellData?.bg ?? null,
        currentColor: focusedCellData?.color ?? null,
        currentFontSize: undefined as number | undefined,
        currentLineHeight: undefined as number | undefined,
        onAlign: (a: TextAlign) => setCellAlign(focusedCell.blockId, focusedCell.index, a),
        onBg: (bg: string | null) => setCellBg(focusedCell.blockId, focusedCell.index, bg),
        onColor: (c: string | null) => setCellColor(focusedCell.blockId, focusedCell.index, c),
        onFontSize: () => {},
        onLineHeight: () => {},
      }
    : {
        hasTarget: !!focusedBlock,
        supportsAlign: !!focusedBlock && ALIGN_TYPES.includes(focusedBlock.type),
        supportsBg: !!focusedBlock && BG_TYPES.includes(focusedBlock.type),
        supportsColor: !!focusedBlock && TEXT_STYLE_TYPES.includes(focusedBlock.type),
        supportsSize: !!focusedBlock && TEXT_STYLE_TYPES.includes(focusedBlock.type),
        currentAlign: ((focusedBlock && 'align' in focusedBlock && focusedBlock.align) || 'left') as TextAlign,
        currentBg: (focusedBlock && 'bg' in focusedBlock ? focusedBlock.bg : null) ?? null,
        currentColor: (focusedBlock && 'color' in focusedBlock ? focusedBlock.color : null) ?? null,
        currentFontSize: focusedBlock && 'fontSize' in focusedBlock ? focusedBlock.fontSize : undefined,
        currentLineHeight: focusedBlock && 'lineHeight' in focusedBlock ? focusedBlock.lineHeight : undefined,
        onAlign: setFocusedAlign,
        onBg: setFocusedBg,
        onColor: setFocusedColor,
        onFontSize: setFocusedFontSize,
        onLineHeight: setFocusedLineHeight,
      }

  return (
    <div className="flex min-h-[520px] gap-3">
      {/* Lebegő fekete ikon-sín — desktopon (`lg:`) `absolute`-ba vált, ami a legközelebbi
          POZICIONÁLT ősre (a szélesebb kártyára, ld. NewsletterManager `composerRef` `relative`
          osztálya) tapad, NEM erre a keskeny tartalom-oszlopra — így pont a kártya saját
          `px-6 sm:px-8` szegélyéhez igazodik. Ehhez ennek a konténernek NEM szabad `relative`-nek
          lennie. (Egy scroll-követő `sticky` verzió próbaként megvolt, de nem sikerült
          megbízhatóan élesíteni — visszaállítva erre, a korábban működő állapotra.) */}
      <div className="sticky top-1/2 z-30 flex h-fit shrink-0 -translate-y-1/2 flex-col gap-1 rounded-full bg-ink-dark p-1.5 lg:absolute lg:left-8">
        {RAIL_GROUPS.map((g) => (
          <div key={g.key} className="relative">
            <motion.button
              type="button"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              whileTap="hover"
              onClick={() => setOpenMenu((m) => (m === g.key ? null : g.key))}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors', openMenu === g.key ? 'bg-white/15' : 'hover:bg-white/10')}
              title={g.title}
            >
              <g.icon className="h-4 w-4" strokeWidth={1.8} />
            </motion.button>
            <AnimatePresence>
              {openMenu === g.key && <RailFlyout items={g.items} onPick={insert} align={g.key === 'layout' ? 'bottom' : 'top'} />}
            </AnimatePresence>
          </div>
        ))}
        <div className="relative">
          <motion.button
            type="button"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            onClick={() => setOpenMenu((m) => (m === 'format' ? null : 'format'))}
            className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors', openMenu === 'format' ? 'bg-white/15' : 'hover:bg-white/10')}
            title="Formázás"
          >
            <AlignLeft className="h-4 w-4" strokeWidth={1.8} />
          </motion.button>
          <AnimatePresence>
            {openMenu === 'format' && <FormatFlyout {...formatTarget} align="bottom" />}
          </AnimatePresence>
        </div>
      </div>

      {openMenu && <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />}

      {/* A blokkok — húzható-átrendezhető lista (`Reorder`), a fogópont a `BlockRow` bal
          szélén indítja a húzást. */}
      <Reorder.Group as="div" axis="y" values={blocks} onReorder={onChange} ref={containerRef} className="min-w-0 flex-1 space-y-1">
        {blocks.length === 0 && (
          <p className="py-6 text-center text-[13px] text-ink-soft2">Adj hozzá egy blokkot a bal oldali menüből…</p>
        )}
        {blocks.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            isFocused={focusedId === b.id}
            focusedCellIndex={focusedCell?.blockId === b.id ? focusedCell.index : null}
            onFocusBlock={() => { setFocusedId(b.id); if (b.type !== 'columns') setFocusedCell(null) }}
            onFocusCell={(index) => { setFocusedCell({ blockId: b.id, index }); setFocusedId(b.id) }}
            remove={remove}
            patch={patch}
            updateHtml={updateHtml}
            updateButton={updateButton}
          />
        ))}
      </Reorder.Group>

      {/* Kijelölés-eszköztár — szöveget kijelölve/duplán kattintva jelenik meg fölötte, mint a
          referenciában: típus-váltó + igazítás + inline formázás. */}
      {bubble && (() => {
        const block = blocks.find((b) => b.id === bubble.blockId)
        if (!block) return null
        // Oszlop-cella szövege: a blokk maga `'columns'` típusú (nem szöveg-szerű), a TÉNYLEGES
        // kijelölt tartalom a `bubble.cellIndex`-edik cellában van — külön ágon kezeljük, mert a
        // cellának nincs típus-váltója (nem `title`/`heading` stb.), csak igazítás+inline formázás.
        const isCell = block.type === 'columns' && bubble.cellIndex !== undefined
        const cell = isCell ? (block as Extract<ComposerBlock, { type: 'columns' }>).cols[bubble.cellIndex!] : null
        if (isCell && (!cell || cell.type !== 'text')) return null
        if (!isCell && !TEXT_TYPE_OPTIONS.includes(block.type as typeof TEXT_TYPE_OPTIONS[number])) return null
        const currentAlign: TextAlign = isCell
          ? (cell as Extract<ColumnCell, { type: 'text' }>).align || 'left'
          : ('align' in block && block.align) || 'left'
        const applyAlign = (a: TextAlign) => (isCell ? setCellAlign(block.id, bubble.cellIndex!, a) : setAlign(block.id, a))
        return (
          <div
            className="fixed z-40 flex items-center gap-1 rounded-2xl bg-ink-dark p-1.5 shadow-[0_18px_42px_-16px_rgba(0,0,0,.5)]"
            style={{ top: bubble.top, left: bubble.left, transform: 'translate(-50%, calc(-100% - 8px))' }}
          >
            {!isCell && (
              <>
                <div className="relative">
                  <select
                    value={block.type}
                    onChange={(e) => updateType(block.id, e.target.value as typeof TEXT_TYPE_OPTIONS[number])}
                    className="cursor-pointer appearance-none rounded-[10px] bg-white/10 py-1.5 pl-3 pr-7 text-[12.5px] font-medium text-white outline-none"
                  >
                    {TEXT_TYPE_OPTIONS.map((t) => <option key={t} value={t} className="text-ink">{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <span className="mx-0.5 h-4 w-px bg-white/20" />
              </>
            )}
            {(['left', 'center', 'right'] as const).map((a) => (
              <motion.button
                key={a}
                type="button"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                whileTap="hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyAlign(a)}
                className={cn('flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white', currentAlign === a && 'bg-white/15 text-white')}
                title={a === 'left' ? 'Balra' : a === 'center' ? 'Középre' : 'Jobbra'}
              >
                {a === 'left' ? <AlignLeft className="h-3.5 w-3.5" /> : a === 'center' ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}
              </motion.button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => { const url = window.prompt('Link URL-je:'); if (url) document.execCommand('createLink', false, url) }} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Link"><Link2 className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Félkövér"><Bold className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Dőlt"><Italic className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Aláhúzott"><Underline className="h-3.5 w-3.5" /></motion.button>
            <motion.button type="button" variants={buttonHover} initial="rest" whileHover="hover" whileTap="hover" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white/70 transition-colors hover:bg-white/10 hover:text-white" title="Áthúzott"><Strikethrough className="h-3.5 w-3.5" /></motion.button>
          </div>
        )
      })()}
    </div>
  )
}
