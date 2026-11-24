import { useEffect, useState } from "react";
import { ArrowRight, Clock3, MoonStar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ClientPageHero from "../components/ClientPageHero";
import ReservationModal from "../components/ReservationModal";
import type { Accommodation } from "../data/accommodations";
import { useSiteContent } from "../data/SiteContentContext";
import useClientPageReveal from "../hooks/useClientPageReveal";

export default function ReservationPage() {
  useClientPageReveal(".reservation-page");
  const { content } = useSiteContent();
  const { accommodations, site } = content;
  const [searchParams] = useSearchParams();
  const requestedRoom = searchParams.get("chambre") ?? "";
  const [bookingRoom, setBookingRoom] = useState<Accommodation | null>(null);
  const publishedRooms = accommodations.filter(
    (room) => room.published && !room.provisional,
  );
  const rooms = publishedRooms.filter(
    (room) => room.price != null && Number.isFinite(room.price),
  );

  useEffect(() => {
    document.title = "Réservation — Keur Ana-Fi, Maison des Bolongs";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      "Consultez les heures officielles d’arrivée et de départ, les tarifs par nuit et les disponibilités de Keur Ana-Fi.",
    );
  }, []);

  useEffect(() => {
    const room = rooms.find((item) => item.id === requestedRoom);
    if (room) setBookingRoom(room);
  }, [accommodations, requestedRoom]);

  return (
    <main className="reservation-page client-page" id="contenu">
      <ClientPageHero
        gallerySlot="reservation-hero"
        eyebrow={site.location}
        title="Réservation"
        description={`Préparez votre séjour avec les hébergements publiés par ${site.name}.`}
      />

      <div className="reservation-layout">
        <section className="reservation-form-panel" data-client-reveal="card">
          <h2>Informations importantes</h2>
          <div className="reservation-policy-grid">
            <article data-client-reveal="card">
              <Clock3 size={20} aria-hidden="true" />
              <div>
                <strong>Arrivée à partir de 14 h 00</strong>
                <p>Choisissez votre heure estimée, à partir de 14 h.</p>
              </div>
            </article>
            <article data-client-reveal="card">
              <Clock3 size={20} aria-hidden="true" />
              <div>
                <strong>Départ avant 12 h 00</strong>
                <p>L’heure normale de départ est fixe.</p>
              </div>
            </article>
            <article data-client-reveal="card">
              <MoonStar size={20} aria-hidden="true" />
              <div>
                <strong>Tarification à la nuitée</strong>
                <p>Le jour du départ n’est pas compté comme une nuit.</p>
              </div>
            </article>
          </div>
          <p className="reservation-policy-note">
            Pour demander une arrivée avant 14 h, appelez l’établissement.
            L’arrivée anticipée ou le départ après 12 h nécessite son accord et
            dépend de la disponibilité réelle de la chambre.
            La réservation n’est confirmée qu’après vérification par
            l’établissement.
          </p>

          <h2 className="reservation-room-selection-title">Choisir une chambre</h2>
          {rooms.length ? (
            <div className="reservation-room-list">
              {rooms.map((room) => (
                <article
                  className="reservation-room-option"
                  data-client-reveal="card"
                  key={room.id}
                >
                  <div>
                    <h3>{room.name}</h3>
                    <p>
                      Tarif par nuit :{" "}
                      {new Intl.NumberFormat("fr-FR").format(room.price!)} FCFA
                    </p>
                  </div>
                  <button
                    className="button button-gold"
                    type="button"
                    onClick={() => setBookingRoom(room)}
                  >
                    Choisir <ArrowRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : publishedRooms.length ? (
            <p className="reservation-calendar-status">
              Aucun tarif en ligne n’est disponible pour les hébergements
              publiés. Contactez {site.name} pour vous renseigner.
            </p>
          ) : (
            <p className="reservation-calendar-status">
              Aucun hébergement n’est publié pour le moment. Contactez{" "}
              {site.name} pour préparer votre séjour.
            </p>
          )}
        </section>

        <aside className="reservation-aside" data-client-reveal="card">
          <span className="eyebrow">{site.name}</span>
          <h2>{site.subtitle}</h2>
          <p>
            Les disponibilités sont vérifiées par chambre. Les demandes en
            attente sont conservées temporairement et ne constituent pas une
            confirmation de séjour.
          </p>
        </aside>
      </div>

      {bookingRoom && (
        <ReservationModal
          room={bookingRoom}
          onClose={() => setBookingRoom(null)}
        />
      )}
    </main>
  );
}
