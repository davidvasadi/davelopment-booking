/**
 * GET /api/auth/complete-registration
 *
 * A Google-OAuth flow callbackUrl-je ide mutat (a regisztrációs wizardből indított ágon).
 * Lefutott a `signIn` callback (auth.ts), ami létrehozta vagy megtalálta a Payload usert
 * és kiállította a payload-token cookie-t. Most:
 *
 *  1. Kiolvassuk a pending-registration cookie-t (cégadatok).
 *  2. Megkeressük a belépett usert (payload-token alapján).
 *  3. Frissítjük a role-t (salon_owner / restaurant_owner) és az ownerName-t.
 *  4. Létrehozzuk a szalont/éttermet és a userhez kapcsoljuk.
 *  5. Töröljük a pending cookie-t.
 *  6. Redirect a megfelelő dashboardra.
 *
 * Edge-case:
 *  - Ha nincs pending cookie (pl. a user közvetlenül a /login Google-gombbal jött),
 *    akkor csak `/` -re irányítunk. Az auth.ts már gondoskodott a userről.
 *  - Ha a user már létezik és van place-e, NEM csinálunk újat — csak `/`-ra megy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { readPendingRegistration, clearPendingRegistration } from '@/lib/pendingRegistration'

export async function GET(_req: NextRequest) {
  // Publikus origin a redirectekhez (nginx-proxy mögött a _req.url localhost lenne).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || _req.url
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL('/login?error=session', baseUrl))

  const pending = await readPendingRegistration()
  if (!pending) {
    // Nincs függő regisztráció → ez egy sima Google-login volt. Mehet a dashboardba.
    return NextResponse.redirect(new URL('/', baseUrl))
  }

  const payload = await getPayloadClient()

  try {
    // 1. User adatok frissítése (role + név), CSAK ha a user még nem rendelkezik place-szel.
    //    (Védelem: meglévő, beállított usernél ne írjuk át a role-ját pending cookie-ból.)
    const alreadyHasPlace =
      (user.role === 'salon_owner' && user.salon) ||
      (user.role === 'restaurant_owner' && user.restaurant)

    if (!alreadyHasPlace) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { role: pending.role, name: pending.ownerName || user.name },
        overrideAccess: true,
      })

      // 2. Place létrehozása + userhez kapcsolás
      if (pending.role === 'salon_owner') {
        const salon = await payload.create({
          collection: 'salons',
          data: {
            name: pending.placeName,
            owner: user.id,
            ...(pending.city ? { city: pending.city } : {}),
            ...(pending.phone ? { phone: pending.phone } : {}),
          },
          overrideAccess: true,
        })
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { salon: salon.id },
          overrideAccess: true,
        })
      } else {
        const restaurant = await payload.create({
          collection: 'restaurants',
          data: {
            name: pending.placeName,
            owner: user.id,
            ...(pending.city ? { city: pending.city } : {}),
            ...(pending.phone ? { phone: pending.phone } : {}),
          },
          overrideAccess: true,
        })
        await payload.update({
          collection: 'users',
          id: user.id,
          data: { restaurant: restaurant.id },
          overrideAccess: true,
        })
      }
    }
  } catch (e) {
    console.error('[complete-registration] hiba:', e)
    // Nem dobunk hibát a usernek — a user már be van jelentkezve, csak a cégadatokat
    // nem tudtuk eltenni. Beállításoknál tudja kézzel pótolni.
  } finally {
    await clearPendingRegistration()
  }

  // 3. Redirect a megfelelő dashboardra
  const dest = pending.role === 'restaurant_owner' ? '/restaurant' : '/dashboard'
  return NextResponse.redirect(new URL(dest, baseUrl))
}
