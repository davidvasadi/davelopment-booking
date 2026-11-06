import type { Locale } from '@/lib/i18n'

/**
 * Beállítások › Vendég e-mailek › „Sablon betöltése” (design 16.6): a vendég-levelek kész szövege — szalonnak (időpont)
 * és étteremnek (asztal) külön, minden nyelven. Rövid, tegező (a német / spanyol / olasz is), a foglalás adatai (nap,
 * idő, szolgáltatás / létszám) a levélben úgyis ott vannak alatta, ezért a szöveg nem ismétli őket — a hangulatot és a
 * teendőt adja. Változók: {{name}} vendég, {{business}} üzlet, {{service}} / {{staff}} (szalon), {{pax}} (étterem).
 */
export type TemplatePara = { type: 'subtitle' | 'text'; text: string }
export type GuestEmailTemplate = { subject: string; paras: TemplatePara[] }
export type GuestEmailKind = 'confirm' | 'reminder' | 'cancel' | 'feedback'
type Variant = 'salon' | 'restaurant'

const t = (subject: string, title: string, ...texts: string[]): GuestEmailTemplate => ({ subject, paras: [{ type: 'subtitle', text: title }, ...texts.map((text) => ({ type: 'text' as const, text }))] })

export const GUEST_EMAIL_TEMPLATES: Record<GuestEmailKind, Record<Variant, Record<Locale, GuestEmailTemplate>>> = {
  confirm: {
    salon: {
      hu: t('Időpontod lefoglalva · {{business}}', 'Várunk szeretettel, {{name}}!',
        'Lefoglaltuk az időpontodat ({{service}}). A részleteket lent találod, és egy kattintással a naptáradba is felveheted.',
        'Ha először jössz, lent az útvonaltervet is megtalálod. Kérünk, érkezz pár perccel korábban.'),
      en: t('Your appointment is booked · {{business}}', 'See you soon, {{name}}!',
        "Your appointment ({{service}}) is confirmed. You'll find the details below — add it to your calendar in one click.",
        "First time with us? You'll find directions below. Please arrive a few minutes early."),
      de: t('Dein Termin ist gebucht · {{business}}', 'Wir freuen uns auf dich, {{name}}!',
        'Dein Termin ({{service}}) ist bestätigt. Alle Details findest du unten — mit einem Klick auch in deinem Kalender.',
        'Zum ersten Mal bei uns? Die Wegbeschreibung findest du unten. Bitte komm ein paar Minuten früher.'),
      es: t('Tu cita está reservada · {{business}}', '¡Te esperamos, {{name}}!',
        'Tu cita ({{service}}) está confirmada. Abajo tienes todos los detalles; añádela a tu calendario con un clic.',
        '¿Es tu primera vez? Abajo tienes cómo llegar. Te pedimos que llegues unos minutos antes.'),
      it: t('Il tuo appuntamento è prenotato · {{business}}', 'Ti aspettiamo, {{name}}!',
        'Il tuo appuntamento ({{service}}) è confermato. Trovi tutti i dettagli qui sotto: aggiungilo al calendario con un clic.',
        'È la prima volta? Qui sotto trovi le indicazioni stradali. Ti chiediamo di arrivare qualche minuto prima.'),
      fr: t('Votre rendez-vous est réservé · {{business}}', 'À très bientôt, {{name}} !',
        'Votre rendez-vous ({{service}}) est confirmé. Tous les détails sont ci-dessous ; ajoutez-le à votre agenda en un clic.',
        "Première visite ? L'itinéraire est indiqué ci-dessous. Merci d'arriver quelques minutes en avance."),
    },
    restaurant: {
      hu: t('Asztalfoglalás visszaigazolva · {{business}}', 'Várunk szeretettel, {{name}}!',
        'Lefoglaltuk az asztalt {{pax}} főre. A részleteket lent találod, és egy kattintással a naptáradba is felveheted.',
        'Lent az útvonaltervet is megtalálod. Ha késnétek vagy változik a létszám, kérjük, jelezd nekünk.'),
      en: t('Your table is booked · {{business}}', 'We look forward to seeing you, {{name}}!',
        "Your table for {{pax}} is confirmed. You'll find the details below — add it to your calendar in one click.",
        "You'll find directions below. If you're running late or your party size changes, please let us know."),
      de: t('Dein Tisch ist reserviert · {{business}}', 'Wir freuen uns auf euch, {{name}}!',
        'Dein Tisch für {{pax}} Personen ist bestätigt. Alle Details findest du unten — mit einem Klick auch in deinem Kalender.',
        'Die Wegbeschreibung findest du unten. Wenn ihr später kommt oder sich die Personenzahl ändert, gib uns bitte Bescheid.'),
      es: t('Tu mesa está reservada · {{business}}', '¡Os esperamos, {{name}}!',
        'Tu mesa para {{pax}} está confirmada. Abajo tienes todos los detalles; añádela a tu calendario con un clic.',
        'Abajo tienes cómo llegar. Si vais a llegar tarde o cambia el número de personas, avísanos.'),
      it: t('Il tuo tavolo è prenotato · {{business}}', 'Vi aspettiamo, {{name}}!',
        'Il tuo tavolo per {{pax}} è confermato. Trovi tutti i dettagli qui sotto: aggiungilo al calendario con un clic.',
        'Qui sotto trovi le indicazioni stradali. Se siete in ritardo o cambia il numero di persone, avvisaci.'),
      fr: t('Votre table est réservée · {{business}}', 'Au plaisir de vous accueillir, {{name}} !',
        'Votre table pour {{pax}} est confirmée. Tous les détails sont ci-dessous ; ajoutez-la à votre agenda en un clic.',
        "L'itinéraire est indiqué ci-dessous. En cas de retard ou si le nombre de convives change, prévenez-nous."),
    },
  },
  reminder: {
    salon: {
      hu: t('Hamarosan találkozunk · {{business}}', 'Hamarosan találkozunk, {{name}}!',
        'Csak egy gyors emlékeztető: közeleg az időpontod ({{service}}). A pontos részleteket lent találod.',
        'Az útvonaltervet lent találod. Ha közbejött valami, kérjük, mondd le időben — így más vendégünk kaphatja meg a helyet.'),
      en: t('See you soon · {{business}}', 'See you soon, {{name}}!',
        'Just a quick reminder: your appointment ({{service}}) is coming up. All the details are below.',
        "Directions are below. If something has come up, please cancel in time so another guest can take the slot."),
      de: t('Bis bald · {{business}}', 'Bis bald, {{name}}!',
        'Nur eine kurze Erinnerung: Dein Termin ({{service}}) steht bevor. Alle Details findest du unten.',
        'Die Wegbeschreibung findest du unten. Falls etwas dazwischengekommen ist, sag bitte rechtzeitig ab — dann kann jemand anderes den Platz nutzen.'),
      es: t('Nos vemos pronto · {{business}}', '¡Nos vemos pronto, {{name}}!',
        'Un recordatorio rápido: se acerca tu cita ({{service}}). Abajo tienes todos los detalles.',
        'Abajo tienes cómo llegar. Si te ha surgido algo, cancela a tiempo para que otra persona pueda aprovechar el hueco.'),
      it: t('A presto · {{business}}', 'A presto, {{name}}!',
        'Un breve promemoria: il tuo appuntamento ({{service}}) si avvicina. Trovi tutti i dettagli qui sotto.',
        'Qui sotto trovi le indicazioni stradali. Se hai un imprevisto, annulla per tempo, così il posto va a un altro cliente.'),
      fr: t('À très bientôt · {{business}}', 'À très bientôt, {{name}} !',
        'Petit rappel : votre rendez-vous ({{service}}) approche. Tous les détails sont ci-dessous.',
        'L’itinéraire est indiqué ci-dessous. En cas d’empêchement, annulez à temps pour libérer le créneau.'),
    },
    restaurant: {
      hu: t('Hamarosan várunk · {{business}}', 'Hamarosan találkozunk, {{name}}!',
        'Emlékeztetünk az asztalfoglalásodra ({{pax}} fő). A pontos időpontot lent találod.',
        'Az útvonaltervet lent találod. Ha változik a létszám vagy közbejött valami, kérjük, jelezd időben.'),
      en: t('See you soon · {{business}}', 'See you soon, {{name}}!',
        'A quick reminder of your table booking for {{pax}}. The exact time is below.',
        'Directions are below. If your party size changes or something comes up, please let us know in time.'),
      de: t('Bis bald · {{business}}', 'Bis bald, {{name}}!',
        'Eine kurze Erinnerung an deine Tischreservierung für {{pax}} Personen. Die genaue Uhrzeit findest du unten.',
        'Die Wegbeschreibung findest du unten. Wenn sich die Personenzahl ändert oder etwas dazwischenkommt, gib uns bitte rechtzeitig Bescheid.'),
      es: t('Os esperamos pronto · {{business}}', '¡Nos vemos pronto, {{name}}!',
        'Te recordamos tu reserva de mesa para {{pax}}. Abajo tienes la hora exacta.',
        'Abajo tienes cómo llegar. Si cambia el número de personas o surge algo, avísanos a tiempo.'),
      it: t('Vi aspettiamo presto · {{business}}', 'A presto, {{name}}!',
        'Ti ricordiamo la prenotazione del tavolo per {{pax}}. L’orario esatto è qui sotto.',
        'Qui sotto trovi le indicazioni stradali. Se cambia il numero di persone o hai un imprevisto, avvisaci per tempo.'),
      fr: t('À très bientôt · {{business}}', 'À très bientôt, {{name}} !',
        'Petit rappel de votre réservation de table pour {{pax}}. L’heure exacte est indiquée ci-dessous.',
        'L’itinéraire est indiqué ci-dessous. Si le nombre de convives change ou en cas d’empêchement, prévenez-nous à temps.'),
    },
  },
  cancel: {
    salon: {
      hu: t('Időpontod lemondva · {{business}}', 'Lemondtuk az időpontodat',
        'Kedves {{name}}! A lent látható időpontot töröltük, további teendőd nincs.',
        'Ha új időpontot keresel, a lenti gombbal bármikor választhatsz — szívesen látunk legközelebb.'),
      en: t('Appointment cancelled · {{business}}', 'Your appointment has been cancelled',
        "Hi {{name}}, the appointment below has been cancelled — there's nothing else you need to do.",
        "Looking for a new time? Pick one any time with the button below — we'd love to see you next time."),
      de: t('Termin storniert · {{business}}', 'Dein Termin wurde storniert',
        'Hallo {{name}}, der Termin unten ist storniert — du musst nichts weiter tun.',
        'Du suchst einen neuen Termin? Wähle jederzeit mit dem Button unten einen aus — wir freuen uns auf dich.'),
      es: t('Cita cancelada · {{business}}', 'Hemos cancelado tu cita',
        'Hola {{name}}, la cita de abajo está cancelada; no tienes que hacer nada más.',
        '¿Buscas otro momento? Elige uno cuando quieras con el botón de abajo. ¡Te esperamos la próxima vez!'),
      it: t('Appuntamento annullato · {{business}}', 'Il tuo appuntamento è stato annullato',
        'Ciao {{name}}, l’appuntamento qui sotto è stato annullato: non devi fare altro.',
        'Cerchi un nuovo orario? Scegline uno quando vuoi con il pulsante qui sotto. Ti aspettiamo la prossima volta!'),
      fr: t('Rendez-vous annulé · {{business}}', 'Votre rendez-vous a été annulé',
        "Bonjour {{name}}, le rendez-vous ci-dessous a bien été annulé ; vous n'avez rien d'autre à faire.",
        'Envie de reprendre rendez-vous ? Choisissez un créneau quand vous voulez avec le bouton ci-dessous.'),
    },
    restaurant: {
      hu: t('Asztalfoglalás lemondva · {{business}}', 'Lemondtuk a foglalásodat',
        'Kedves {{name}}! A lent látható asztalfoglalást töröltük, további teendőd nincs.',
        'Ha másik napon jönnétek, a lenti gombbal bármikor foglalhatsz új asztalt — szívesen látunk!'),
      en: t('Booking cancelled · {{business}}', 'Your booking has been cancelled',
        "Hi {{name}}, the table booking below has been cancelled — there's nothing else you need to do.",
        "Fancy another day? Book a new table any time with the button below — we'd love to have you."),
      de: t('Reservierung storniert · {{business}}', 'Deine Reservierung wurde storniert',
        'Hallo {{name}}, die Tischreservierung unten ist storniert — du musst nichts weiter tun.',
        'Lieber an einem anderen Tag? Reserviere jederzeit mit dem Button unten einen neuen Tisch — wir freuen uns auf euch.'),
      es: t('Reserva cancelada · {{business}}', 'Hemos cancelado tu reserva',
        'Hola {{name}}, la reserva de mesa de abajo está cancelada; no tienes que hacer nada más.',
        '¿Otro día? Reserva una nueva mesa cuando quieras con el botón de abajo. ¡Os esperamos!'),
      it: t('Prenotazione annullata · {{business}}', 'La tua prenotazione è stata annullata',
        'Ciao {{name}}, la prenotazione del tavolo qui sotto è stata annullata: non devi fare altro.',
        'Un altro giorno? Prenota un nuovo tavolo quando vuoi con il pulsante qui sotto. Vi aspettiamo!'),
      fr: t('Réservation annulée · {{business}}', 'Votre réservation a été annulée',
        "Bonjour {{name}}, la réservation de table ci-dessous a bien été annulée ; vous n'avez rien d'autre à faire.",
        'Un autre jour ? Réservez une nouvelle table quand vous voulez avec le bouton ci-dessous.'),
    },
  },
  feedback: {
    salon: {
      hu: t('Hogy érezted magad nálunk? · {{business}}', 'Köszönjük, hogy nálunk jártál!',
        'Kedves {{name}}, reméljük, elégedett vagy az eredménnyel.',
        'Egy perc az egész: írd meg, milyen volt. Minden visszajelzést elolvasunk, és sokat segít abban, hogy mások is ránk találjanak.'),
      en: t('How was your visit? · {{business}}', 'Thank you for visiting us!',
        "Hi {{name}}, we hope you're happy with the result.",
        'It only takes a minute: tell us how it was. We read every review, and it really helps others find us.'),
      de: t('Wie war dein Besuch? · {{business}}', 'Danke für deinen Besuch!',
        'Hallo {{name}}, wir hoffen, du bist mit dem Ergebnis zufrieden.',
        'Es dauert nur eine Minute: Erzähl uns, wie es war. Wir lesen jede Bewertung — und sie hilft anderen, uns zu finden.'),
      es: t('¿Qué tal tu visita? · {{business}}', '¡Gracias por visitarnos!',
        'Hola {{name}}, esperamos que estés contento/a con el resultado.',
        'Solo te llevará un minuto: cuéntanos qué tal. Leemos todas las opiniones y ayudan mucho a que otros nos encuentren.'),
      it: t('Com’è andata? · {{business}}', 'Grazie per essere passato/a da noi!',
        'Ciao {{name}}, speriamo che il risultato ti sia piaciuto.',
        'Ci vuole solo un minuto: raccontaci com’è andata. Leggiamo ogni recensione e aiuta molto gli altri a trovarci.'),
      fr: t('Comment s’est passée votre visite ? · {{business}}', 'Merci pour votre visite !',
        'Bonjour {{name}}, nous espérons que le résultat vous plaît.',
        'Cela ne prend qu’une minute : dites-nous ce que vous en avez pensé. Nous lisons chaque avis, et cela aide beaucoup d’autres personnes à nous trouver.'),
    },
    restaurant: {
      hu: t('Hogy ízlett? · {{business}}', 'Köszönjük, hogy nálunk vendégeskedtetek!',
        'Kedves {{name}}, reméljük, jól éreztétek magatokat.',
        'Egy perc az egész: írd meg, milyen volt. Minden véleményt elolvasunk, és sokat segít abban, hogy mások is ránk találjanak.'),
      en: t('How was it? · {{business}}', 'Thank you for dining with us!',
        'Hi {{name}}, we hope you had a lovely time.',
        'It only takes a minute: tell us how it was. We read every review, and it really helps others find us.'),
      de: t('Wie hat es euch geschmeckt? · {{business}}', 'Danke, dass ihr bei uns wart!',
        'Hallo {{name}}, wir hoffen, ihr hattet eine schöne Zeit.',
        'Es dauert nur eine Minute: Erzähl uns, wie es war. Wir lesen jede Bewertung — und sie hilft anderen, uns zu finden.'),
      es: t('¿Qué tal la comida? · {{business}}', '¡Gracias por venir a vernos!',
        'Hola {{name}}, esperamos que lo pasarais genial.',
        'Solo te llevará un minuto: cuéntanos qué tal. Leemos todas las opiniones y ayudan mucho a que otros nos encuentren.'),
      it: t('Com’è andata? · {{business}}', 'Grazie per essere stati da noi!',
        'Ciao {{name}}, speriamo che vi siate trovati bene.',
        'Ci vuole solo un minuto: raccontaci com’è andata. Leggiamo ogni recensione e aiuta molto gli altri a trovarci.'),
      fr: t('Comment était votre repas ? · {{business}}', 'Merci d’être venus chez nous !',
        'Bonjour {{name}}, nous espérons que vous avez passé un bon moment.',
        'Cela ne prend qu’une minute : dites-nous ce que vous en avez pensé. Nous lisons chaque avis, et cela aide beaucoup d’autres personnes à nous trouver.'),
    },
  },
}

