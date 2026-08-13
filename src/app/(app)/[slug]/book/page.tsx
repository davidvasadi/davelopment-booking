import { redirect } from 'next/navigation'

// A foglaló-varázsló összevonva a canonical /[slug] profiloldalba — ez a route mostantól
// csak egy megőrzött (bookmarkolt/megosztott) régi link átirányítására szolgál.
export default async function BookRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()
  redirect(`/${slug}${qs ? `?${qs}` : ''}`)
}
