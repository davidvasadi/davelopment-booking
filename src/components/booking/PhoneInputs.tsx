'use client'

import dynamic from 'next/dynamic'

/**
 * A telefon-mezők késleltetett betöltéssel (sebesség, docs/audit/2026-11-05_1921): a mező a telefonszám-ellenőrzővel
 * (libphonenumber) és a zászlókkal ~90 KB — csak akkor töltődik be, amikor egy telefon-mező tényleg megjelenik
 * (foglalás adatai lépés, új foglalás, vendég szerkesztése), nem minden oldalon. Addig egy mező-alakú helykitöltő áll.
 * Az országlista (COUNTRIES) azonnal kell — azt a `phoneCountries` adja, nem ez.
 */
const Placeholder = () => <div aria-hidden className="h-11 w-full animate-pulse rounded-ui-control bg-ui-cell/60" />

export const PhoneCountryInput = dynamic(() => import('./PhoneCountryInput').then((m) => m.PhoneCountryInput), { ssr: false, loading: Placeholder })
export const PhoneInput = dynamic(() => import('./PhoneCountryInput').then((m) => m.PhoneInput), { ssr: false, loading: Placeholder })
