import { redirect } from 'next/navigation'

/** A régi egyedi szalon-oldal helyett az Üzletek listája, a szalon adatlapjával megnyitva. */
export default async function SalonRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/backstage/salons?place=salon:${id}`)
}