/** A levél többi blokkja a szöveg után (a betöltött sablon része, utána szabadon szerkeszthető): a foglalás adatai
 *  (tartalma a rendszeré), a gombok a foglalás linkjeire (`{{calendar_url}}`, `{{directions_url}}`, `{{review_url}}`,
 *  `{{booking_url}}`) és apró, aláhúzott linkként a lemondás / a feltételek. A változókat a kiküldés tölti
 *  (lib/email.ts, lib/restaurantEmail.ts `emailVars`). */
const LABELS: Record<Locale, { calendar: string; directions: string; cancelQ: string; cancel: string; terms: string; rebookSalon: string; rebookRestaurant: string; review: string }> = {
  hu: { calendar: 'Naptárba', directions: 'Útvonalterv', cancelQ: 'Mégsem tudsz jönni?', cancel: 'Foglalás lemondása', terms: 'Foglalási feltételek', rebookSalon: 'Új időpont', rebookRestaurant: 'Új foglalás', review: 'Értékelem' },
  en: { calendar: 'Add to calendar', directions: 'Directions', cancelQ: "Can't make it?", cancel: 'Cancel booking', terms: 'Booking terms', rebookSalon: 'Book again', rebookRestaurant: 'Book a table', review: 'Leave a review' },
  de: { calendar: 'In den Kalender', directions: 'Route', cancelQ: 'Du kannst doch nicht?', cancel: 'Buchung stornieren', terms: 'Buchungsbedingungen', rebookSalon: 'Neuer Termin', rebookRestaurant: 'Neu reservieren', review: 'Bewerten' },
  es: { calendar: 'Añadir al calendario', directions: 'Cómo llegar', cancelQ: '¿No puedes venir?', cancel: 'Cancelar reserva', terms: 'Condiciones de reserva', rebookSalon: 'Nueva cita', rebookRestaurant: 'Nueva reserva', review: 'Valorar' },
  it: { calendar: 'Aggiungi al calendario', directions: 'Indicazioni', cancelQ: 'Non riesci a venire?', cancel: 'Annulla prenotazione', terms: 'Condizioni di prenotazione', rebookSalon: 'Nuovo appuntamento', rebookRestaurant: 'Nuova prenotazione', review: 'Lascia una recensione' },
  fr: { calendar: 'Ajouter à l’agenda', directions: 'Itinéraire', cancelQ: 'Vous ne pouvez pas venir ?', cancel: 'Annuler la réservation', terms: 'Conditions de réservation', rebookSalon: 'Nouveau rendez-vous', rebookRestaurant: 'Nouvelle réservation', review: 'Donner mon avis' },
}

