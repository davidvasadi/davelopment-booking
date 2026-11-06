import type { Locale } from '@/lib/i18n'

/**
 * A Marketing-sablonok (lib/marketingTemplates) szövege nyelvenként, szalonra és étteremre. A `{keresztnév}` a rendszer
 * helyőrzője (küldéskor a vendég neve) — minden nyelven ugyanígy marad. Az árak minták (Ft), betöltés után átírandók.
 */

type L3 = [string, string, string]
type Offer = [string, string, string]
export type TemplateCopy = {
  promo: { title: string; desc: string; subject: string; h: string; p: string; sub: string; list: L3; offers: [Offer, Offer]; btn: string; small: string }
  voucher: { title: string; desc: string; subject: string; h: string; p: string; list: L3; amount: string; vTitle: string; vText: string; vLabel: string; small: string }
  winback: { title: string; desc: string; subject: string; h: string; p: string; list: L3; btn: string; small: string }
  news: { title: string; desc: string; subject: string; h: string; p: string; list: L3; btn: string; small: string }
  hours: { title: string; desc: string; subject: string; h: string; p: string; list: L3; btn: string; small: string }
  /** szalon: születésnapi (szülinaposok), étterem: céges rendezvény (céges vendégek) */
  special: { title: string; desc: string; subject: string; h: string; p: string; list?: L3; btn: string; small: string }
}

const HU_SALON: TemplateCopy = {
  promo: {
    title: 'Szezonális akció', desc: 'Kedvezmény határidővel, ajánlatok árral, foglalás gomb', subject: 'Őszi megújulás −15% — csak október 31-ig',
    h: 'Új évszak, új frizura — most 15% kedvezménnyel',
    p: 'Kedves {keresztnév}! A nyári nap, a só és a klór nyomot hagy a hajon. Október 31-ig minden festésre, balayage-ra és hajújraépítő kezelésre 15% kedvezményt adunk, hogy a hajad fényesen, egészségesen lépjen be az őszbe.',
    sub: 'Mit kapsz most?', list: ['<b>−15%</b> minden festésre és balayage-ra', '<b>Ajándék hajpakolás</b> minden kezelés mellé', '<b>Személyes színtanácsadás</b>, mielőtt döntesz'],
    offers: [['Balayage + vágás', '48 000 Ft', '40 800 Ft'], ['Tőfestés + szárítás', '22 000 Ft', '18 700 Ft']], btn: 'Lefoglalom az időpontom',
    small: 'A kedvezmény az október 31-ig lefoglalt időpontokra érvényes. A délutáni időpontok fogynak a leggyorsabban — válassz most, amíg van szabad hely.',
  },
  voucher: {
    title: 'Ajándékutalvány', desc: 'Ünnepekre, születésnapra — megvásárolható utalvánnyal', subject: 'Ajándékötlet, ami biztosan bejön: egy óra csak neki',
    h: 'Ajándékozz egy órát, amit csak magára fordít',
    p: 'Kedves {keresztnév}! Nem kell tovább keresgélned: egy kényeztető kezelés nálunk mindig telitalálat — szülinapra, névnapra vagy csak úgy. Az utalványt két perc alatt megveszed online, és azonnal megérkezik e-mailben.',
    list: ['<b>Te választod az összeget</b> — a megajándékozott választ belőle', '<b>Azonnal megérkezik</b> e-mailben, továbbküldhető vagy kinyomtatható', '<b>Utolsó pillanatban is megoldás</b> — akár a buli előtt öt perccel'],
    amount: '20 000 Ft', vTitle: 'Ajándék kényeztetés', vText: 'Online megveszed, e-mailben megy.', vLabel: 'Utalványt veszek',
    small: 'Kérdésed van az utalvánnyal kapcsolatban? Válaszolj erre a levélre, és segítünk.',
  },
  winback: {
    title: 'Rég nem jártál nálunk', desc: 'Visszahívó levél ajándékkal — a 90 napja nem járt vendégeknek', subject: 'Hiányzol! Egy kis meglepetéssel várunk vissza',
    h: 'Rég láttunk, {keresztnév}!',
    p: 'Az utolsó látogatásod óta sok minden változott: új kezelések, új munkatársak — a kávé viszont ugyanolyan jó. Szeretnénk újra látni, ezért a következő időpontodhoz egy kis meglepetéssel készülünk.',
    list: ['<b>Ajándék hajpakolás</b> a következő kezelésed mellé', 'Pár kattintással foglalsz, akár éjjel is', 'Az időpontot bármikor módosíthatod vagy lemondhatod'],
    btn: 'Visszajövök — időpontot foglalok', small: 'A meglepetés a levél érkezésétől számított 30 napon belüli foglalásra érvényes.',
  },
  news: {
    title: 'Újdonság', desc: 'Új szolgáltatás vagy munkatárs bemutatása — két képpel', subject: 'Újdonság nálunk: bemutatjuk a keratinos hajújraépítést',
    h: 'Bemutatjuk: keratinos hajújraépítés',
    p: 'Kedves {keresztnév}! Ha a hajad töredezett, szálkás vagy egyszerűen fáradt, ezt neked találtuk ki. A kezelés belülről építi újra a hajszálat — az eredményt az első mosás után is érzed.',
    list: ['<b>Fényes, simítható haj</b> már az első kezeléstől', '<b>Kíméletes</b> festett és szőkített hajra is', '<b>Bevezető áron</b> a hónap végéig'],
    btn: 'Kipróbálom — időpontot foglalok', small: 'Nem tudod, neked való-e? Foglalj ingyenes konzultációt, és a helyszínen megnézzük együtt.',
  },
  hours: {
    title: 'Ünnepi nyitvatartás', desc: 'Nyitvatartás, rövid közlemény, köszönet az évért', subject: 'Ünnepi nyitvatartás — foglalj, amíg van hely',
    h: 'Ünnepek előtt még szépen — így vagyunk nyitva',
    p: 'Kedves {keresztnév}! Köszönjük, hogy idén is minket választottál. Az ünnepek előtti hetekben minden évben gyorsan beteltek az időpontok — így vagyunk nyitva, foglalj időben.',
    list: ['<b>Dec. 23-ig:</b> minden nap nyitva, este 8-ig', '<b>Dec. 24–26.:</b> zárva', '<b>Jan. 2-tól</b> a megszokott nyitvatartás'],
    btn: 'Időpontot foglalok', small: 'Boldog ünnepeket kíván a csapatunk!',
  },
  special: {
    title: 'Születésnapi ajándék', desc: 'Személyes köszöntő kedvezménnyel — a szülinaposoknak', subject: 'Boldog születésnapot! Ajándékot hoztunk',
    h: 'Boldog születésnapot, {keresztnév}!', p: 'Ünnepeld magad egy kis kényeztetéssel. A születésnapod hónapjában bármelyik kezelésünkből 20% kedvezményt adunk — mert megérdemled.',
    btn: 'Beváltom az ajándékom', small: 'A kedvezmény a születésnapod hónapjában foglalt időpontokra érvényes, más kedvezménnyel nem vonható össze.',
  },
}

