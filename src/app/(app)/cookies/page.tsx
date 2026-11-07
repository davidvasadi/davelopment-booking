import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/landing/LegalPage'

export const metadata: Metadata = {
  title: 'Sütikezelés',
  description: 'Tájékoztató a davelopment booking által használt sütikről (cookie-król) és a foglalóoldalak méréséről.',
  robots: { index: false, follow: true },
}

const S = ({ children }: { children: React.ReactNode }) => <strong className="text-brand-ink">{children}</strong>
const C = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.9em]">{children}</code>

/** Egy süti / tárolt adat: név, ki teszi le, mire, meddig. */
function Item({ name, who, what, ttl }: { name: React.ReactNode; who: string; what: string; ttl: string }) {
  return (
    <li>
      <C>{name}</C> — {what} <span className="text-brand-ink/60">Elhelyezi: {who}. Időtartam: {ttl}.</span>
    </li>
  )
}

export default function CookiesPage() {
  return (
    <LegalPage title="Sütikezelési tájékoztató" updated="2026. november 6.">
      <p>
        A davelopment booking (a továbbiakban: Szolgáltató) a platform oldalain — a nyitóoldalon, a vállalkozói felületen és a
        vállalkozások nyilvános foglalóoldalain — sütiket (cookie-kat) és hasonló, a böngészőben tárolt adatokat (helyi
        tárolás, localStorage) használ. Ez a tájékoztató az Adatkezelési tájékoztató része, és leírja, milyen sütiket ki,
        milyen célból és mennyi ideig használ, valamint hogyan dönthet ezekről.
      </p>

      <LegalSection heading="1. Mi az a süti?">
        <p>
          A süti egy kis adatfájl, amelyet a böngészője az eszközén tárol. Segítségével az oldal megjegyzi például a
          bejelentkezést, a választott nyelvet vagy a sütikről hozott döntését. A helyi tárolás (localStorage) hasonló
          célra szolgál, de az adatot nem küldi el minden kéréssel a szervernek.
        </p>
      </LegalSection>

      <LegalSection heading="2. Kategóriák és jogalap">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <S>Szükséges sütik</S> — az oldal és a foglalás működéséhez nélkülözhetetlenek (bejelentkezés, biztonság, nyelv,
            a sütikről hozott döntés megjegyzése, fizetés). Ezek az elektronikus hírközlésről szóló 2003. évi C. törvény 155.
            § (4) bekezdése alapján hozzájárulás nélkül alkalmazhatók; nem kapcsolhatók ki.
          </li>
          <li>
            <S>Látogatottság mérése (statisztika)</S> — a Szolgáltató méri, hogyan használják a platformot és a
            foglalóoldalakat, hogy fejleszthesse azokat. Csak az Ön hozzájárulásával (GDPR 6. cikk (1) a)).
          </li>
          <li>
            <S>A vállalkozás saját mérése</S> — egyes vállalkozások a saját foglalóoldalukon saját mérőkódot használnak
            (Google Analytics, Meta Pixel), hogy lássák, honnan érkeznek a vendégeik, és mely hirdetéseik működnek. Csak az Ön
            hozzájárulásával, vállalkozásonként külön (lásd 4. pont).
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Az általunk használt sütik és tárolt adatok">
        <p><S>Szükséges</S></p>
        <ul className="list-disc space-y-2 pl-6">
          <Item name="payload-token" who="davelopment booking" what="a bejelentkezett munkamenet azonosítója a vállalkozói felületen." ttl="a bejelentkezés idejére, kilépéskor törlődik" />
          <Item name="dav-device" who="davelopment booking" what="a böngésző véletlen azonosítója, hogy az Aktív eszközök listájában böngészőnként egy bejelentkezés szerepeljen (biztonsági funkció)." ttl="400 nap" />
          <Item name="authjs.session-token, __Secure-authjs.session-token, authjs.csrf-token, authjs.callback-url" who="davelopment booking" what="a Google-fiókkal való belépés lebonyolítása és biztonsága." ttl="a belépés idejére" />
          <Item name="davelopment-pending-reg" who="davelopment booking" what="a félbehagyott regisztráció adatai az e-mail-cím megerősítéséig." ttl="15 perc" />
          <Item name="davelopment_active_business" who="davelopment booking" what="több üzlet esetén megjegyzi, melyik üzlet van kiválasztva." ttl="1 év" />
          <Item name="davelopment_lang" who="davelopment booking" what="a foglalóoldalon választott nyelv." ttl="1 év" />
          <Item name="dav_ref" who="davelopment booking" what="ha ajánló linkre (/r/…) kattint, megjegyzi az ajánló kódját, hogy a regisztrációnál az ajánlás érvényes legyen." ttl="60 nap" />
          <Item name="davelopment-cookie-consent, davelopment-cookie-biz (helyi tárolás)" who="davelopment booking" what="a sütikről hozott döntése (a mi mérésünkről, illetve vállalkozásonként a vállalkozás méréséről)." ttl="amíg nem törli, vagy nem módosítja" />
          <Item name="egyéb helyi tárolás (pl. felületi beállítások, bevezető állapota)" who="davelopment booking" what="kényelmi beállítások a vállalkozói felületen; nem küldjük el sehova." ttl="amíg nem törli" />
          <Item name="__stripe_mid, __stripe_sid" who="Stripe (fizetési szolgáltató)" what="csalásmegelőzés és biztonságos fizetés, csak a fizetési lépésben." ttl="1 év, illetve 30 perc" />
        </ul>

        <p className="pt-2"><S>Látogatottság mérése — csak hozzájárulással</S></p>
        <ul className="list-disc space-y-2 pl-6">
          <Item name="_ga, _ga_<azonosító>" who="davelopment booking, a Google Analytics szolgáltatással (Google Ireland Ltd.)" what="megkülönbözteti a látogatókat, és összesített statisztikát készít az oldalak használatáról." ttl="2 év" />
        </ul>
        <p>
          Hozzájárulás nélkül a Google Analytics úgynevezett „Consent Mode” módban működik: sütit nem helyez el, és
          látogatói azonosítót nem tárol.
        </p>
      </LegalSection>

      <LegalSection heading="4. A vállalkozások saját mérése a foglalóoldalakon">
        <p>
          A foglalóoldal a vállalkozás (szalon, étterem, szakember) saját oldala a davelopment booking rendszerében. Ha a
          vállalkozás a beállításaiban saját Google Analytics- vagy Meta Pixel-azonosítót ad meg, az oldal a süti-beállításokban
          név szerint feltünteti a vállalkozást és az általa használt eszközöket. Ezek a mérőkódok csak akkor töltődnek be, ha
          Ön kifejezetten hozzájárult az adott vállalkozás méréséhez; a döntést vállalkozásonként külön jegyezzük meg.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <Item name="_ga, _ga_<azonosító>" who="a vállalkozás, a Google Analytics szolgáltatással" what="a vállalkozás látogatottsági statisztikája." ttl="2 év" />
          <Item name="_fbp" who="a vállalkozás, a Meta Pixel szolgáltatással (Meta Platforms Ireland Ltd.)" what="a vállalkozás hirdetéseinek mérése (honnan érkezett a látogató, történt-e foglalás)." ttl="90 nap" />
        </ul>
        <p>
          Ezeknél a méréseknél <S>az adatkezelő a vállalkozás</S>, nem a Szolgáltató: a vállalkozás dönt a mérés céljáról és
          eszközeiről, és ő felel érte. A mérés részleteiről a vállalkozás saját adatkezelési tájékoztatója ad felvilágosítást.
          A Google és a Meta az adatokat az Európai Unión kívülre (az Egyesült Államokba) is továbbíthatja; ezt az Európai
          Bizottság EU–USA adatvédelmi keretrendszerről szóló megfelelőségi határozata és a szolgáltatók szerződéses
          garanciái szabályozzák.
        </p>
      </LegalSection>

      <LegalSection heading="5. Hogyan dönthet, és hogyan vonhatja vissza?">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Az első látogatáskor az oldal alján megjelenő sávban elfogadhatja vagy elutasíthatja a nem szükséges sütiket — a
            két lehetőség egyformán egyszerű. A foglaláshoz nem kell elfogadnia semmit.
          </li>
          <li>
            A sáv „Beállítások” linkjével, illetve később a foglalóoldal alján található „Süti-beállítások” linkkel
            kategóriánként (a mi mérésünk, a vállalkozás mérése) külön is dönthet, és döntését bármikor módosíthatja vagy
            visszavonhatja. A visszavonás nem érinti a korábban, a hozzájárulás alapján végzett mérés jogszerűségét.
          </li>
          <li>
            A sütiket a böngészője beállításaiban is törölheti vagy letilthatja. A szükséges sütik letiltása esetén a
            bejelentkezés, illetve a foglalás egyes lépései nem működnek.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Egyéb harmadik felek">
        <p>
          A Google-fiókkal való belépéskor és a címek kiegészítésekor a Google, a fizetési lépésben a Stripe a saját
          oldalain, illetve beágyazott elemein keresztül saját sütiket is alkalmazhat; ezekre az adott szolgáltató saját
          süti- és adatkezelési tájékoztatója irányadó.
        </p>
      </LegalSection>

      <LegalSection heading="7. Jogai és kapcsolat">
        <p>
          A személyes adataival kapcsolatos jogairól (hozzáférés, helyesbítés, törlés, korlátozás, tiltakozás, panasz a
          Nemzeti Adatvédelmi és Információszabadság Hatóságnál — naih.hu) az Adatkezelési tájékoztatóban olvashat. A sütikkel
          kapcsolatos kérdéseivel forduljon hozzánk a{' '}
          <a href="mailto:hello@davelopment.hu" className="font-medium text-brand-ink underline underline-offset-2">
            hello@davelopment.hu
          </a>{' '}
          címen; a vállalkozások saját mérésével kapcsolatban az adott vállalkozáshoz.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
