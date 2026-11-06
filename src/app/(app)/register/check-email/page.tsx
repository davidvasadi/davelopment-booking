import { redirect } from 'next/navigation'

/** A regisztráció már kóddal erősíti meg az e-mailt (design 3.3) — a régi „nézd meg a postafiókod” oldal a belépésre visz. */
export default function Page() {
  redirect('/login')
}