const HU_REST: TemplateCopy = {
  promo: {
    title: 'Szezonális ajánlat', desc: 'Új szezon, kedvezményes fogások, foglalás gomb', subject: 'Megjött a vadszezon — két fogás most kedvezménnyel',
    h: 'Megjött a vadszezon. Ezt kóstold meg először.',
    p: 'Kedves {keresztnév}! Az erdő legjobb ízei kerültek az étlapra: lassan főtt szarvasragu, birsalmás vaddisznó és erdei gombás rizottó. Ezen a héten két kedvenc fogásunkat kedvezményes áron kínáljuk — hogy ne csak hallj róla, hanem meg is kóstold.',
    sub: 'Miért érdemes most eljönni?', list: ['<b>Szezonális fogások</b> helyi vadból, csak néhány hétig', '<b>Borpárosítás</b> a sommelier ajánlásával', '<b>Péntek–szombat este</b> élő zene a teraszon'],
    offers: [['Vadtál két főre', '18 900 Ft', '16 500 Ft'], ['Borpárosítás 3 pohárral', '6 900 Ft', '5 900 Ft']], btn: 'Asztalt foglalok',
    small: 'Az ajánlat vasárnapig érvényes, amíg a készlet tart. A hétvégi estékre gyorsan fogynak az asztalok — érdemes most foglalni.',
  },
  voucher: {
    title: 'Ajándékutalvány', desc: 'Ünnepekre, születésnapra — megvásárolható utalvánnyal', subject: 'Ajándékötlet, ami biztosan bejön: egy közös vacsora',
    h: 'Ajándékozz egy estét, amire sokáig emlékezni fog',
    p: 'Kedves {keresztnév}! Nem kell tovább keresgélned: egy jó vacsora nálunk mindig telitalálat — szülinapra, évfordulóra vagy csak úgy. Az utalványt két perc alatt megveszed online, és azonnal megérkezik e-mailben.',
    list: ['<b>Te választod az összeget</b> — a megajándékozott választ belőle', '<b>Azonnal megérkezik</b> e-mailben, továbbküldhető vagy kinyomtatható', '<b>Utolsó pillanatban is megoldás</b> — akár a buli előtt öt perccel'],
    amount: '24 000 Ft', vTitle: 'Ajándék vacsora két főre', vText: 'Online megveszed, e-mailben megy.', vLabel: 'Utalványt veszek',
    small: 'Kérdésed van az utalvánnyal kapcsolatban? Válaszolj erre a levélre, és segítünk.',
  },
  winback: {
    title: 'Rég nem jártál nálunk', desc: 'Visszahívó levél ajándékkal — a 90 napja nem járt vendégeknek', subject: 'Hiányzol! Ezzel várunk vissza',
    h: 'Rég láttunk, {keresztnév}!',
    p: 'Az utolsó látogatásod óta sok minden változott: megújult az étlap, és a teraszon is vár egy asztal. Szeretnénk újra vendégül látni, ezért a következő vacsorádhoz egy kis meglepetéssel készülünk.',
    list: ['<b>A desszert a ház ajándéka</b>, ha két héten belül foglalsz', 'Pár kattintással foglalsz, a nap bármely szakában', 'A foglalást bármikor módosíthatod vagy lemondhatod'],
    btn: 'Visszajövök — asztalt foglalok', small: 'A meglepetés a levél érkezésétől számított 30 napon belüli foglalásra érvényes.',
  },
  news: {
    title: 'Újdonság', desc: 'Új étlap, esemény, borkóstoló — két képpel', subject: 'Új étlap és borkóstoló esték — ezt látnod kell',
    h: 'Megérkezett az őszi étlap',
    p: 'Kedves {keresztnév}! Szezonális, helyi alapanyagokból főzünk, és az étlap fele teljesen új. Csütörtökönként pedig borkóstoló estét tartunk: négy bor, négy kis fogás, egy jó beszélgetés.',
    list: ['<b>Új fogások</b> minden héten a napi ajánlatban', '<b>Borkóstoló</b> csütörtökönként 19 órától', '<b>Vegetáriánus és gluténmentes</b> választék is'],
    btn: 'Asztalt foglalok', small: 'A borkóstoló estékre korlátozott a hely — érdemes előre foglalni.',
  },
  hours: {
    title: 'Ünnepi nyitvatartás', desc: 'Nyitvatartás, rövid közlemény, köszönet az évért', subject: 'Ünnepi nyitvatartás és szilveszteri menü',
    h: 'Ünnepek nálunk — így vagyunk nyitva',
    p: 'Kedves {keresztnév}! Köszönjük, hogy idén is velünk ünnepeltél. Az ünnepek alatt így várunk, szilveszterkor pedig ötfogásos menüvel búcsúztatjuk az évet.',
    list: ['<b>Dec. 24–26.:</b> zárva', '<b>Dec. 31.:</b> szilveszteri menü 18 órától — csak foglalással', '<b>Jan. 2-tól</b> a megszokott nyitvatartás'],
    btn: 'Asztalt foglalok', small: 'Boldog ünnepeket kíván a csapatunk!',
  },
  special: {
    title: 'Céges rendezvény', desc: 'Évzáró, csapatvacsora — a céges vendégeknek', subject: 'Évzáró vagy csapatvacsora? Nálunk mindent megoldunk',
    h: 'Évzáró vacsora, amire a csapat jövőre is emlékszik',
    p: 'Kedves {keresztnév}! Közeleg az év vége — ha csapatvacsorát vagy évzárót tervezel, vegyük le a terhet a válladról. Menütől a borokig mindent egyeztetünk, te csak érkezz meg.',
    list: ['<b>Egyedi menü</b> a csapat ízlése és létszáma szerint', '<b>Különterem</b> vagy az egész étterem', '<b>Számla a cég nevére</b>, egy kapcsolattartóval'],
    btn: 'Ajánlatot kérek', small: 'A decemberi péntekek elsőként telnek be — írj most, és foglaljuk a dátumot.',
  },
}

const EN_SALON: TemplateCopy = {
  promo: {
    title: 'Seasonal offer', desc: 'Discount with a deadline, priced offers, booking button', subject: 'Autumn refresh −15% — until October 31 only',
    h: 'New season, new look — now 15% off',
    p: 'Dear {keresztnév}, summer sun, salt and chlorine leave their mark on your hair. Until October 31 we give 15% off every colour, balayage and repair treatment, so your hair steps into autumn shiny and healthy.',
    sub: 'What you get now', list: ['<b>−15%</b> on every colour and balayage', '<b>Free hair mask</b> with every treatment', '<b>Personal colour consultation</b> before you decide'],
    offers: [['Balayage + cut', '48 000 Ft', '40 800 Ft'], ['Root colour + blow-dry', '22 000 Ft', '18 700 Ft']], btn: 'Book my appointment',
    small: 'The discount applies to appointments booked by October 31. Afternoon slots go fastest — pick yours while there is still room.',
  },
  voucher: {
    title: 'Gift voucher', desc: 'For holidays and birthdays — with a voucher to buy', subject: 'A gift idea that always lands: an hour just for them',
    h: 'Give an hour they can spend on themselves',
    p: 'Dear {keresztnév}, no more searching: a pampering treatment with us is always a hit — for a birthday, a name day or just because. You buy the voucher online in two minutes, and it arrives by email straight away.',
    list: ['<b>You choose the amount</b> — they choose the treatment', '<b>Arrives instantly</b> by email, ready to forward or print', '<b>A last-minute lifesaver</b> — even five minutes before the party'],
    amount: '20 000 Ft', vTitle: 'Gift of pampering', vText: 'Buy it online, it arrives by email.', vLabel: 'Buy a voucher',
    small: 'Questions about the voucher? Just reply to this email and we will help.',
  },
  winback: {
    title: 'We miss you', desc: 'Win-back email with a gift — for guests who have not visited for 90 days', subject: 'We miss you! A little surprise is waiting',
    h: 'Long time no see, {keresztnév}!',
    p: 'A lot has changed since your last visit: new treatments, new team members — the coffee is just as good though. We would love to see you again, so we have a small surprise ready for your next appointment.',
    list: ['<b>Free hair mask</b> with your next treatment', 'Book in a few clicks, even at night', 'Change or cancel your appointment any time'],
    btn: 'I am coming back — book now', small: 'The surprise is valid for bookings made within 30 days of this email.',
  },
  news: {
    title: 'What is new', desc: 'Introduce a new service or team member — with two photos', subject: 'New at our salon: keratin hair repair',
    h: 'Introducing: keratin hair repair',
    p: 'Dear {keresztnév}, if your hair is brittle, frizzy or simply tired, this is for you. The treatment rebuilds each strand from within — you will feel the difference even after the first wash.',
    list: ['<b>Shiny, smooth hair</b> from the very first treatment', '<b>Gentle</b> on coloured and bleached hair too', '<b>Introductory price</b> until the end of the month'],
    btn: 'I want to try it — book now', small: 'Not sure it is right for you? Book a free consultation and we will look at it together.',
  },
  hours: {
    title: 'Holiday opening hours', desc: 'Opening hours, a short notice, thanks for the year', subject: 'Holiday opening hours — book while there is room',
    h: 'Look your best for the holidays — our opening hours',
    p: 'Dear {keresztnév}, thank you for choosing us again this year. The weeks before the holidays fill up fast every year — here are our hours, book in time.',
    list: ['<b>Until Dec 23:</b> open every day until 8 pm', '<b>Dec 24–26:</b> closed', '<b>From Jan 2:</b> regular opening hours'],
    btn: 'Book an appointment', small: 'Happy holidays from all of our team!',
  },
  special: {
    title: 'Birthday gift', desc: 'A personal greeting with a discount — for birthday guests', subject: 'Happy birthday! We brought you a gift',
    h: 'Happy birthday, {keresztnév}!', p: 'Celebrate yourself with a little pampering. In your birthday month you get 20% off any of our treatments — because you deserve it.',
    btn: 'Claim my gift', small: 'The discount applies to appointments booked in your birthday month and cannot be combined with other offers.',
  },
}

