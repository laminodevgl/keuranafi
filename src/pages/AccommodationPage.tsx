import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  Check,
  ChevronDown,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Accommodation } from "../data/accommodations";
import { getClientGalleryPhotos } from "../data/gallery";
import { useSiteContent } from "../data/SiteContentContext";
import { supabase } from "../lib/supabase";
import ReservationModal from "../components/ReservationModal";

type RoomAvailabilityStatus = "checking" | "available" | "unavailable" | "unknown";

type BookedRange = {
  arrival: string;
  departure: string;
};

const roomAvailabilityLabels: Record<RoomAvailabilityStatus, string> = {
  checking: "Vérification…",
  available: "Disponible aujourd’hui",
  unavailable: "Indisponible aujourd’hui",
  unknown: "Disponibilité à confirmer",
};

function getDakarDateKey() {
  const dateParts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const day = dateParts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Impossible de déterminer la date locale de l’établissement.");
  }
  return `${year}-${month}-${day}`;
}

function isBookedRange(value: unknown): value is BookedRange {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrival" in value &&
    "departure" in value &&
    typeof value.arrival === "string" &&
    typeof value.departure === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.arrival) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.departure) &&
    value.departure > value.arrival
  );
}

async function getRoomAvailability(
  roomId: string,
  today: string,
): Promise<RoomAvailabilityStatus> {
  if (!supabase) return "unknown";

  try {
    const { data, error } = await supabase.rpc(
      "get_booked_room_dates",
      { p_room_id: roomId },
    );
    if (error) throw error;
    if (!Array.isArray(data) || !data.every(isBookedRange)) {
      throw new Error("Les dates de disponibilité reçues sont invalides.");
    }

    return data.some((range) => range.arrival <= today && today < range.departure)
      ? "unavailable"
      : "available";
  } catch (error) {
    console.error(`Impossible de vérifier la disponibilité de la chambre ${roomId}.`, error);
    return "unknown";
  }
}

