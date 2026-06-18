import type { Locale } from '@/lib/i18n'
import type { TermsSection } from './TermsSectionsEditor'
import type { GoodToKnowItem } from './GoodToKnowEditor'

/**
 * Nyelvenkénti kiindulási sablonok a dashboard-szerkesztőkhöz. A „Sablon betöltése"
 * a SZERKESZTÉSI nyelven (LocaleEditBar) tölti be a megfelelő nyelvű vázat, így a
 * tulajnak nem kell nulláról fordítania. FIGYELEM: a feltétel-szöveg csak váz —
 * jogi megfelelőséget (GDPR, fogyasztói jogok) a tulajnak kell biztosítania.
 * A „Szolgáltató adatai" blokkot a rendszer a Cégadatokból automatikusan hozzáadja.
 */

const TERMS: Record<Locale, TermsSection[]> = {
  hu: [
    { title: 'Általános rendelkezések', body: 'A jelen feltételek a szolgáltató által biztosított online foglalási rendszeren keresztül leadott foglalásokra vonatkoznak. A foglalás véglegesítésével a vendég elfogadja az alábbi feltételeket.' },
    { title: 'A foglalás menete', body: 'A vendég a foglaló felületen kiválasztja a kívánt időpontot és megadja a szükséges adatokat. A foglalás a visszaigazoló e-mail megérkezésével válik érvényessé.' },
    { title: 'Lemondás és módosítás', body: 'A foglalás díjmentesen lemondható vagy módosítható a megadott időpont előtt legalább 24 órával, a visszaigazoló e-mailben található linken keresztül. Késői lemondás vagy meg nem jelenés esetén a szolgáltató fenntartja a jogot a jövőbeli foglalások korlátozására.' },
    { title: 'Késés', body: 'Kérjük, érkezzen időben. A foglalt időpontot a szolgáltató 15 perc türelmi idő elteltével nem tudja garantálni.' },
    { title: 'Adatkezelés (GDPR)', body: 'A szolgáltató a foglaláshoz megadott személyes adatokat (név, e-mail, telefonszám) kizárólag a foglalás teljesítése és a kapcsolattartás céljából kezeli, a hatályos adatvédelmi jogszabályoknak (GDPR) megfelelően. Az adatokat harmadik félnek nem adja át. Az érintett bármikor kérheti adatai helyesbítését vagy törlését a megadott elérhetőségeken.' },
    { title: 'Felelősség', body: 'A szolgáltató mindent megtesz a foglalások pontos teljesítéséért, de nem vállal felelősséget az előre nem látható, működési körén kívül eső akadályokból eredő esetleges fennakadásokért.' },
    { title: 'Panaszkezelés', body: 'Esetleges panaszát a fent megadott elérhetőségeken jelezheti. A szolgáltató a panaszt kivizsgálja és észszerű határidőn belül válaszol.' },
  ],
  en: [
    { title: 'General provisions', body: 'These terms apply to bookings made through the online booking system provided by the service provider. By completing a booking, the guest accepts the terms below.' },
    { title: 'How booking works', body: 'On the booking page the guest selects the desired time and provides the required details. The booking becomes valid once the confirmation email is received.' },
    { title: 'Cancellation and changes', body: 'The booking can be cancelled or modified free of charge at least 24 hours before the chosen time, via the link in the confirmation email. In case of late cancellation or a no-show, the provider reserves the right to limit future bookings.' },
    { title: 'Lateness', body: 'Please arrive on time. The provider cannot guarantee the reserved time after a 15-minute grace period.' },
    { title: 'Data processing (GDPR)', body: 'The provider processes the personal data given for the booking (name, email, phone number) solely for the purpose of fulfilling the booking and keeping in contact, in accordance with applicable data protection law (GDPR). The data is not shared with third parties. The data subject may request the correction or deletion of their data at any time via the contact details provided.' },
    { title: 'Liability', body: 'The provider does everything possible to fulfil bookings accurately, but assumes no liability for any disruptions arising from unforeseeable obstacles outside its area of operation.' },
    { title: 'Complaints', body: 'You may raise any complaint via the contact details above. The provider will investigate the complaint and respond within a reasonable time.' },
  ],
  de: [
    { title: 'Allgemeine Bestimmungen', body: 'Diese Bedingungen gelten für Buchungen, die über das vom Dienstleister bereitgestellte Online-Buchungssystem vorgenommen werden. Mit dem Abschluss einer Buchung akzeptiert der Gast die nachstehenden Bedingungen.' },
    { title: 'Ablauf der Buchung', body: 'Auf der Buchungsseite wählt der Gast den gewünschten Termin und gibt die erforderlichen Daten an. Die Buchung wird mit dem Eingang der Bestätigungs-E-Mail gültig.' },
    { title: 'Stornierung und Änderung', body: 'Die Buchung kann bis spätestens 24 Stunden vor dem gewählten Termin kostenlos storniert oder geändert werden, über den Link in der Bestätigungs-E-Mail. Bei verspäteter Stornierung oder Nichterscheinen behält sich der Dienstleister das Recht vor, künftige Buchungen einzuschränken.' },
    { title: 'Verspätung', body: 'Bitte erscheinen Sie pünktlich. Nach einer Kulanzzeit von 15 Minuten kann der Dienstleister den reservierten Termin nicht garantieren.' },
    { title: 'Datenverarbeitung (DSGVO)', body: 'Der Dienstleister verarbeitet die für die Buchung angegebenen personenbezogenen Daten (Name, E-Mail, Telefonnummer) ausschließlich zur Durchführung der Buchung und zur Kontaktaufnahme, im Einklang mit den geltenden Datenschutzvorschriften (DSGVO). Die Daten werden nicht an Dritte weitergegeben. Die betroffene Person kann jederzeit die Berichtigung oder Löschung ihrer Daten über die angegebenen Kontaktdaten verlangen.' },
    { title: 'Haftung', body: 'Der Dienstleister unternimmt alles, um Buchungen korrekt auszuführen, übernimmt jedoch keine Haftung für etwaige Störungen durch unvorhersehbare, außerhalb seines Betriebs liegende Hindernisse.' },
    { title: 'Beschwerden', body: 'Beschwerden können Sie über die oben genannten Kontaktdaten mitteilen. Der Dienstleister prüft die Beschwerde und antwortet innerhalb einer angemessenen Frist.' },
  ],
  es: [
    { title: 'Disposiciones generales', body: 'Estas condiciones se aplican a las reservas realizadas a través del sistema de reservas en línea proporcionado por el prestador del servicio. Al completar una reserva, el cliente acepta las condiciones siguientes.' },
    { title: 'Cómo funciona la reserva', body: 'En la página de reservas el cliente selecciona la hora deseada e introduce los datos necesarios. La reserva pasa a ser válida cuando se recibe el correo de confirmación.' },
    { title: 'Cancelación y cambios', body: 'La reserva puede cancelarse o modificarse gratuitamente al menos 24 horas antes de la hora elegida, mediante el enlace del correo de confirmación. En caso de cancelación tardía o no presentación, el prestador se reserva el derecho de limitar reservas futuras.' },
    { title: 'Retrasos', body: 'Le rogamos que llegue puntual. El prestador no puede garantizar la hora reservada transcurrido un margen de cortesía de 15 minutos.' },
    { title: 'Tratamiento de datos (RGPD)', body: 'El prestador trata los datos personales facilitados para la reserva (nombre, correo electrónico, teléfono) únicamente con el fin de gestionar la reserva y mantener el contacto, de conformidad con la normativa de protección de datos aplicable (RGPD). Los datos no se comparten con terceros. El interesado puede solicitar en cualquier momento la rectificación o supresión de sus datos a través de los datos de contacto indicados.' },
    { title: 'Responsabilidad', body: 'El prestador hace todo lo posible por cumplir las reservas con precisión, pero no asume responsabilidad por las posibles incidencias derivadas de obstáculos imprevisibles ajenos a su ámbito de actividad.' },
    { title: 'Reclamaciones', body: 'Puede presentar cualquier reclamación a través de los datos de contacto indicados arriba. El prestador investigará la reclamación y responderá en un plazo razonable.' },
  ],
  it: [
    { title: 'Disposizioni generali', body: 'Le presenti condizioni si applicano alle prenotazioni effettuate tramite il sistema di prenotazione online messo a disposizione dal fornitore del servizio. Completando una prenotazione, il cliente accetta le condizioni seguenti.' },
    { title: 'Come funziona la prenotazione', body: 'Nella pagina di prenotazione il cliente seleziona l’orario desiderato e inserisce i dati richiesti. La prenotazione diventa valida con la ricezione dell’e-mail di conferma.' },
    { title: 'Cancellazione e modifiche', body: 'La prenotazione può essere annullata o modificata gratuitamente almeno 24 ore prima dell’orario scelto, tramite il link presente nell’e-mail di conferma. In caso di cancellazione tardiva o mancata presentazione, il fornitore si riserva il diritto di limitare le prenotazioni future.' },
    { title: 'Ritardi', body: 'La preghiamo di arrivare puntuale. Trascorso un periodo di tolleranza di 15 minuti, il fornitore non può garantire l’orario prenotato.' },
    { title: 'Trattamento dei dati (GDPR)', body: 'Il fornitore tratta i dati personali forniti per la prenotazione (nome, e-mail, numero di telefono) esclusivamente per l’esecuzione della prenotazione e per i contatti, nel rispetto della normativa applicabile in materia di protezione dei dati (GDPR). I dati non vengono comunicati a terzi. L’interessato può richiedere in qualsiasi momento la rettifica o la cancellazione dei propri dati tramite i recapiti indicati.' },
    { title: 'Responsabilità', body: 'Il fornitore fa tutto il possibile per eseguire le prenotazioni con precisione, ma non si assume alcuna responsabilità per eventuali disservizi derivanti da ostacoli imprevedibili al di fuori del proprio ambito operativo.' },
    { title: 'Reclami', body: 'Eventuali reclami possono essere segnalati tramite i recapiti sopra indicati. Il fornitore esaminerà il reclamo e risponderà entro un termine ragionevole.' },
  ],
  fr: [
    { title: 'Dispositions générales', body: 'Les présentes conditions s’appliquent aux réservations effectuées via le système de réservation en ligne fourni par le prestataire. En finalisant une réservation, le client accepte les conditions ci-dessous.' },
    { title: 'Déroulement de la réservation', body: 'Sur la page de réservation, le client choisit l’horaire souhaité et indique les informations requises. La réservation devient valable dès la réception de l’e-mail de confirmation.' },
    { title: 'Annulation et modification', body: 'La réservation peut être annulée ou modifiée gratuitement au moins 24 heures avant l’horaire choisi, via le lien figurant dans l’e-mail de confirmation. En cas d’annulation tardive ou d’absence, le prestataire se réserve le droit de limiter les réservations futures.' },
    { title: 'Retard', body: 'Merci d’arriver à l’heure. Passé un délai de tolérance de 15 minutes, le prestataire ne peut garantir l’horaire réservé.' },
    { title: 'Traitement des données (RGPD)', body: 'Le prestataire traite les données personnelles fournies pour la réservation (nom, e-mail, numéro de téléphone) uniquement aux fins de la réalisation de la réservation et du contact, conformément à la réglementation applicable en matière de protection des données (RGPD). Les données ne sont pas communiquées à des tiers. La personne concernée peut à tout moment demander la rectification ou la suppression de ses données via les coordonnées indiquées.' },
    { title: 'Responsabilité', body: 'Le prestataire met tout en œuvre pour exécuter les réservations avec exactitude, mais décline toute responsabilité en cas de perturbations dues à des obstacles imprévisibles échappant à son domaine d’activité.' },
    { title: 'Réclamations', body: 'Vous pouvez signaler toute réclamation via les coordonnées indiquées ci-dessus. Le prestataire examinera la réclamation et y répondra dans un délai raisonnable.' },
  ],
}