const EN_REST: TemplateCopy = {
  promo: {
    title: 'Seasonal offer', desc: 'New season, discounted dishes, booking button', subject: 'Game season is here — two dishes now at a special price',
    h: 'Game season is here. Taste this first.',
    p: 'Dear {keresztnév}, the best flavours of the forest are on the menu: slow-cooked venison stew, wild boar with quince and wild mushroom risotto. This week two of our favourite dishes come at a special price — so you do not just hear about them, you taste them.',
    sub: 'Why come now?', list: ['<b>Seasonal dishes</b> from local game, for a few weeks only', '<b>Wine pairing</b> recommended by our sommelier', '<b>Friday–Saturday evenings</b> live music on the terrace'],
    offers: [['Game platter for two', '18 900 Ft', '16 500 Ft'], ['Wine pairing, 3 glasses', '6 900 Ft', '5 900 Ft']], btn: 'Book a table',
    small: 'The offer is valid until Sunday while stocks last. Weekend evenings fill up fast — book now.',
  },
  voucher: {
    title: 'Gift voucher', desc: 'For holidays and birthdays — with a voucher to buy', subject: 'A gift idea that always lands: a dinner together',
    h: 'Give an evening they will remember',
    p: 'Dear {keresztnév}, no more searching: a good dinner with us is always a hit — for a birthday, an anniversary or just because. You buy the voucher online in two minutes, and it arrives by email straight away.',
    list: ['<b>You choose the amount</b> — they choose the evening', '<b>Arrives instantly</b> by email, ready to forward or print', '<b>A last-minute lifesaver</b> — even five minutes before the party'],
    amount: '24 000 Ft', vTitle: 'Dinner for two', vText: 'Buy it online, it arrives by email.', vLabel: 'Buy a voucher',
    small: 'Questions about the voucher? Just reply to this email and we will help.',
  },
  winback: {
    title: 'We miss you', desc: 'Win-back email with a gift — for guests who have not visited for 90 days', subject: 'We miss you! Here is how we welcome you back',
    h: 'Long time no see, {keresztnév}!',
    p: 'A lot has changed since your last visit: the menu is new, and a table is waiting on the terrace. We would love to host you again, so we have a small surprise ready for your next dinner.',
    list: ['<b>Dessert is on the house</b> if you book within two weeks', 'Book in a few clicks, any time of day', 'Change or cancel your booking any time'],
    btn: 'I am coming back — book a table', small: 'The surprise is valid for bookings made within 30 days of this email.',
  },
  news: {
    title: 'What is new', desc: 'New menu, event, wine tasting — with two photos', subject: 'A new menu and wine tasting evenings — you have to see this',
    h: 'Our autumn menu has arrived',
    p: 'Dear {keresztnév}, we cook with seasonal, local ingredients, and half of the menu is brand new. On Thursdays we host wine tasting evenings: four wines, four small plates, one good conversation.',
    list: ['<b>New dishes</b> every week in the daily specials', '<b>Wine tasting</b> on Thursdays from 7 pm', '<b>Vegetarian and gluten-free</b> options too'],
    btn: 'Book a table', small: 'Places for the wine tasting evenings are limited — book ahead.',
  },
  hours: {
    title: 'Holiday opening hours', desc: 'Opening hours, a short notice, thanks for the year', subject: 'Holiday opening hours and New Year’s Eve menu',
    h: 'The holidays with us — our opening hours',
    p: 'Dear {keresztnév}, thank you for celebrating with us again this year. Here are our holiday hours, and on New Year’s Eve we see out the year with a five-course menu.',
    list: ['<b>Dec 24–26:</b> closed', '<b>Dec 31:</b> New Year’s Eve menu from 6 pm — booking only', '<b>From Jan 2:</b> regular opening hours'],
    btn: 'Book a table', small: 'Happy holidays from all of our team!',
  },
  special: {
    title: 'Company event', desc: 'Year-end party, team dinner — for business guests', subject: 'Year-end party or team dinner? We take care of everything',
    h: 'A year-end dinner your team will still talk about next year',
    p: 'Dear {keresztnév}, the end of the year is near — if you are planning a team dinner or a year-end party, let us take it off your hands. From the menu to the wines we arrange everything, you just arrive.',
    list: ['<b>Custom menu</b> for your team’s taste and size', '<b>Private room</b> or the whole restaurant', '<b>Invoice to your company</b>, one contact person'],
    btn: 'Request an offer', small: 'December Fridays fill up first — write now and we will hold the date.',
  },
}

const DE_SALON: TemplateCopy = {
  promo: {
    title: 'Saisonangebot', desc: 'Rabatt mit Frist, Angebote mit Preis, Buchungsbutton', subject: 'Herbst-Refresh −15 % — nur bis 31. Oktober',
    h: 'Neue Saison, neuer Look — jetzt 15 % günstiger',
    p: 'Liebe(r) {keresztnév}, Sommersonne, Salz und Chlor hinterlassen Spuren im Haar. Bis zum 31. Oktober gibt es 15 % auf jede Coloration, Balayage und Haarkur — damit dein Haar glänzend und gesund in den Herbst startet.',
    sub: 'Was du jetzt bekommst', list: ['<b>−15 %</b> auf jede Coloration und Balayage', '<b>Gratis Haarmaske</b> zu jeder Behandlung', '<b>Persönliche Farbberatung</b>, bevor du dich entscheidest'],
    offers: [['Balayage + Schnitt', '48 000 Ft', '40 800 Ft'], ['Ansatzfarbe + Föhnen', '22 000 Ft', '18 700 Ft']], btn: 'Termin buchen',
    small: 'Der Rabatt gilt für Termine, die bis 31. Oktober gebucht werden. Nachmittagstermine sind am schnellsten weg — sichere dir jetzt deinen Platz.',
  },
  voucher: {
    title: 'Geschenkgutschein', desc: 'Für Feiertage und Geburtstage — mit kaufbarem Gutschein', subject: 'Eine Geschenkidee, die immer ankommt: eine Stunde nur für sie',
    h: 'Schenke eine Stunde, die ganz ihr gehört',
    p: 'Liebe(r) {keresztnév}, du musst nicht weitersuchen: eine Verwöhnbehandlung bei uns ist immer ein Volltreffer — zum Geburtstag, Namenstag oder einfach so. Den Gutschein kaufst du in zwei Minuten online, er kommt sofort per E-Mail.',
    list: ['<b>Du wählst den Betrag</b> — die Beschenkten die Behandlung', '<b>Kommt sofort</b> per E-Mail, zum Weiterleiten oder Ausdrucken', '<b>Die Last-Minute-Rettung</b> — sogar fünf Minuten vor der Feier'],
    amount: '20 000 Ft', vTitle: 'Verwöhn-Gutschein', vText: 'Online kaufen, kommt per E-Mail.', vLabel: 'Gutschein kaufen',
    small: 'Fragen zum Gutschein? Antworte einfach auf diese E-Mail, wir helfen gern.',
  },
  winback: {
    title: 'Wir vermissen dich', desc: 'Rückgewinnungs-Mail mit Geschenk — für Gäste, die seit 90 Tagen nicht da waren', subject: 'Wir vermissen dich! Eine kleine Überraschung wartet',
    h: 'Lange nicht gesehen, {keresztnév}!',
    p: 'Seit deinem letzten Besuch hat sich viel getan: neue Behandlungen, neue Teammitglieder — der Kaffee ist aber genauso gut. Wir würden dich gern wiedersehen und haben für deinen nächsten Termin eine kleine Überraschung vorbereitet.',
    list: ['<b>Gratis Haarmaske</b> zu deiner nächsten Behandlung', 'In wenigen Klicks gebucht, auch nachts', 'Termin jederzeit ändern oder absagen'],
    btn: 'Ich komme wieder — Termin buchen', small: 'Die Überraschung gilt für Buchungen innerhalb von 30 Tagen nach dieser E-Mail.',
  },
  news: {
    title: 'Neuigkeit', desc: 'Neue Leistung oder neues Teammitglied vorstellen — mit zwei Fotos', subject: 'Neu bei uns: Keratin-Haaraufbau',
    h: 'Neu: Keratin-Haaraufbau',
    p: 'Liebe(r) {keresztnév}, wenn dein Haar brüchig, kraus oder einfach müde ist, ist das genau das Richtige. Die Behandlung baut jedes Haar von innen wieder auf — den Unterschied spürst du schon nach der ersten Wäsche.',
    list: ['<b>Glänzendes, geschmeidiges Haar</b> ab der ersten Behandlung', '<b>Schonend</b> auch für gefärbtes und blondiertes Haar', '<b>Einführungspreis</b> bis Monatsende'],
    btn: 'Ausprobieren — Termin buchen', small: 'Nicht sicher, ob es zu dir passt? Buche eine kostenlose Beratung, wir schauen es uns gemeinsam an.',
  },
  hours: {
    title: 'Öffnungszeiten an Feiertagen', desc: 'Öffnungszeiten, kurze Mitteilung, Dank für das Jahr', subject: 'Öffnungszeiten an Feiertagen — jetzt buchen, solange Platz ist',
    h: 'Schön in die Feiertage — so haben wir geöffnet',
    p: 'Liebe(r) {keresztnév}, danke, dass du uns auch dieses Jahr gewählt hast. Die Wochen vor den Feiertagen sind jedes Jahr schnell ausgebucht — hier unsere Öffnungszeiten, buche rechtzeitig.',
    list: ['<b>Bis 23. Dez.:</b> täglich geöffnet bis 20 Uhr', '<b>24.–26. Dez.:</b> geschlossen', '<b>Ab 2. Jan.:</b> reguläre Öffnungszeiten'],
    btn: 'Termin buchen', small: 'Frohe Feiertage wünscht dir unser ganzes Team!',
  },
  special: {
    title: 'Geburtstagsgeschenk', desc: 'Persönlicher Gruß mit Rabatt — für Geburtstagskinder', subject: 'Alles Gute zum Geburtstag! Wir haben ein Geschenk für dich',
    h: 'Alles Gute zum Geburtstag, {keresztnév}!', p: 'Feiere dich mit ein wenig Verwöhnung. In deinem Geburtstagsmonat bekommst du 20 % auf jede unserer Behandlungen — weil du es verdienst.',
    btn: 'Geschenk einlösen', small: 'Der Rabatt gilt für Termine in deinem Geburtstagsmonat und ist nicht mit anderen Angeboten kombinierbar.',
  },
}

