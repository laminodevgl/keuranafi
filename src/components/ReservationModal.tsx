import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Download, Minus, Plus, X } from "lucide-react";
import type { Accommodation } from "../data/accommodations";
import { useSiteContent } from "../data/SiteContentContext";
import ReservationDatePicker from "./ReservationDatePicker";
import { getErrorMessage } from "../lib/errorMessage";
import { getReservationReference } from "../lib/reservationReference";
import { supabase } from "../lib/supabase";

type ReservationModalProps = {
  room: Accommodation;
  onClose: () => void;
};

type ReservationReceipt = {
  reference: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  arrival: string;
  departure: string;
  estimatedArrivalTime: string;
  guests: number;
  roomName: string;
  pricePerNight: number;
  total: number;
};

function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Dakar",
  }).format(new Date(value));
}

function formatStayDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Africa/Dakar",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

async function downloadReservationReceiptImage(
  receipt: ReservationReceipt,
  business: {
    name: string;
    subtitle: string;
    address: string;
    phone: string;
    email: string;
  },
) {
  const width = 900;
  const padding = 64;
  const contentWidth = width - padding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 1;
  const measureContext = canvas.getContext("2d");
  if (!measureContext) throw new Error("Impossible de préparer l’image du reçu.");

  const textLines: Array<{
    text: string;
    y: number;
    font: string;
    color: string;
  }> = [];
  const rules: number[] = [];
  let y = padding;
  const addText = (
    text: string,
    font: string,
    color: string,
    lineHeight = 32,
    gap = 0,
  ) => {
    measureContext.font = font;
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureContext.measureText(candidate).width > contentWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    for (const lineText of lines) {
      textLines.push({ text: lineText, y, font, color });
      y += lineHeight;
    }
    y += gap;
  };
  const addRule = () => {
    rules.push(y);
    y += 28;
  };

  addText(`${business.name} · ${business.subtitle}`, "600 20px Arial, sans-serif", "#597061", 30, 12);
  addText("Reçu de demande de réservation", "bold 34px Arial, sans-serif", "#123d32", 44, 8);
  addText(`Référence : ${receipt.reference}`, "bold 21px Arial, sans-serif", "#214638", 30);
  addText(formatReceiptDate(receipt.createdAt), "18px Arial, sans-serif", "#555d54", 28, 12);
  addRule();
  addText("Client", "bold 22px Arial, sans-serif", "#214638", 30, 4);
  addText(receipt.customerName, "18px Arial, sans-serif", "#555d54");
  addText(receipt.customerPhone, "18px Arial, sans-serif", "#555d54", 30, 12);
  addText("Détail du séjour", "bold 22px Arial, sans-serif", "#214638", 30, 4);
  addText(`Chambre : ${receipt.roomName}`, "18px Arial, sans-serif", "#555d54");
  addText(`Arrivée : ${formatStayDate(receipt.arrival)} à partir de ${receipt.estimatedArrivalTime}`, "18px Arial, sans-serif", "#555d54");
  addText(`Départ : ${formatStayDate(receipt.departure)}`, "18px Arial, sans-serif", "#555d54");
  addText(`Voyageurs : ${receipt.guests}`, "18px Arial, sans-serif", "#555d54", 30, 12);
  addRule();
  addText(`Prix par nuit : ${formatPrice(receipt.pricePerNight)}`, "18px Arial, sans-serif", "#555d54");
  addText(`Total estimé : ${formatPrice(receipt.total)}`, "bold 24px Arial, sans-serif", "#123d32", 34, 12);
  addRule();
  addText("Coordonnées de Keur Ana-Fi", "bold 21px Arial, sans-serif", "#214638", 30, 4);
  if (business.address) addText(business.address, "18px Arial, sans-serif", "#555d54");
  if (business.phone) addText(`Téléphone : ${business.phone}`, "18px Arial, sans-serif", "#555d54");
  if (business.email) addText(business.email, "18px Arial, sans-serif", "#555d54");
  canvas.height = Math.ceil(y + padding);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer l’image du reçu.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#123d32";
  context.fillRect(0, 0, width, 14);
  context.textBaseline = "top";
  textLines.forEach((line) => {
    context.font = line.font;
    context.fillStyle = line.color;
    context.fillText(line.text, padding, line.y);
  });
  rules.forEach((ruleY) => {
    context.fillStyle = "#dcd7ca";
    context.fillRect(padding, ruleY, contentWidth, 2);
  });

  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Le fichier image du reçu n’a pas pu être créé."));
    }, "image/png");
  });
  const imageUrl = URL.createObjectURL(imageBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = imageUrl;
  downloadLink.download = `recu-reservation-${receipt.reference}.png`;
  downloadLink.click();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

export default function ReservationModal({
  room,
  onClose,
}: ReservationModalProps) {
  const { content } = useSiteContent();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState("14:00");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [calendarRefreshToken, setCalendarRefreshToken] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationReceipt, setReservationReceipt] = useState<ReservationReceipt | null>(null);
  const [receiptDownloadError, setReceiptDownloadError] = useState("");
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const maxGuests = Math.min(room.capacity ?? 50, 50);
  const maxChildren = Math.min(room.maxChildren ?? room.capacity ?? 50, maxGuests);
  const nights =
    arrival && departure && departure > arrival
      ? (Date.parse(`${departure}T00:00:00Z`) -
          Date.parse(`${arrival}T00:00:00Z`)) /
        86_400_000
      : 0;
  const totalToPay =
    room.price !== undefined && nights > 0 ? room.price * nights : null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstNameRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const arrivalDate = String(formData.get("arrival") ?? "");
    const departureDate = String(formData.get("departure") ?? "");
    const estimatedArrivalTime = String(
      formData.get("estimated_arrival_time") ?? "",
    );
    const adultCount = Number(formData.get("adults"));
    const childCount = Number(formData.get("children"));
    if (!arrivalDate || !departureDate) {
      setError("Sélectionnez d’abord l’arrivée et le départ dans le calendrier.");
      return;
    }
    if (room.price === undefined) {
      setError("Le tarif de cette chambre n’est pas encore renseigné.");
      return;
    }
    if (departureDate <= arrivalDate) {
      setError("Choisissez une date de départ postérieure à la date d’arrivée.");
      return;
    }
    if (!estimatedArrivalTime || estimatedArrivalTime < "14:00") {
      setError(
        "L’arrivée est possible à partir de 14 h 00. Pour demander une arrivée plus tôt, appelez l’établissement.",
      );
      return;
    }
    if (
      !Number.isInteger(adultCount) ||
      !Number.isInteger(childCount) ||
      adultCount < 1 ||
      childCount < 0 ||
      childCount > maxChildren ||
      adultCount + childCount > maxGuests
    ) {
      setError(
        `La chambre accepte au maximum ${maxGuests} voyageur(s), dont ${maxChildren} enfant(s).`,
      );
      return;
    }
    if (!supabase) {
      setError("Le formulaire n’est pas connecté à Supabase. Réessayez plus tard.");
      return;
    }

    const reservationTotal =
      room.price *
      ((Date.parse(`${departureDate}T00:00:00Z`) -
        Date.parse(`${arrivalDate}T00:00:00Z`)) /
        86_400_000);
    setIsSubmitting(true);
    try {
      const reservationId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const { error: insertError } = await supabase
        .from("reservation_requests")
        .insert({
          id: reservationId,
          name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName,
          phone,
          arrival: arrivalDate,
          departure: departureDate,
          guests: adultCount + childCount,
          adults: adultCount,
          children: childCount,
          estimated_arrival_time: estimatedArrivalTime,
          room: room.name,
          room_id: room.id,
          message: "",
          receipt_path: null,
          price_per_night_snapshot: room.price,
          total_amount_snapshot: reservationTotal,
        });
      if (insertError?.code === "23P01") {
        setCalendarRefreshToken((current) => current + 1);
        throw new Error(
          "Ces dates sont déjà réservées pour cette chambre. Le calendrier a été actualisé ; choisissez d’autres dates.",
        );
      }
      if (insertError) throw insertError;
      setReservationReceipt({
        reference: getReservationReference(reservationId),
        createdAt,
        customerName: `${firstName} ${lastName}`,
        customerPhone: phone,
        arrival: arrivalDate,
        departure: departureDate,
        estimatedArrivalTime,
        guests: adultCount + childCount,
        roomName: room.name,
        pricePerNight: room.price,
        total: reservationTotal,
      });
    } catch (submitError) {
      console.error("Échec de l’enregistrement de la demande de réservation.", submitError);
      setError(`Votre demande n’a pas pu être envoyée. ${getErrorMessage(submitError)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="reservation-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="reservation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={reservationReceipt ? undefined : "reservation-modal-title"}
        aria-label={reservationReceipt ? "Reçu de demande de réservation" : undefined}
      >
        {!reservationReceipt && (
          <header className="reservation-modal-header">
            <div>
              <h2 id="reservation-modal-title">Réserver une chambre</h2>
              <span className="reservation-modal-room-tag">{room.name}</span>
            </div>
            <button
              className="reservation-modal-close"
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre"
            >
              <X size={20} />
            </button>
          </header>
        )}

        {reservationReceipt ? (
          <div className="reservation-confirmation" role="status">
            <article className="reservation-receipt">
              <header>
                <span>{content.site.name} · {content.site.subtitle}</span>
                <h3>Reçu de demande de réservation</h3>
                <p className="reservation-reference">
                  Référence <strong>{reservationReceipt.reference}</strong>
                </p>
                <time dateTime={reservationReceipt.createdAt}>
                  {formatReceiptDate(reservationReceipt.createdAt)}
                </time>
              </header>
              <section>
                <h4>Client</h4>
                <p>{reservationReceipt.customerName}</p>
                <p>{reservationReceipt.customerPhone}</p>
              </section>
              <section>
                <h4>Détail du séjour</h4>
                <dl>
                  <div>
                    <dt>Chambre</dt>
                    <dd>{reservationReceipt.roomName}</dd>
                  </div>
                  <div>
                    <dt>Arrivée</dt>
                    <dd>
                      {formatStayDate(reservationReceipt.arrival)} à partir de{" "}
                      {reservationReceipt.estimatedArrivalTime}
                    </dd>
                  </div>
                  <div>
                    <dt>Départ</dt>
                    <dd>{formatStayDate(reservationReceipt.departure)}</dd>
                  </div>
                  <div>
                    <dt>Voyageurs</dt>
                    <dd>{reservationReceipt.guests}</dd>
                  </div>
                </dl>
              </section>
              <section className="reservation-receipt-total">
                <p>
                  <span>Prix par nuit</span>
                  <strong>{formatPrice(reservationReceipt.pricePerNight)}</strong>
                </p>
                <p>
                  <span>Total estimé</span>
                  <strong>{formatPrice(reservationReceipt.total)}</strong>
                </p>
              </section>
              {(content.site.address || content.site.phoneNumber || content.site.email) && (
                <footer>
                  <h4>Coordonnées de Keur Ana-Fi</h4>
                  {content.site.address && <p>{content.site.address}</p>}
                  {content.site.phoneNumber && <p>Téléphone : {content.site.phoneNumber}</p>}
                  {content.site.email && <p>{content.site.email}</p>}
                </footer>
              )}
            </article>
            <div className="reservation-confirmation-actions">
              <button
                className="button button-gold"
                type="button"
                disabled={isDownloadingReceipt}
                onClick={async () => {
                  setReceiptDownloadError("");
                  setIsDownloadingReceipt(true);
                  try {
                    await downloadReservationReceiptImage(reservationReceipt, {
                      name: content.site.name,
                      subtitle: content.site.subtitle,
                      address: content.site.address || content.site.location,
                      phone: content.site.phoneNumber,
                      email: content.site.email,
                    });
                  } catch (downloadError) {
                    console.error("Échec du téléchargement du reçu de réservation.", downloadError);
                    setReceiptDownloadError(
                      `Le reçu n’a pas pu être téléchargé : ${getErrorMessage(downloadError)}`,
                    );
                  } finally {
                    setIsDownloadingReceipt(false);
                  }
                }}
              >
                <Download size={16} aria-hidden="true" />
                {isDownloadingReceipt ? "Préparation du reçu…" : "Télécharger mon reçu"}
              </button>
              <button className="button button-outline" type="button" onClick={onClose}>
                Fermer
              </button>
            </div>
            {receiptDownloadError && (
              <p className="admin-error" role="alert">{receiptDownloadError}</p>
            )}
          </div>
        ) : (
          <form className="reservation-form" onSubmit={handleSubmit}>
            <div className="reservation-modal-form-grid">
              <div className="reservation-modal-details">
                <div className="reservation-modal-name-fields">
                  <label>
                    Prénom *
                    <input
                      ref={firstNameRef}
                      name="first_name"
                      autoComplete="given-name"
                      maxLength={49}
                      required
                    />
                  </label>
                  <label>
                    Nom *
                    <input
                      name="last_name"
                      autoComplete="family-name"
                      maxLength={49}
                      required
                    />
                  </label>
                </div>
                <label className="reservation-modal-full-width">
                  Numéro de téléphone *
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    minLength={6}
                    maxLength={30}
                    required
                  />
                </label>
                <fieldset className="reservation-calendar-fieldset reservation-modal-full-width">
                  <legend>Dates du séjour *</legend>
                  <input type="hidden" name="arrival" value={arrival} />
                  <input type="hidden" name="departure" value={departure} />
                  <ReservationDatePicker
                    roomId={room.id}
                    refreshToken={calendarRefreshToken}
                    arrival={arrival}
                    departure={departure}
                    onChange={(nextArrival, nextDeparture) => {
                      setArrival(nextArrival);
                      setDeparture(nextDeparture);
                      setError("");
                    }}
                  />
                </fieldset>
                <p className="reservation-hours-note reservation-modal-full-width">
                  Arrivée dès 14 h · départ avant 12 h.
                </p>
                <label className="reservation-modal-full-width">
                  Heure d’arrivée *
                  <input
                    name="estimated_arrival_time"
                    type="time"
                    min="14:00"
                    step="60"
                    value={estimatedArrivalTime}
                    onChange={(event) => {
                      const time = event.target.value;
                      setEstimatedArrivalTime(time);
                    }}
                    required
                  />
                </label>
                <div className="reservation-modal-count-fields reservation-modal-full-width">
                  <fieldset className="reservation-guest-counter">
                    <legend>Nombre d’adultes *</legend>
                    <button
                      type="button"
                      aria-label="Retirer un adulte"
                      disabled={adults <= 1}
                      onClick={() => setAdults((count) => Math.max(1, count - 1))}
                    >
                      <Minus size={16} />
                    </button>
                    <output aria-live="polite">{adults}</output>
                    <button
                      type="button"
                      aria-label="Ajouter un adulte"
                      disabled={adults + children >= maxGuests}
                      onClick={() => setAdults((count) => Math.min(maxGuests - children, count + 1))}
                    >
                      <Plus size={16} />
                    </button>
                    <input type="hidden" name="adults" value={adults} />
                  </fieldset>
                  <fieldset className="reservation-guest-counter">
                    <legend>Nombre d’enfants *</legend>
                    <button
                      type="button"
                      aria-label="Retirer un enfant"
                      disabled={children <= 0}
                      onClick={() => setChildren((count) => Math.max(0, count - 1))}
                    >
                      <Minus size={16} />
                    </button>
                    <output aria-live="polite">{children}</output>
                    <button
                      type="button"
                      aria-label="Ajouter un enfant"
                      disabled={children >= maxChildren || adults + children >= maxGuests}
                      onClick={() =>
                        setChildren((count) =>
                          Math.min(maxChildren, maxGuests - adults, count + 1),
                        )
                      }
                    >
                      <Plus size={16} />
                    </button>
                    <input type="hidden" name="children" value={children} />
                  </fieldset>
                </div>
              </div>
              <div className="reservation-modal-payment-column">
                <div className="reservation-modal-room-tag reservation-modal-room-card">
                  <span>Chambre sélectionnée</span>
                  <strong>{room.name}</strong>
                </div>
                <aside className="reservation-payment-instructions reservation-payment-summary">
                  <strong>Montant à régler</strong>
                  <p className="reservation-payment-total" aria-live="polite">
                    {totalToPay === null
                      ? nights > 0
                        ? "Tarif non renseigné"
                        : "Le total apparaîtra après le choix des dates"
                      : `${new Intl.NumberFormat("fr-FR").format(totalToPay)} FCFA`}
                  </p>
                  {content.site.paymentAccounts.length ? (
                    <>
                      <span className="reservation-payment-method-label">Numéros de paiement</span>
                      <ul className="reservation-payment-accounts">
                        {content.site.paymentAccounts.map((account) => {
                          const operatorNames = {
                            wave: "Wave",
                            orange_money: "Orange Money",
                            free_money: "Free Money",
                          };
                          return (
                            <li key={account.id}>
                              <strong>{operatorNames[account.operator]}</strong>
                              <a href={`tel:${account.number.replace(/[^\d+]/g, "")}`}>
                                {account.number}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : (
                    <p>Aucun numéro de paiement n’est configuré.</p>
                  )}
                </aside>
                {error && (
                  <p className="reservation-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button button-gold"
                  type="submit"
                  disabled={isSubmitting}
                >
                  <CalendarDays size={16} />
                  {isSubmitting ? "Envoi…" : "Envoyer ma demande"}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
