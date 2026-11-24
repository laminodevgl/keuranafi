import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, X } from "lucide-react";
import { Link } from "react-router-dom";
import ClientPageHero from "../components/ClientPageHero";
import type { EventItem } from "../data/events";
import { useSiteContent } from "../data/SiteContentContext";
import useClientPageReveal from "../hooks/useClientPageReveal";

function isUpcoming(event: EventItem) {
  const eventDate = new Date(`${event.date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDate >= today;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function EventCard({
  event,
  onOpenImage,
  revealDelay,
}: {
  event: EventItem;
  onOpenImage: (event: EventItem, trigger: HTMLButtonElement) => void;
  revealDelay: number;
}) {
  return (
    <article
      className="event-card"
      data-client-reveal="card"
      data-client-reveal-delay={revealDelay}
    >
      <div className="event-card-media">
        {event.image?.trim() ? (
          <button
            className="event-card-image-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-label={`Voir l’affiche de ${event.title} en entier`}
            onClick={(clickEvent) =>
              onOpenImage(event, clickEvent.currentTarget)
            }
          >
            <img
              className="event-card-image-backdrop"
              src={event.image}
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
            <img
              className="event-card-image"
              src={event.image}
              alt={event.title}
              loading="lazy"
            />
          </button>
        ) : (
          <div className="event-card-placeholder" aria-hidden="true">
            <CalendarDays size={42} strokeWidth={1.2} />
          </div>
        )}
        <span className="event-card-date">
          <CalendarDays size={15} aria-hidden="true" />
          <time dateTime={event.date}>{formatDate(event.date)}</time>
        </span>
      </div>
      <div className="event-card-content">
        <div className="event-card-meta">
          {event.time?.trim() && (
            <span className="event-card-time">
              <Clock3 size={14} aria-hidden="true" />
              {event.time}
            </span>
          )}
          {event.location?.trim() && (
            <span className="event-card-location">
              <MapPin size={14} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>
        <h3>{event.title}</h3>
        {event.description.trim() && <p>{event.description}</p>}
        {event.participation?.trim() && (
          <span className="event-card-participation">
            Participation : {event.participation}
          </span>
        )}
      </div>
    </article>
  );
}

function EventList({
  items,
  emptyTitle,
  emptyMessage,
  onOpenImage,
}: {
  items: EventItem[];
  emptyTitle: string;
  emptyMessage: string;
  onOpenImage: (event: EventItem, trigger: HTMLButtonElement) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="event-empty" data-client-reveal="card">
        <Clock3 size={22} strokeWidth={1.5} />
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="event-grid">
      {items.map((event, index) => (
        <EventCard
          key={`${event.date}-${event.title}`}
          event={event}
          onOpenImage={onOpenImage}
          revealDelay={index % 3}
        />
      ))}
    </div>
  );
}

export default function EventsPage() {
  useClientPageReveal(".events-page", true);
  const { content } = useSiteContent();
  const { events } = content;
  const upcomingEvents = events
    .filter(isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = upcomingEvents[0];
  const nextEventDate = nextEvent
    ? new Date(`${nextEvent.date}T00:00:00`)
    : null;
  const nextEventMonth = nextEventDate
    ? new Intl.DateTimeFormat("fr-FR", { month: "short" })
        .format(nextEventDate)
        .replace(".", "")
    : "";
  const pastEvents = events
    .filter((event) => !isUpcoming(event))
    .sort((a, b) => b.date.localeCompare(a.date));
  const [activeEventImage, setActiveEventImage] = useState<EventItem | null>(
    null,
  );
  const imageCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const imageTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.title = "Événements — Keur Ana-Fi, Maison des Bolongs";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      "Découvrez les événements à venir et les événements passés de Keur Ana-Fi, Maison des Bolongs à Sokone.",
    );
  }, []);

  useEffect(() => {
    if (!activeEventImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    imageCloseButtonRef.current?.focus();

    function handleImageDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEventImage();
      } else if (event.key === "Tab") {
        event.preventDefault();
        imageCloseButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleImageDialogKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleImageDialogKeyDown);
    };
  }, [activeEventImage]);

  function openEventImage(event: EventItem, trigger: HTMLButtonElement) {
    imageTriggerRef.current = trigger;
    setActiveEventImage(event);
  }

  function closeEventImage() {
    setActiveEventImage(null);
    imageTriggerRef.current?.focus();
  }

  return (
    <main className="events-page client-page" id="contenu">
      <ClientPageHero
        gallerySlot="events-hero"
        centered
        title={
          <>
            Nos prochains{" "}
            <span className="events-hero-title-accent">rendez-vous</span>
          </>
        }
        description={
          <>
            Retrouvez les <strong>activités à venir</strong> et les{" "}
            <strong>moments à partager</strong> à Keur Ana-Fi.
          </>
        }
        visual={
          <div
            className="events-hero-art"
            data-client-reveal="card"
            aria-hidden="true"
          >
            <div className="events-hero-ticket">
              <div className="events-hero-ticket-heading">
                <span>AGENDA · SINE-SALOUM</span>
                <span className="events-hero-calendar-icon">
                  <CalendarDays size={20} strokeWidth={1.5} />
                </span>
              </div>
              <div
                className={`events-hero-date${nextEvent ? "" : " is-empty"}`}
              >
                {nextEventDate ? (
                  <>
                    <strong>{nextEventDate.getDate()}</strong>
                    <span>{nextEventMonth}</span>
                  </>
                ) : (
                  <CalendarDays size={26} strokeWidth={1.4} />
                )}
              </div>
              <p className="events-hero-event-title">
                {nextEvent?.title ?? "De beaux moments à partager"}
              </p>
              <div className="events-hero-ticket-footer">
                <span>
                  {nextEvent?.location?.trim() || "Keur Ana-Fi · Sokone"}
                </span>
                <strong>{nextEvent ? "À VENIR" : "BIENTÔT"}</strong>
              </div>
            </div>
            <span className="events-hero-art-glint" />
          </div>
        }
      >
        <a className="button button-light" href="#upcoming-title">
          Voir les rendez-vous <ArrowRight size={16} />
        </a>
      </ClientPageHero>

      <div className="events-content">
        <section className="events-section" aria-labelledby="upcoming-title">
          <div className="events-section-heading" data-client-reveal="heading">
            <h2 id="upcoming-title">À venir</h2>
          </div>
          <EventList
            items={upcomingEvents}
            emptyTitle="Aucun événement à venir"
            emptyMessage="Les rendez-vous confirmés apparaîtront ici."
            onOpenImage={openEventImage}
          />
        </section>

        {pastEvents.length > 0 && (
          <section className="events-section events-past" aria-labelledby="past-title">
            <div className="events-section-heading" data-client-reveal="heading">
              <h2 id="past-title">Événements passés</h2>
            </div>
            <EventList
              items={pastEvents}
              emptyTitle="Aucun événement passé"
              emptyMessage=""
              onOpenImage={openEventImage}
            />
          </section>
        )}

        <aside className="events-contact" data-client-reveal="card">
          <p>Une question sur un événement ?</p>
          <Link className="button button-outline" to="/contact">
            Contacter l’établissement <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
      {activeEventImage?.image && (
        <div className="event-image-lightbox">
          <button
            className="event-image-lightbox-backdrop"
            type="button"
            tabIndex={-1}
            aria-label="Fermer l’affiche agrandie"
            onClick={closeEventImage}
          />
          <section
            className="event-image-lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Affiche de l’événement ${activeEventImage.title}`}
          >
            <button
              className="event-image-lightbox-close"
              type="button"
              aria-label="Fermer"
              ref={imageCloseButtonRef}
              onClick={closeEventImage}
            >
              <X size={21} />
            </button>
            <img src={activeEventImage.image} alt={activeEventImage.title} />
          </section>
        </div>
      )}
    </main>
  );
}