const DE_REST: TemplateCopy = {
  promo: {
    title: 'Saisonangebot', desc: 'Neue Saison, Gerichte zum Sonderpreis, Buchungsbutton', subject: 'Die Wildsaison ist da — zwei Gerichte jetzt zum Sonderpreis',
    h: 'Die Wildsaison ist da. Probier das zuerst.',
    p: 'Liebe(r) {keresztnév}, die besten Aromen des Waldes stehen auf der Karte: langsam geschmortes Hirschragout, Wildschwein mit Quitte und Waldpilzrisotto. Diese Woche gibt es zwei unserer Lieblingsgerichte zum Sonderpreis — damit du nicht nur davon hörst, sondern sie probierst.',
    sub: 'Warum gerade jetzt?', list: ['<b>Saisongerichte</b> aus heimischem Wild, nur wenige Wochen', '<b>Weinbegleitung</b> auf Empfehlung unseres Sommeliers', '<b>Freitag–Samstag abends</b> Live-Musik auf der Terrasse'],
    offers: [['Wildplatte für zwei', '18 900 Ft', '16 500 Ft'], ['Weinbegleitung, 3 Gläser', '6 900 Ft', '5 900 Ft']], btn: 'Tisch reservieren',
    small: 'Das Angebot gilt bis Sonntag, solange der Vorrat reicht. Wochenendabende sind schnell ausgebucht — jetzt reservieren.',
  },
  voucher: {
    title: 'Geschenkgutschein', desc: 'Für Feiertage und Geburtstage — mit kaufbarem Gutschein', subject: 'Eine Geschenkidee, die immer ankommt: ein gemeinsames Abendessen',
    h: 'Schenke einen Abend, an den man sich lange erinnert',
    p: 'Liebe(r) {keresztnév}, du musst nicht weitersuchen: ein gutes Abendessen bei uns ist immer ein Volltreffer — zum Geburtstag, Jahrestag oder einfach so. Den Gutschein kaufst du in zwei Minuten online, er kommt sofort per E-Mail.',
    list: ['<b>Du wählst den Betrag</b> — die Beschenkten den Abend', '<b>Kommt sofort</b> per E-Mail, zum Weiterleiten oder Ausdrucken', '<b>Die Last-Minute-Rettung</b> — sogar fünf Minuten vor der Feier'],
    amount: '24 000 Ft', vTitle: 'Abendessen für zwei', vText: 'Online kaufen, kommt per E-Mail.', vLabel: 'Gutschein kaufen',
    small: 'Fragen zum Gutschein? Antworte einfach auf diese E-Mail, wir helfen gern.',
  },
  winback: {
    title: 'Wir vermissen dich', desc: 'Rückgewinnungs-Mail mit Geschenk — für Gäste, die seit 90 Tagen nicht da waren', subject: 'Wir vermissen dich! So begrüßen wir dich zurück',
    h: 'Lange nicht gesehen, {keresztnév}!',
    p: 'Seit deinem letzten Besuch hat sich viel getan: die Karte ist neu, und auf der Terrasse wartet ein Tisch. Wir würden dich gern wieder bewirten und haben für dein nächstes Abendessen eine kleine Überraschung vorbereitet.',
    list: ['<b>Das Dessert geht aufs Haus</b>, wenn du innerhalb von zwei Wochen reservierst', 'In wenigen Klicks reserviert, zu jeder Tageszeit', 'Reservierung jederzeit ändern oder absagen'],
    btn: 'Ich komme wieder — Tisch reservieren', small: 'Die Überraschung gilt für Reservierungen innerhalb von 30 Tagen nach dieser E-Mail.',
  },
  news: {
    title: 'Neuigkeit', desc: 'Neue Karte, Event, Weinprobe — mit zwei Fotos', subject: 'Neue Karte und Weinproben-Abende — das musst du sehen',
    h: 'Unsere Herbstkarte ist da',
    p: 'Liebe(r) {keresztnév}, wir kochen mit saisonalen, regionalen Zutaten, und die Hälfte der Karte ist ganz neu. Donnerstags gibt es Weinproben-Abende: vier Weine, vier kleine Gänge, ein gutes Gespräch.',
    list: ['<b>Neue Gerichte</b> jede Woche im Tagesangebot', '<b>Weinprobe</b> donnerstags ab 19 Uhr', '<b>Vegetarische und glutenfreie</b> Auswahl'],
    btn: 'Tisch reservieren', small: 'Die Plätze für die Weinproben sind begrenzt — am besten vorab reservieren.',
  },
  hours: {
    title: 'Öffnungszeiten an Feiertagen', desc: 'Öffnungszeiten, kurze Mitteilung, Dank für das Jahr', subject: 'Öffnungszeiten an Feiertagen und Silvestermenü',
    h: 'Feiertage bei uns — so haben wir geöffnet',
    p: 'Liebe(r) {keresztnév}, danke, dass du auch dieses Jahr mit uns gefeiert hast. So sind wir über die Feiertage für dich da, und an Silvester verabschieden wir das Jahr mit einem Fünf-Gänge-Menü.',
    list: ['<b>24.–26. Dez.:</b> geschlossen', '<b>31. Dez.:</b> Silvestermenü ab 18 Uhr — nur mit Reservierung', '<b>Ab 2. Jan.:</b> reguläre Öffnungszeiten'],
    btn: 'Tisch reservieren', small: 'Frohe Feiertage wünscht dir unser ganzes Team!',
  },
  special: {
    title: 'Firmenevent', desc: 'Jahresabschluss, Teamessen — für Firmengäste', subject: 'Jahresabschluss oder Teamessen? Wir kümmern uns um alles',
    h: 'Ein Jahresabschluss, von dem das Team noch nächstes Jahr spricht',
    p: 'Liebe(r) {keresztnév}, das Jahresende naht — wenn du ein Teamessen oder eine Jahresabschlussfeier planst, nehmen wir dir die Arbeit ab. Vom Menü bis zu den Weinen stimmen wir alles ab, du musst nur kommen.',
    list: ['<b>Individuelles Menü</b> nach Geschmack und Größe des Teams', '<b>Separater Raum</b> oder das ganze Restaurant', '<b>Rechnung auf die Firma</b>, ein Ansprechpartner'],
    btn: 'Angebot anfragen', small: 'Die Freitage im Dezember sind zuerst ausgebucht — schreib uns jetzt, wir halten den Termin frei.',
  },
}

