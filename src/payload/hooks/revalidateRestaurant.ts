import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * Invalidálja az étterem dashboard szerver-oldalait, ha egy foglalás megváltozik
 * (létrejön/módosul/törlődik) – akár a vendég a publikus oldalon, akár az admin.
 * Enélkül a Next a régi (cache-elt) oldalt szolgálná ki szerver-újraindításig.
 */
function revalidateRestaurantPages() {
  revalidatePath('/restaurant')
  revalidatePath('/restaurant/bookings')
  revalidatePath('/restaurant/analytics')
}

export const revalidateOnReservationChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateRestaurantPages()
  return doc
}

export const revalidateOnReservationDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateRestaurantPages()
  return doc
}
