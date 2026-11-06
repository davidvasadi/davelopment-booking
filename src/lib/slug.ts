/** Név → URL-barát azonosító (ékezet nélkül, kötőjellel): a foglalóoldal címe (`booking.davelopment.hu/<slug>`). */
export const slugify = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