const ES_SALON: TemplateCopy = {
  promo: {
    title: 'Oferta de temporada', desc: 'Descuento con fecha límite, ofertas con precio, botón de reserva', subject: 'Renovación de otoño −15 % — solo hasta el 31 de octubre',
    h: 'Nueva temporada, nuevo look — ahora con un 15 % de descuento',
    p: 'Hola, {keresztnév}: el sol, la sal y el cloro del verano dejan huella en el cabello. Hasta el 31 de octubre te damos un 15 % de descuento en cada coloración, balayage y tratamiento reparador, para que tu pelo empiece el otoño brillante y sano.',
    sub: 'Qué te llevas ahora', list: ['<b>−15 %</b> en toda coloración y balayage', '<b>Mascarilla de regalo</b> con cada tratamiento', '<b>Asesoría de color personal</b> antes de decidir'],
    offers: [['Balayage + corte', '48 000 Ft', '40 800 Ft'], ['Raíces + secado', '22 000 Ft', '18 700 Ft']], btn: 'Reservar mi cita',
    small: 'El descuento es válido para citas reservadas hasta el 31 de octubre. Las tardes se llenan antes: elige la tuya mientras haya hueco.',
  },
  voucher: {
    title: 'Tarjeta regalo', desc: 'Para fiestas y cumpleaños — con tarjeta regalo a la venta', subject: 'Una idea de regalo que siempre acierta: una hora solo para ella',
    h: 'Regala una hora para dedicarse a sí misma',
    p: 'Hola, {keresztnév}: no busques más; un tratamiento con nosotros siempre acierta — para un cumpleaños, un santo o porque sí. Compras la tarjeta online en dos minutos y llega al instante por correo.',
    list: ['<b>Tú eliges el importe</b> — quien la recibe elige el tratamiento', '<b>Llega al instante</b> por correo, para reenviar o imprimir', '<b>Salva el último minuto</b> — incluso cinco minutos antes de la fiesta'],
    amount: '20 000 Ft', vTitle: 'Regalo de bienestar', vText: 'Se compra online y llega por correo.', vLabel: 'Comprar tarjeta',
    small: '¿Dudas sobre la tarjeta regalo? Responde a este correo y te ayudamos.',
  },
  winback: {
    title: 'Te echamos de menos', desc: 'Correo de reconquista con regalo — para quien no viene desde hace 90 días', subject: '¡Te echamos de menos! Te espera una sorpresa',
    h: '¡Cuánto tiempo, {keresztnév}!',
    p: 'Desde tu última visita han cambiado muchas cosas: nuevos tratamientos, nuevas caras en el equipo — el café sigue igual de bueno. Nos encantaría volver a verte, así que hemos preparado una pequeña sorpresa para tu próxima cita.',
    list: ['<b>Mascarilla de regalo</b> con tu próximo tratamiento', 'Reserva en pocos clics, incluso de noche', 'Cambia o cancela tu cita cuando quieras'],
    btn: 'Vuelvo — reservar cita', small: 'La sorpresa es válida para reservas hechas en los 30 días siguientes a este correo.',
  },
  news: {
    title: 'Novedad', desc: 'Presenta un servicio o una persona nueva — con dos fotos', subject: 'Novedad en el salón: reconstrucción capilar con queratina',
    h: 'Te presentamos: reconstrucción con queratina',
    p: 'Hola, {keresztnév}: si tu pelo está quebradizo, encrespado o simplemente cansado, esto es para ti. El tratamiento reconstruye cada cabello desde dentro — notarás la diferencia desde el primer lavado.',
    list: ['<b>Pelo brillante y suave</b> desde el primer tratamiento', '<b>Suave</b> también con pelo teñido o decolorado', '<b>Precio de lanzamiento</b> hasta fin de mes'],
    btn: 'Quiero probarlo — reservar', small: '¿No sabes si es para ti? Reserva una consulta gratuita y lo vemos juntos.',
  },
  hours: {
    title: 'Horario de fiestas', desc: 'Horario, aviso breve, gracias por el año', subject: 'Horario de fiestas — reserva mientras haya hueco',
    h: 'Guapa para las fiestas — este es nuestro horario',
    p: 'Hola, {keresztnév}: gracias por elegirnos un año más. Las semanas antes de las fiestas se llenan rápido cada año — este es nuestro horario, reserva con tiempo.',
    list: ['<b>Hasta el 23 de dic.:</b> abierto todos los días hasta las 20 h', '<b>24–26 de dic.:</b> cerrado', '<b>Desde el 2 de ene.:</b> horario habitual'],
    btn: 'Reservar cita', small: '¡Felices fiestas de parte de todo el equipo!',
  },
  special: {
    title: 'Regalo de cumpleaños', desc: 'Felicitación personal con descuento — para quien cumple años', subject: '¡Feliz cumpleaños! Te traemos un regalo',
    h: '¡Feliz cumpleaños, {keresztnév}!', p: 'Celébralo con un pequeño capricho. En el mes de tu cumpleaños tienes un 20 % de descuento en cualquiera de nuestros tratamientos — porque te lo mereces.',
    btn: 'Canjear mi regalo', small: 'El descuento es válido para citas en el mes de tu cumpleaños y no se acumula con otras ofertas.',
  },
}

const ES_REST: TemplateCopy = {
  promo: {
    title: 'Oferta de temporada', desc: 'Nueva temporada, platos con descuento, botón de reserva', subject: 'Llega la temporada de caza — dos platos a precio especial',
    h: 'Llega la temporada de caza. Prueba esto primero.',
    p: 'Hola, {keresztnév}: los mejores sabores del bosque llegan a la carta: guiso de ciervo a fuego lento, jabalí con membrillo y risotto de setas. Esta semana dos de nuestros platos favoritos tienen precio especial — para que no solo oigas hablar de ellos, sino que los pruebes.',
    sub: '¿Por qué venir ahora?', list: ['<b>Platos de temporada</b> con caza local, solo unas semanas', '<b>Maridaje</b> recomendado por nuestro sumiller', '<b>Viernes y sábado por la noche</b> música en vivo en la terraza'],
    offers: [['Tabla de caza para dos', '18 900 Ft', '16 500 Ft'], ['Maridaje, 3 copas', '6 900 Ft', '5 900 Ft']], btn: 'Reservar mesa',
    small: 'Oferta válida hasta el domingo o hasta agotar existencias. Las noches del fin de semana se llenan rápido — reserva ya.',
  },
  voucher: {
    title: 'Tarjeta regalo', desc: 'Para fiestas y cumpleaños — con tarjeta regalo a la venta', subject: 'Una idea de regalo que siempre acierta: una cena juntos',
    h: 'Regala una noche que se recordará mucho tiempo',
    p: 'Hola, {keresztnév}: no busques más; una buena cena con nosotros siempre acierta — para un cumpleaños, un aniversario o porque sí. Compras la tarjeta online en dos minutos y llega al instante por correo.',
    list: ['<b>Tú eliges el importe</b> — quien la recibe elige la noche', '<b>Llega al instante</b> por correo, para reenviar o imprimir', '<b>Salva el último minuto</b> — incluso cinco minutos antes de la fiesta'],
    amount: '24 000 Ft', vTitle: 'Cena para dos', vText: 'Se compra online y llega por correo.', vLabel: 'Comprar tarjeta',
    small: '¿Dudas sobre la tarjeta regalo? Responde a este correo y te ayudamos.',
  },
  winback: {
    title: 'Te echamos de menos', desc: 'Correo de reconquista con regalo — para quien no viene desde hace 90 días', subject: '¡Te echamos de menos! Así te damos la bienvenida',
    h: '¡Cuánto tiempo, {keresztnév}!',
    p: 'Desde tu última visita han cambiado muchas cosas: la carta es nueva y te espera una mesa en la terraza. Nos encantaría recibirte otra vez, así que hemos preparado una pequeña sorpresa para tu próxima cena.',
    list: ['<b>El postre corre por nuestra cuenta</b> si reservas en dos semanas', 'Reserva en pocos clics, a cualquier hora', 'Cambia o cancela tu reserva cuando quieras'],
    btn: 'Vuelvo — reservar mesa', small: 'La sorpresa es válida para reservas hechas en los 30 días siguientes a este correo.',
  },
  news: {
    title: 'Novedad', desc: 'Nueva carta, evento, cata de vinos — con dos fotos', subject: 'Nueva carta y noches de cata — tienes que verlo',
    h: 'Ya está aquí la carta de otoño',
    p: 'Hola, {keresztnév}: cocinamos con ingredientes locales de temporada y la mitad de la carta es completamente nueva. Los jueves organizamos noches de cata: cuatro vinos, cuatro platillos y una buena conversación.',
    list: ['<b>Platos nuevos</b> cada semana en las sugerencias del día', '<b>Cata de vinos</b> los jueves desde las 19 h', '<b>Opciones vegetarianas y sin gluten</b>'],
    btn: 'Reservar mesa', small: 'Las plazas para las catas son limitadas — reserva con antelación.',
  },
  hours: {
    title: 'Horario de fiestas', desc: 'Horario, aviso breve, gracias por el año', subject: 'Horario de fiestas y menú de Nochevieja',
    h: 'Las fiestas con nosotros — este es nuestro horario',
    p: 'Hola, {keresztnév}: gracias por celebrar con nosotros un año más. Este es nuestro horario de fiestas, y en Nochevieja despedimos el año con un menú de cinco platos.',
    list: ['<b>24–26 de dic.:</b> cerrado', '<b>31 de dic.:</b> menú de Nochevieja desde las 18 h — solo con reserva', '<b>Desde el 2 de ene.:</b> horario habitual'],
    btn: 'Reservar mesa', small: '¡Felices fiestas de parte de todo el equipo!',
  },
  special: {
    title: 'Evento de empresa', desc: 'Cena de fin de año, cena de equipo — para clientes de empresa', subject: '¿Cena de fin de año o de equipo? Nos encargamos de todo',
    h: 'Una cena de fin de año de la que tu equipo hablará el año que viene',
    p: 'Hola, {keresztnév}: se acerca el final del año — si planeas una cena de equipo o de empresa, déjala en nuestras manos. Del menú a los vinos lo organizamos todo; tú solo tienes que venir.',
    list: ['<b>Menú a medida</b> según los gustos y el tamaño del equipo', '<b>Sala privada</b> o el restaurante entero', '<b>Factura a nombre de la empresa</b>, con una sola persona de contacto'],
    btn: 'Pedir presupuesto', small: 'Los viernes de diciembre se llenan primero — escríbenos ya y reservamos la fecha.',
  },
}