function RoomPhotoCarousel({
  room,
  availability,
}: {
  room: Accommodation;
  availability: RoomAvailabilityStatus;
}) {
  const photos = room.images.filter((image) => image.trim());
  if (!photos.length && room.image.trim()) photos.push(room.image);
  const [activePhoto, setActivePhoto] = useState(0);

  function showPreviousPhoto() {
    setActivePhoto((current) => (current - 1 + photos.length) % photos.length);
  }

  function showNextPhoto() {
    setActivePhoto((current) => (current + 1) % photos.length);
  }

  return (
    <div className="room-card-image-wrap">
      <span className={`room-availability-badge room-availability-${availability}`}>
        <span className="room-availability-indicator" aria-hidden="true" />
        {roomAvailabilityLabels[availability]}
      </span>
      {photos.length ? (
        <img
          className="room-card-image"
          src={photos[activePhoto]}
          alt={
            activePhoto === 0
              ? room.imageAlt
              : `${room.name} — photo ${activePhoto + 1}`
          }
          loading="lazy"
        />
      ) : (
        <div className="room-card-image-placeholder" aria-hidden="true">
          <BedDouble size={42} strokeWidth={1.2} />
        </div>
      )}
      {room.provisional && (
        <span className="image-note">Visuel d’illustration</span>
      )}
      {photos.length > 1 && (
        <div className="room-photo-controls" aria-label="Photos de la chambre">
          <button
            type="button"
            className="room-photo-arrow"
            onClick={showPreviousPhoto}
            aria-label="Afficher la photo précédente"
          >
            <ChevronLeft size={22} />
          </button>
          <span className="room-photo-counter" aria-live="polite">
            {activePhoto + 1} / {photos.length}
          </span>
          <button
            type="button"
            className="room-photo-arrow"
            onClick={showNextPhoto}
            aria-label="Afficher la photo suivante"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AccommodationPage() {
  const { content } = useSiteContent();
  const { accommodations, site } = content;
  const accommodationHeroPhoto = getClientGalleryPhotos(
    content.galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  )["accommodation-hero"];
  const publishedAccommodations = accommodations.filter(
    (room) => room.published && !room.provisional,
  );
  const roomsWithCapacity = publishedAccommodations.filter(
    (room) => room.capacity != null && Number.isFinite(room.capacity),
  );
  const totalCapacity = roomsWithCapacity.reduce(
    (total, room) => total + (room.capacity ?? 0),
    0,
  );
  const uniqueAmenityCount = new Set(
    publishedAccommodations.flatMap((room) =>
      room.amenities
        .map((amenity) => amenity.trim().toLocaleLowerCase("fr"))
        .filter(Boolean),
    ),
  ).size;
  const visibleAmenityCount = 3;
  const formatMetric = (value: number) => new Intl.NumberFormat("fr-FR").format(value);
  const [bookingRoom, setBookingRoom] = useState<Accommodation | null>(null);
  const [expandedAmenityRooms, setExpandedAmenityRooms] = useState<Set<string>>(
    () => new Set(),
  );
  const [roomAvailability, setRoomAvailability] = useState<
    Record<string, RoomAvailabilityStatus>
  >({});
  const closeBookingModal = useCallback(() => setBookingRoom(null), []);
  const publishedRoomIds = publishedAccommodations.map((room) => room.id);
  const publishedRoomKey = publishedRoomIds.join("|");

  function toggleRoomAmenities(roomId: string) {
    setExpandedAmenityRooms((current) => {
      const next = new Set(current);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }

  useEffect(() => {
    if (!publishedRoomIds.length) return;
    let active = true;
    const today = getDakarDateKey();

    async function loadRoomAvailability() {
      const statuses: Record<string, RoomAvailabilityStatus> = {};
      await Promise.all(
        publishedRoomIds.map(async (roomId) => {
          statuses[roomId] = await getRoomAvailability(roomId, today);
        }),
      );
      if (active) {
        setRoomAvailability((current) => ({ ...current, ...statuses }));
      }
    }

    void loadRoomAvailability();
    return () => {
      active = false;
    };
  }, [publishedRoomKey]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".accommodation-page");
    if (
      !page ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            return;
          }

          const leftViewport =
            entry.boundingClientRect.bottom <= 0 ||
            entry.boundingClientRect.top >= window.innerHeight;
          if (leftViewport) entry.target.classList.remove("is-visible");
        });
      },
      { threshold: 0 },
    );
    const observeNewElements = () => {
      page.querySelectorAll<HTMLElement>("[data-accommodation-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        observer.observe(element);
      });
    };

    page.classList.add("accommodation-reveal-ready");
    observeNewElements();
    const mutations = new MutationObserver(observeNewElements);
    mutations.observe(page, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      page.classList.remove("accommodation-reveal-ready");
    };
  }, []);

  useEffect(() => {
    document.title = `Hébergement — ${site.name}, ${site.subtitle}`;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      `Découvrez les hébergements publiés par ${site.name}, ${site.subtitle}.`,
    );
  }, [site.name, site.subtitle]);

  return (
    <main className="accommodation-page client-page" id="contenu">
      <header className="accommodation-hero">
        <div className="accommodation-hero-background" aria-hidden="true">
          {accommodationHeroPhoto && (
            <img
              src={accommodationHeroPhoto.url}
              alt=""
              className="accommodation-hero-background-image"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="accommodation-hero-shade" />
        </div>
        <div
          className="accommodation-hero-copy"
          data-accommodation-reveal="hero-copy"
        >
          <h1>Nos hébergements</h1>
          <p>
            Un lieu accueillant pour faire une pause et profiter pleinement de
            votre séjour.
          </p>
          <div className="accommodation-hero-actions">
            <a className="button button-gold" href="#chambres">
              Voir les hébergements <ArrowRight size={16} />
            </a>
            <Link className="accommodation-hero-contact" to="/contact">
              Poser une question <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div
          className="accommodation-hero-emblem"
          data-accommodation-reveal="emblem"
          aria-hidden="true"
        >
          <BedDouble size={78} strokeWidth={0.85} />
          <span>{site.subtitle}</span>
        </div>
      </header>

      <section
        className="accommodation-intro section-pad"
        data-accommodation-reveal="section-intro"
      >
        <div
          className="accommodation-intro-heading"
          data-accommodation-reveal="heading"
        >
          <span className="eyebrow">L’expérience Keur Ana-Fi</span>
          <h2>Le confort et l’attention au cœur du séjour</h2>
          <p>
            Chaque chambre publiée présente les informations disponibles pour
            vous aider à choisir en toute confiance. Notre équipe reste à votre
            écoute pour vous accompagner avant votre arrivée.
          </p>
        </div>
        <div className="accommodation-quality-grid">
          <article data-accommodation-reveal="quality">
            <span className="accommodation-quality-icon" aria-hidden="true">
              <Sparkles size={21} />
            </span>
            <h3>Un espace pour se reposer</h3>
            <p>
              Découvrez les chambres et leurs caractéristiques réelles avant de
              préparer votre séjour.
            </p>
          </article>
          <article data-accommodation-reveal="quality">
            <span className="accommodation-quality-icon" aria-hidden="true">
              <ClipboardCheck size={21} />
            </span>
            <h3>Des informations claires</h3>
            <p>
              Après réservation, l’arrivée se fait à partir de 14 h. Le départ
              est prévu avant 12 h, le lendemain de votre dernière nuit. Pour
              une exception, contactez l’établissement.
            </p>
          </article>
          <article data-accommodation-reveal="quality">
            <span className="accommodation-quality-icon" aria-hidden="true">
              <HeartHandshake size={21} />
            </span>
            <h3>Un échange avec l’équipe</h3>
            <p>
              Chaque demande est vérifiée par Keur Ana-Fi avant confirmation de
              votre réservation.
            </p>
          </article>
        </div>
      </section>

      <section
        className="accommodation-rooms section-pad"
        id="chambres"
        data-accommodation-reveal="section-rooms"
      >
        <div
          className="accommodation-section-heading"
          data-accommodation-reveal="heading"
        >
          <span className="eyebrow">Votre espace de séjour</span>
          <h2>Découvrez nos chambres</h2>
          <p>
            Statut affiché pour aujourd’hui ; la disponibilité sera vérifiée
            pour vos dates lors de la réservation.
          </p>
        </div>
        {publishedAccommodations.length ? (
          <div className="room-grid">
            {publishedAccommodations.map((room) => (
              <article
                className="room-card"
                data-accommodation-reveal="room"
                key={room.id}
              >
                <RoomPhotoCarousel
                  room={room}
                  availability={roomAvailability[room.id] ?? "checking"}
                />
                <div className="room-card-content">
                  <div className="room-card-heading">
                    <h3>{room.name}</h3>
                    {room.description && <p>{room.description}</p>}
                  </div>
                  {(room.capacity || room.beds.length > 0) && (
                    <ul className="room-highlights">
                      {room.capacity != null && room.capacity > 0 && (
                        <li>
                          <span className="room-highlight-icon" aria-hidden="true">
                            <UsersRound size={18} />
                          </span>
                          <span>
                            <strong>
                              {room.capacity} {room.capacity === 1 ? "personne" : "personnes"}
                            </strong>
                            <small>Capacité</small>
                          </span>
                        </li>
                      )}
                      {room.beds.length > 0 && (
                        <li>
                          <span>
                            <strong>
                              {room.beds
                                .map((bed) => `${bed.quantity} × ${bed.type}`)
                                .join(", ")}
                            </strong>
                            <small>Couchage{room.beds.length > 1 ? "s" : ""}</small>
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                  {room.amenities.length > 0 && (
                    <div className="room-amenities">
                      <span className="room-details-label">Équipements</span>
                      <ul
                        className="room-amenity-list"
                        id={`room-amenities-${room.id}`}
                      >
                        {room.amenities
                          .slice(
                            0,
                            expandedAmenityRooms.has(room.id)
                              ? room.amenities.length
                              : visibleAmenityCount,
                          )
                          .map((amenity, index) => (
                            <li key={`${room.id}-amenity-${index}`}>
                              <Check size={13} aria-hidden="true" />
                              {amenity}
                            </li>
                          ))}
                      </ul>
                      {room.amenities.length > visibleAmenityCount && (
                        <button
                          className="room-amenity-toggle"
                          type="button"
                          aria-expanded={expandedAmenityRooms.has(room.id)}
                          aria-controls={`room-amenities-${room.id}`}
                          onClick={() => toggleRoomAmenities(room.id)}
                        >
                          {expandedAmenityRooms.has(room.id)
                            ? "Réduire la liste"
                            : `Voir les ${room.amenities.length - visibleAmenityCount} autres équipements`}
                          <ChevronDown size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="room-card-footer">
                    {room.price != null && Number.isFinite(room.price) ? (
                      <>
                        <div className="room-price">
                          <span>Tarif par nuit</span>
                          <strong>
                            {new Intl.NumberFormat("fr-FR").format(room.price)}
                            <small> FCFA</small>
                          </strong>
                        </div>
                        <button
                          className="button button-gold room-book-button"
                          type="button"
                          onClick={() => setBookingRoom(room)}
                        >
                          Réserver <ArrowRight size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="room-price-on-request">Tarif sur demande</p>
                        <Link className="button button-outline room-book-button" to="/contact">
                          Demander des informations <ArrowRight size={16} />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="room-empty-state"
            data-accommodation-reveal="empty"
          >
            <div className="room-empty-mark" aria-hidden="true">
              <BedDouble size={34} strokeWidth={1.2} />
            </div>
            <div className="room-empty-copy">
              <span className="eyebrow">À découvrir bientôt</span>
              <h3>Les hébergements seront bientôt présentés ici</h3>
              <p>
                Pour obtenir les informations disponibles et préparer votre
                séjour, contactez directement {site.name}.
              </p>
              <Link className="button button-gold" to="/contact">
                Contacter l’établissement <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </section>

      <section
        className="accommodation-proof section-pad"
        data-accommodation-reveal="section-proof"
      >
        <div
          className="accommodation-proof-heading"
          data-accommodation-reveal="heading"
        >
          <span className="eyebrow">Keur Ana-Fi en quelques chiffres</span>
          <h2>Des repères concrets pour préparer votre séjour</h2>
          <p>
            Plus de 1 000 clients ont déjà séjourné à Keur Ana-Fi.
          </p>
        </div>
        <div className="accommodation-proof-grid">
          <article
            className="accommodation-proof-stat"
            data-accommodation-reveal="stat"
          >
            <strong>1 000+</strong>
            <span>clients hébergés</span>
          </article>
          <article
            className="accommodation-proof-stat"
            data-accommodation-reveal="stat"
          >
            <strong>{formatMetric(publishedAccommodations.length)}</strong>
            <span>chambres présentées</span>
          </article>
          <article
            className="accommodation-proof-stat"
            data-accommodation-reveal="stat"
          >
            <strong>
              {roomsWithCapacity.length === publishedAccommodations.length &&
              publishedAccommodations.length > 0
                ? formatMetric(totalCapacity)
                : "—"}
            </strong>
            <span>places d’accueil renseignées</span>
          </article>
          <article
            className="accommodation-proof-stat"
            data-accommodation-reveal="stat"
          >
            <strong>{formatMetric(uniqueAmenityCount)}</strong>
            <span>équipements renseignés</span>
          </article>
        </div>
        <p
          className="accommodation-proof-note"
          data-accommodation-reveal="note"
        >
          La disponibilité et les détails de chaque chambre sont confirmés par
          l’équipe lors de votre demande.
        </p>
        <Link
          className="button button-gold"
          data-accommodation-reveal="cta"
          to="/contact"
        >
          Préparer mon séjour <ArrowRight size={16} />
        </Link>
      </section>
      {bookingRoom && (
        <ReservationModal
          room={bookingRoom}
          onClose={closeBookingModal}
        />
      )}
    </main>
  );
}