const GOOD_TO_KNOW: Record<Locale, GoodToKnowItem[]> = {
  hu: [
    { icon: 'car', title: 'Parkolás', body: 'A környéken fizetős utcai parkolás érhető el. Kérjük, tervezz pár perc ráhagyást az érkezéshez.' },
    { icon: 'clock', title: 'Érkezés', body: 'Kérjük, érkezz néhány perccel a foglalt időpont előtt, hogy időben elkezdhessük.' },
    { icon: 'calendar', title: 'Módosítás', body: 'A foglalásod a visszaigazoló e-mailben található linken keresztül bármikor módosíthatod vagy lemondhatod.' },
  ],
  en: [
    { icon: 'car', title: 'Parking', body: 'Paid street parking is available nearby. Please allow a few extra minutes for arrival.' },
    { icon: 'clock', title: 'Arrival', body: 'Please arrive a few minutes before your booked time so we can start on schedule.' },
    { icon: 'calendar', title: 'Changes', body: 'You can change or cancel your booking anytime via the link in your confirmation email.' },
  ],
  de: [
    { icon: 'car', title: 'Parken', body: 'In der Umgebung gibt es kostenpflichtige Parkplätze am Straßenrand. Bitte planen Sie etwas Zeit für die Anreise ein.' },
    { icon: 'clock', title: 'Ankunft', body: 'Bitte kommen Sie einige Minuten vor Ihrem gebuchten Termin, damit wir pünktlich beginnen können.' },
    { icon: 'calendar', title: 'Änderungen', body: 'Sie können Ihre Buchung jederzeit über den Link in Ihrer Bestätigungs-E-Mail ändern oder stornieren.' },
  ],
  es: [
    { icon: 'car', title: 'Aparcamiento', body: 'Hay aparcamiento de pago en la calle cerca. Deje unos minutos de margen para llegar.' },
    { icon: 'clock', title: 'Llegada', body: 'Llegue unos minutos antes de su hora reservada para poder empezar puntualmente.' },
    { icon: 'calendar', title: 'Cambios', body: 'Puede cambiar o cancelar su reserva en cualquier momento mediante el enlace de su correo de confirmación.' },
  ],
  it: [
    { icon: 'car', title: 'Parcheggio', body: 'Nelle vicinanze è disponibile il parcheggio a pagamento su strada. La preghiamo di prevedere qualche minuto in più per l’arrivo.' },
    { icon: 'clock', title: 'Arrivo', body: 'La preghiamo di arrivare qualche minuto prima dell’orario prenotato, così da iniziare puntualmente.' },
    { icon: 'calendar', title: 'Modifiche', body: 'Può modificare o annullare la prenotazione in qualsiasi momento tramite il link presente nell’e-mail di conferma.' },
  ],
  fr: [
    { icon: 'car', title: 'Stationnement', body: 'Un stationnement payant en voirie est disponible à proximité. Prévoyez quelques minutes pour l’arrivée.' },
    { icon: 'clock', title: 'Arrivée', body: 'Merci d’arriver quelques minutes avant votre horaire réservé afin de commencer à l’heure.' },
    { icon: 'calendar', title: 'Modifications', body: 'Vous pouvez modifier ou annuler votre réservation à tout moment via le lien de votre e-mail de confirmation.' },
  ],
}

export function termsTemplate(locale: Locale): TermsSection[] {
  return (TERMS[locale] ?? TERMS.hu).map((s) => ({ ...s }))
}

export function goodToKnowTemplate(locale: Locale): GoodToKnowItem[] {
  return (GOOD_TO_KNOW[locale] ?? GOOD_TO_KNOW.hu).map((s) => ({ ...s }))
}