const IT_SALON: TemplateCopy = {
  promo: {
    title: 'Offerta di stagione', desc: 'Sconto con scadenza, offerte con prezzo, pulsante di prenotazione', subject: 'Rinnovo d’autunno −15% — solo fino al 31 ottobre',
    h: 'Nuova stagione, nuovo look — ora con il 15% di sconto',
    p: 'Ciao {keresztnév}, sole, sale e cloro lasciano il segno sui capelli. Fino al 31 ottobre ti offriamo il 15% di sconto su ogni colore, balayage e trattamento ricostruttivo, perché i tuoi capelli entrino nell’autunno lucidi e sani.',
    sub: 'Cosa ottieni ora', list: ['<b>−15%</b> su ogni colore e balayage', '<b>Maschera in omaggio</b> con ogni trattamento', '<b>Consulenza colore personale</b> prima di decidere'],
    offers: [['Balayage + taglio', '48 000 Ft', '40 800 Ft'], ['Ricrescita + piega', '22 000 Ft', '18 700 Ft']], btn: 'Prenota il mio appuntamento',
    small: 'Lo sconto vale per gli appuntamenti prenotati entro il 31 ottobre. I pomeriggi si esauriscono per primi — scegli ora finché c’è posto.',
  },
  voucher: {
    title: 'Buono regalo', desc: 'Per feste e compleanni — con buono acquistabile', subject: 'Un’idea regalo che non sbaglia mai: un’ora tutta per lei',
    h: 'Regala un’ora da dedicare a sé stessa',
    p: 'Ciao {keresztnév}, smetti di cercare: un trattamento da noi è sempre un successo — per un compleanno, un onomastico o semplicemente così. Acquisti il buono online in due minuti e arriva subito via e-mail.',
    list: ['<b>Scegli tu l’importo</b> — chi lo riceve sceglie il trattamento', '<b>Arriva subito</b> via e-mail, da inoltrare o stampare', '<b>Salva l’ultimo minuto</b> — anche cinque minuti prima della festa'],
    amount: '20 000 Ft', vTitle: 'Regalo di benessere', vText: 'Si acquista online, arriva via e-mail.', vLabel: 'Acquista un buono',
    small: 'Domande sul buono? Rispondi a questa e-mail e ti aiutiamo.',
  },
  winback: {
    title: 'Ci manchi', desc: 'E-mail di ritorno con regalo — per chi non viene da 90 giorni', subject: 'Ci manchi! Ti aspetta una sorpresa',
    h: 'Da quanto tempo, {keresztnév}!',
    p: 'Dalla tua ultima visita sono cambiate tante cose: nuovi trattamenti, nuovi volti nel team — il caffè però è sempre buono. Ci piacerebbe rivederti, così abbiamo preparato una piccola sorpresa per il tuo prossimo appuntamento.',
    list: ['<b>Maschera in omaggio</b> con il prossimo trattamento', 'Prenoti in pochi clic, anche di notte', 'Modifichi o annulli l’appuntamento quando vuoi'],
    btn: 'Torno — prenota ora', small: 'La sorpresa vale per le prenotazioni fatte entro 30 giorni da questa e-mail.',
  },
  news: {
    title: 'Novità', desc: 'Presenta un nuovo servizio o una nuova persona — con due foto', subject: 'Novità nel salone: ricostruzione alla cheratina',
    h: 'Ti presentiamo: la ricostruzione alla cheratina',
    p: 'Ciao {keresztnév}, se i tuoi capelli sono fragili, crespi o semplicemente stanchi, questo fa per te. Il trattamento ricostruisce ogni capello dall’interno — senti la differenza già dal primo lavaggio.',
    list: ['<b>Capelli lucidi e morbidi</b> dal primo trattamento', '<b>Delicato</b> anche su capelli colorati e decolorati', '<b>Prezzo di lancio</b> fino a fine mese'],
    btn: 'Voglio provarlo — prenota', small: 'Non sai se fa per te? Prenota una consulenza gratuita e lo valutiamo insieme.',
  },
  hours: {
    title: 'Orari delle feste', desc: 'Orari, breve avviso, grazie per l’anno', subject: 'Orari delle feste — prenota finché c’è posto',
    h: 'Belle per le feste — ecco i nostri orari',
    p: 'Ciao {keresztnév}, grazie per averci scelto anche quest’anno. Le settimane prima delle feste si riempiono in fretta ogni anno — ecco i nostri orari, prenota per tempo.',
    list: ['<b>Fino al 23 dic.:</b> aperti tutti i giorni fino alle 20', '<b>24–26 dic.:</b> chiuso', '<b>Dal 2 gen.:</b> orario abituale'],
    btn: 'Prenota un appuntamento', small: 'Buone feste da tutto il nostro team!',
  },
  special: {
    title: 'Regalo di compleanno', desc: 'Auguri personali con sconto — per chi compie gli anni', subject: 'Buon compleanno! Ti abbiamo portato un regalo',
    h: 'Buon compleanno, {keresztnév}!', p: 'Festeggiati con un po’ di coccole. Nel mese del tuo compleanno hai il 20% di sconto su qualsiasi trattamento — perché te lo meriti.',
    btn: 'Riscatta il mio regalo', small: 'Lo sconto vale per gli appuntamenti nel mese del tuo compleanno e non è cumulabile con altre offerte.',
  },
}