/** Blokk-vázlat (az azonosítót a szerkesztő adja): a sablon a szöveg + ezek. */
export type TemplateBlock =
  | TemplatePara
  | { type: 'booking_details' }
  | { type: 'button'; label: string; url: string }
  | { type: 'button_row'; items: { label: string; url: string; secondary?: boolean }[] }
  | { type: 'small'; html: string }

export function templateBlocks(kind: GuestEmailKind, variant: Variant, locale: Locale): TemplateBlock[] {
  const l = LABELS[locale]
  const tpl = GUEST_EMAIL_TEMPLATES[kind][variant][locale]
  const a = (url: string, text: string) => `<a href="${url}">${text}</a>`
  const small = (html: string): TemplateBlock => ({ type: 'small', html })
  const tail: TemplateBlock[] =
    kind === 'confirm' || kind === 'reminder' ? [
      { type: 'booking_details' },
      { type: 'button_row', items: [{ label: l.calendar, url: '{{calendar_url}}' }, { label: l.directions, url: '{{directions_url}}', secondary: true }] },
      small(`${l.cancelQ} ${a('{{cancel_url}}', l.cancel)} · ${a('{{terms_url}}', l.terms)}`),
    ]
    : kind === 'cancel' ? [
      { type: 'booking_details' },
      { type: 'button', label: variant === 'salon' ? l.rebookSalon : l.rebookRestaurant, url: '{{booking_url}}' },
    ]
    : [
      { type: 'booking_details' },
      { type: 'button', label: l.review, url: '{{review_url}}' },
    ]
  return [...tpl.paras, ...tail]
}
