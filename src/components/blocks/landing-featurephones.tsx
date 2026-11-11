'use client'

/* A funkció-oldalak telefonjai: a valódi appból lefotózott mobil képernyők iPhone-keretben (átlátszó háttérrel,
   public/landing/funkciok/mobil/<slug>-davelopment-booking.webp, 900×1840) — a fülekben, a „Kinek” és az „Így indulsz el”
   blokkban is. Új funkcióhoz: kép a mappába + a slug ide. */
const REAL_SHOTS = ['ajandekutalvany', 'automatikus-szamla', 'bemutatkozo-weboldal', 'beosztas', 'berezes', 'elo-asztalallapot', 'eloleg', 'emlekeztetok', 'export', 'feketelista', 'google-cegprofil', 'google-ertekeles', 'gyors-felvetel', 'hirlevel', 'jogosultsagok', 'jovahagyas', 'mobil-app', 'munkaido', 'munkatarsak', 'offline-mod', 'qr-kod', 'statisztikak', 'szabadsag', 'szamlak', 'vendeg-terkep', 'vendegkartya']
export const FEATURE_PHONES: Record<string, React.ReactNode> = {}
for (const slug of REAL_SHOTS) {
  // eslint-disable-next-line @next/next/no-img-element
  FEATURE_PHONES[slug] = <img src={`/landing/funkciok/mobil/${slug}-davelopment-booking.webp`} alt="" width={900} height={1840} loading="lazy" decoding="async" className="block h-auto w-full" />
}

/** A fül-gombok egy szavas felirata (a kiválasztott fülön a cím rövid változata jelenik meg). */
export const TAB_WORD: Record<string, string> = {
  'elo-asztalallapot': 'Asztalok', 'gyors-felvetel': 'Kitöltés', 'offline-mod': 'Offline', 'bemutatkozo-weboldal': 'Weboldal', emlekeztetok: 'Emlékeztetők', jovahagyas: 'Jóváhagyás',
  beosztas: 'Beosztás', szabadsag: 'Szabadság', munkaido: 'Munkaidő', berezes: 'Bérezés',
  vendegkartya: 'Vendégkártya', feketelista: 'Feketelista', 'vendeg-terkep': 'Térkép', export: 'Export',
  eloleg: 'Előleg', ajandekutalvany: 'Utalvány', 'automatikus-szamla': 'Számla', szamlak: 'Számlák',
  hirlevel: 'Hírlevél', 'google-ertekeles': 'Értékelés', 'google-cegprofil': 'Cégprofil', 'qr-kod': 'QR-kód',
  munkatarsak: 'Munkatársak', jogosultsagok: 'Jogok', statisztikak: 'Statisztika', 'mobil-app': 'App',
}

/** Belső áttekintő (mock-shot): mind a 26 telefon egy lapon. */
export function FeaturePhonesSheet() {
  return (
    <div data-cover className="grid grid-cols-7 gap-4 bg-white p-4">
      {Object.entries(FEATURE_PHONES).map(([k, v]) => <div key={k} className="w-[240px]"><div className="mb-1 text-[11px]">{k}</div>{v}</div>)}
    </div>
  )
}