const IT_REST: TemplateCopy = {
  promo: {
    title: 'Offerta di stagione', desc: 'Nuova stagione, piatti in offerta, pulsante di prenotazione', subject: 'È arrivata la stagione della selvaggina — due piatti a prezzo speciale',
    h: 'È arrivata la stagione della selvaggina. Assaggia prima questo.',
    p: 'Ciao {keresztnév}, i migliori sapori del bosco sono in menu: spezzatino di cervo cotto lentamente, cinghiale con mele cotogne e risotto ai funghi di bosco. Questa settimana due dei nostri piatti preferiti sono a prezzo speciale — così non ne senti solo parlare, ma li assaggi.',
    sub: 'Perché venire ora?', list: ['<b>Piatti di stagione</b> con selvaggina locale, solo per poche settimane', '<b>Abbinamento vini</b> consigliato dal nostro sommelier', '<b>Venerdì e sabato sera</b> musica dal vivo in terrazza'],
    offers: [['Tagliere di selvaggina per due', '18 900 Ft', '16 500 Ft'], ['Abbinamento, 3 calici', '6 900 Ft', '5 900 Ft']], btn: 'Prenota un tavolo',
    small: 'Offerta valida fino a domenica, fino a esaurimento. Le serate del weekend si riempiono in fretta — prenota ora.',
  },
  voucher: {
    title: 'Buono regalo', desc: 'Per feste e compleanni — con buono acquistabile', subject: 'Un’idea regalo che non sbaglia mai: una cena insieme',
    h: 'Regala una serata da ricordare a lungo',
    p: 'Ciao {keresztnév}, smetti di cercare: una buona cena da noi è sempre un successo — per un compleanno, un anniversario o semplicemente così. Acquisti il buono online in due minuti e arriva subito via e-mail.',
    list: ['<b>Scegli tu l’importo</b> — chi lo riceve sceglie la serata', '<b>Arriva subito</b> via e-mail, da inoltrare o stampare', '<b>Salva l’ultimo minuto</b> — anche cinque minuti prima della festa'],
    amount: '24 000 Ft', vTitle: 'Cena per due', vText: 'Si acquista online, arriva via e-mail.', vLabel: 'Acquista un buono',
    small: 'Domande sul buono? Rispondi a questa e-mail e ti aiutiamo.',
  },
  winback: {
    title: 'Ci manchi', desc: 'E-mail di ritorno con regalo — per chi non viene da 90 giorni', subject: 'Ci manchi! Ecco come ti diamo il bentornato',
    h: 'Da quanto tempo, {keresztnév}!',
    p: 'Dalla tua ultima visita sono cambiate tante cose: il menu è nuovo e in terrazza ti aspetta un tavolo. Ci piacerebbe ospitarti di nuovo, così abbiamo preparato una piccola sorpresa per la tua prossima cena.',
    list: ['<b>Il dolce lo offriamo noi</b> se prenoti entro due settimane', 'Prenoti in pochi clic, a qualsiasi ora', 'Modifichi o annulli la prenotazione quando vuoi'],
    btn: 'Torno — prenota un tavolo', small: 'La sorpresa vale per le prenotazioni fatte entro 30 giorni da questa e-mail.',
  },
  news: {
    title: 'Novità', desc: 'Nuovo menu, evento, degustazione — con due foto', subject: 'Nuovo menu e serate di degustazione — devi vederlo',
    h: 'È arrivato il menu d’autunno',
    p: 'Ciao {keresztnév}, cuciniamo con ingredienti locali di stagione e metà del menu è completamente nuova. Il giovedì organizziamo serate di degustazione: quattro vini, quattro piccoli piatti, una bella chiacchierata.',
    list: ['<b>Piatti nuovi</b> ogni settimana tra i suggerimenti del giorno', '<b>Degustazione di vini</b> il giovedì dalle 19', '<b>Opzioni vegetariane e senza glutine</b>'],
    btn: 'Prenota un tavolo', small: 'I posti per le degustazioni sono limitati — meglio prenotare in anticipo.',
  },
  hours: {
    title: 'Orari delle feste', desc: 'Orari, breve avviso, grazie per l’anno', subject: 'Orari delle feste e menu di Capodanno',
    h: 'Le feste con noi — ecco i nostri orari',
    p: 'Ciao {keresztnév}, grazie per aver festeggiato con noi anche quest’anno. Ecco i nostri orari durante le feste, e a Capodanno salutiamo l’anno con un menu di cinque portate.',
    list: ['<b>24–26 dic.:</b> chiuso', '<b>31 dic.:</b> menu di Capodanno dalle 18 — solo su prenotazione', '<b>Dal 2 gen.:</b> orario abituale'],
    btn: 'Prenota un tavolo', small: 'Buone feste da tutto il nostro team!',
  },
  special: {
    title: 'Evento aziendale', desc: 'Cena di fine anno, cena di team — per clienti aziendali', subject: 'Cena di fine anno o di team? Pensiamo a tutto noi',
    h: 'Una cena di fine anno di cui il team parlerà anche l’anno prossimo',
    p: 'Ciao {keresztnév}, la fine dell’anno si avvicina — se stai organizzando una cena di team o aziendale, lascia fare a noi. Dal menu ai vini organizziamo tutto, tu devi solo arrivare.',
    list: ['<b>Menu su misura</b> secondo i gusti e il numero del team', '<b>Sala privata</b> o l’intero ristorante', '<b>Fattura intestata all’azienda</b>, con un solo referente'],
    btn: 'Richiedi un preventivo', small: 'I venerdì di dicembre si riempiono per primi — scrivici ora e blocchiamo la data.',
  },
}

const FR_SALON: TemplateCopy = {
  promo: {
    title: 'Offre de saison', desc: 'Remise avec date limite, offres avec prix, bouton de réservation', subject: 'Renouveau d’automne −15 % — jusqu’au 31 octobre seulement',
    h: 'Nouvelle saison, nouveau look — maintenant à −15 %',
    p: 'Bonjour {keresztnév}, le soleil, le sel et le chlore de l’été laissent des traces sur les cheveux. Jusqu’au 31 octobre, profitez de 15 % de remise sur chaque coloration, balayage et soin réparateur, pour que vos cheveux entrent dans l’automne brillants et en pleine santé.',
    sub: 'Ce qui vous attend', list: ['<b>−15 %</b> sur toute coloration et tout balayage', '<b>Masque offert</b> avec chaque soin', '<b>Conseil couleur personnalisé</b> avant de décider'],
    offers: [['Balayage + coupe', '48 000 Ft', '40 800 Ft'], ['Racines + brushing', '22 000 Ft', '18 700 Ft']], btn: 'Réserver mon rendez-vous',
    small: 'La remise s’applique aux rendez-vous réservés avant le 31 octobre. Les après-midi partent en premier — choisissez le vôtre tant qu’il reste de la place.',
  },
  voucher: {
    title: 'Carte cadeau', desc: 'Pour les fêtes et les anniversaires — avec carte cadeau à acheter', subject: 'Une idée cadeau qui fait toujours plaisir : une heure rien que pour elle',
    h: 'Offrez une heure à consacrer à soi',
    p: 'Bonjour {keresztnév}, inutile de chercher plus loin : un soin chez nous fait toujours plaisir — pour un anniversaire, une fête ou simplement comme ça. La carte s’achète en ligne en deux minutes et arrive aussitôt par e-mail.',
    list: ['<b>Vous choisissez le montant</b> — la personne choisit son soin', '<b>Arrive aussitôt</b> par e-mail, à transférer ou imprimer', '<b>La solution de dernière minute</b> — même cinq minutes avant la fête'],
    amount: '20 000 Ft', vTitle: 'Cadeau bien-être', vText: 'Achetée en ligne, envoyée par e-mail.', vLabel: 'Acheter une carte',
    small: 'Une question sur la carte cadeau ? Répondez à cet e-mail, nous vous aidons.',
  },
  winback: {
    title: 'Vous nous manquez', desc: 'E-mail de reconquête avec cadeau — pour qui n’est pas venu depuis 90 jours', subject: 'Vous nous manquez ! Une petite surprise vous attend',
    h: 'Cela fait longtemps, {keresztnév} !',
    p: 'Depuis votre dernière visite, beaucoup de choses ont changé : nouveaux soins, nouveaux visages dans l’équipe — le café est toujours aussi bon. Nous aimerions vous revoir, alors une petite surprise vous attend à votre prochain rendez-vous.',
    list: ['<b>Masque offert</b> avec votre prochain soin', 'Réservez en quelques clics, même la nuit', 'Modifiez ou annulez votre rendez-vous à tout moment'],
    btn: 'Je reviens — réserver', small: 'La surprise est valable pour les réservations faites dans les 30 jours suivant cet e-mail.',
  },
  news: {
    title: 'Nouveauté', desc: 'Présentez un nouveau soin ou une nouvelle personne — avec deux photos', subject: 'Nouveau au salon : la reconstruction à la kératine',
    h: 'Découvrez : la reconstruction à la kératine',
    p: 'Bonjour {keresztnév}, si vos cheveux sont cassants, frisottants ou simplement fatigués, ce soin est fait pour vous. Il reconstruit chaque cheveu de l’intérieur — la différence se sent dès le premier shampooing.',
    list: ['<b>Cheveux brillants et doux</b> dès le premier soin', '<b>Doux</b> aussi pour les cheveux colorés et décolorés', '<b>Prix de lancement</b> jusqu’à la fin du mois'],
    btn: 'Je veux essayer — réserver', small: 'Vous hésitez ? Réservez une consultation gratuite, nous verrons ensemble sur place.',
  },
  hours: {
    title: 'Horaires des fêtes', desc: 'Horaires, court message, merci pour l’année', subject: 'Horaires des fêtes — réservez tant qu’il reste de la place',
    h: 'Belle pour les fêtes — voici nos horaires',
    p: 'Bonjour {keresztnév}, merci de nous avoir choisis encore cette année. Les semaines avant les fêtes se remplissent vite chaque année — voici nos horaires, réservez à temps.',
    list: ['<b>Jusqu’au 23 déc. :</b> ouvert tous les jours jusqu’à 20 h', '<b>24–26 déc. :</b> fermé', '<b>À partir du 2 janv. :</b> horaires habituels'],
    btn: 'Prendre rendez-vous', small: 'Joyeuses fêtes de la part de toute l’équipe !',
  },
  special: {
    title: 'Cadeau d’anniversaire', desc: 'Message personnel avec remise — pour les anniversaires', subject: 'Joyeux anniversaire ! Nous avons un cadeau pour vous',
    h: 'Joyeux anniversaire, {keresztnév} !', p: 'Célébrez-vous avec un moment de douceur. Pendant le mois de votre anniversaire, profitez de 20 % sur tous nos soins — parce que vous le méritez.',
    btn: 'Utiliser mon cadeau', small: 'La remise s’applique aux rendez-vous du mois de votre anniversaire et n’est pas cumulable avec d’autres offres.',
  },
}

