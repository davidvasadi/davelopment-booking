import { redirect } from 'next/navigation'

/** Jelszó már nincs (belépés e-mailes kóddal vagy Google-lel, design 3.1) — a régi linkek a belépésre visznek. */
export default function Page() {
  redirect('/login')
}