const FR_REST: TemplateCopy = {
  promo: {
    title: 'Offre de saison', desc: 'Nouvelle saison, plats en promotion, bouton de réservation', subject: 'La saison du gibier est là — deux plats à prix spécial',
    h: 'La saison du gibier est là. Goûtez d’abord ceci.',
    p: 'Bonjour {keresztnév}, les meilleures saveurs de la forêt arrivent à la carte : ragoût de cerf mijoté, sanglier aux coings et risotto aux champignons des bois. Cette semaine, deux de nos plats préférés sont à prix spécial — pour que vous ne fassiez pas qu’en entendre parler, mais que vous les goûtiez.',
    sub: 'Pourquoi venir maintenant ?', list: ['<b>Plats de saison</b> au gibier local, quelques semaines seulement', '<b>Accord mets et vins</b> conseillé par notre sommelier', '<b>Vendredi et samedi soir</b> musique live en terrasse'],
    offers: [['Plateau de gibier pour deux', '18 900 Ft', '16 500 Ft'], ['Accord vins, 3 verres', '6 900 Ft', '5 900 Ft']], btn: 'Réserver une table',
    small: 'Offre valable jusqu’à dimanche, dans la limite des stocks. Les soirs de week-end se remplissent vite — réservez dès maintenant.',
  },
  voucher: {
    title: 'Carte cadeau', desc: 'Pour les fêtes et les anniversaires — avec carte cadeau à acheter', subject: 'Une idée cadeau qui fait toujours plaisir : un dîner à deux',
    h: 'Offrez une soirée dont on se souviendra longtemps',
    p: 'Bonjour {keresztnév}, inutile de chercher plus loin : un bon dîner chez nous fait toujours plaisir — pour un anniversaire, une fête ou simplement comme ça. La carte s’achète en ligne en deux minutes et arrive aussitôt par e-mail.',
    list: ['<b>Vous choisissez le montant</b> — la personne choisit sa soirée', '<b>Arrive aussitôt</b> par e-mail, à transférer ou imprimer', '<b>La solution de dernière minute</b> — même cinq minutes avant la fête'],
    amount: '24 000 Ft', vTitle: 'Dîner pour deux', vText: 'Achetée en ligne, envoyée par e-mail.', vLabel: 'Acheter une carte',
    small: 'Une question sur la carte cadeau ? Répondez à cet e-mail, nous vous aidons.',
  },
  winback: {
    title: 'Vous nous manquez', desc: 'E-mail de reconquête avec cadeau — pour qui n’est pas venu depuis 90 jours', subject: 'Vous nous manquez ! Voici comment nous vous accueillons',
    h: 'Cela fait longtemps, {keresztnév} !',
    p: 'Depuis votre dernière visite, beaucoup de choses ont changé : la carte est nouvelle et une table vous attend en terrasse. Nous aimerions vous recevoir à nouveau, alors une petite surprise vous attend à votre prochain dîner.',
    list: ['<b>Le dessert est offert</b> si vous réservez sous deux semaines', 'Réservez en quelques clics, à toute heure', 'Modifiez ou annulez votre réservation à tout moment'],
    btn: 'Je reviens — réserver une table', small: 'La surprise est valable pour les réservations faites dans les 30 jours suivant cet e-mail.',
  },
  news: {
    title: 'Nouveauté', desc: 'Nouvelle carte, événement, dégustation — avec deux photos', subject: 'Nouvelle carte et soirées dégustation — à ne pas manquer',
    h: 'Notre carte d’automne est arrivée',
    p: 'Bonjour {keresztnév}, nous cuisinons des produits locaux de saison, et la moitié de la carte est entièrement nouvelle. Le jeudi, nous organisons des soirées dégustation : quatre vins, quatre petites assiettes, une belle conversation.',
    list: ['<b>Nouveaux plats</b> chaque semaine dans les suggestions du jour', '<b>Dégustation de vins</b> le jeudi dès 19 h', '<b>Options végétariennes et sans gluten</b>'],
    btn: 'Réserver une table', small: 'Les places pour les dégustations sont limitées — mieux vaut réserver à l’avance.',
  },
  hours: {
    title: 'Horaires des fêtes', desc: 'Horaires, court message, merci pour l’année', subject: 'Horaires des fêtes et menu du Nouvel An',
    h: 'Les fêtes chez nous — voici nos horaires',
    p: 'Bonjour {keresztnév}, merci d’avoir fêté avec nous encore cette année. Voici nos horaires pendant les fêtes, et pour le Nouvel An nous terminons l’année avec un menu en cinq plats.',
    list: ['<b>24–26 déc. :</b> fermé', '<b>31 déc. :</b> menu du Nouvel An dès 18 h — sur réservation uniquement', '<b>À partir du 2 janv. :</b> horaires habituels'],
    btn: 'Réserver une table', small: 'Joyeuses fêtes de la part de toute l’équipe !',
  },
  special: {
    title: 'Événement d’entreprise', desc: 'Repas de fin d’année, dîner d’équipe — pour les clients professionnels', subject: 'Fin d’année ou dîner d’équipe ? Nous nous occupons de tout',
    h: 'Un dîner de fin d’année dont l’équipe parlera encore l’an prochain',
    p: 'Bonjour {keresztnév}, la fin de l’année approche — si vous préparez un dîner d’équipe ou une soirée de fin d’année, laissez-nous faire. Du menu aux vins, nous organisons tout, vous n’avez plus qu’à venir.',
    list: ['<b>Menu sur mesure</b> selon les goûts et la taille de l’équipe', '<b>Salle privée</b> ou tout le restaurant', '<b>Facture au nom de l’entreprise</b>, un seul interlocuteur'],
    btn: 'Demander un devis', small: 'Les vendredis de décembre partent en premier — écrivez-nous maintenant et nous bloquons la date.',
  },
}

const COPY: Record<Locale, [TemplateCopy, TemplateCopy]> = {
  hu: [HU_SALON, HU_REST], en: [EN_SALON, EN_REST], de: [DE_SALON, DE_REST], es: [ES_SALON, ES_REST], it: [IT_SALON, IT_REST], fr: [FR_SALON, FR_REST],
}

/** a sablonok szövege az adott nyelven (szalon / étterem) */
export const templateCopy = (locale: Locale, restaurant: boolean): TemplateCopy => COPY[locale][restaurant ? 1 : 0]
