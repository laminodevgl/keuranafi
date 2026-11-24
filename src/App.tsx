import { useEffect, useLayoutEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  Clock3,
  Compass,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import SectionHeading from "./components/SectionHeading";
import {
  getClientGalleryPhotos,
  getGalleryPhotoAlt,
  type GalleryPhoto,
} from "./data/gallery";
import { useSiteContent } from "./data/SiteContentContext";
import EventsPage from "./pages/EventsPage";
import AccommodationPage from "./pages/AccommodationPage";
import ReservationPage from "./pages/ReservationPage";
import RestaurantPage from "./pages/RestaurantPage";
import GalleryPage from "./pages/GalleryPage";
import ContactPage from "./pages/ContactPage";
import AdminPage from "./pages/AdminPage";
import LegalPage from "./pages/LegalPage";

function HomeExperienceGalleryPhoto({ photo }: { photo: GalleryPhoto | null }) {
  if (!photo) return null;

  return (
    <img
      src={photo.url}
      alt={getGalleryPhotoAlt(photo)}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

const customerReviews = [
  {
    name: "Aminata Ndiaye",
    quote:
      "J'ai passé un excellent séjour à Keur Anna-Fi. L'accueil était chaleureux, les chambres confortables et le cadre reposant. Je recommande vivement cet établissement.",
  },
  {
    name: "Mamadou Diop",
    quote:
      "Un endroit agréable pour se détendre et profiter du calme. Le personnel est accueillant et disponible. J'ai particulièrement apprécié la qualité du service.",
  },
  {
    name: "Fatou Sarr",
    quote:
      "Une belle découverte à Sokone, C'est une adresse que je garderai pour mes prochains séjours.",
  },
  {
    name: "Ibrahima Ba",
    quote:
      "J'ai beaucoup apprécié mon passage à Keur Ana-Fi. Les chambres sont propres, le restaurant propose de bons plats et le personnel est sympathique.",
  },
  {
    name: "Mariama Fall",
    quote: "bilay yéna meilleur si waloum restauration ak hebergement contane na trop",
  },
  {
    name: "Cheikh",
    quote: "Keur Ana-Fi Je recommande !",
  },
  {
    name: "Awa Diouf",
    quote:
      "les repas et le cadre naturel, tout était réuni pour passer un bon moment khana dilén nianal rek gena dém si kaname.",
  },
  {
    name: "Ousmane Faye",
    quote: "Une très belle adresse dans le Sine-Saloum.",
  },
  {
    name: "Sokhna Mbaye",
    quote:
      "féte bou nékh laniou fa organisé wone Nous avons passé un agréable moment entre amis.",
  },
  {
    name: "Abdoulaye Sow",
    quote: "Un établissement que je recommande à ceux qui visitent Sokone.",
  },
];

function App() {
  const { pathname, search, hash } = useLocation();
  const { error, isInitialLoadComplete } = useSiteContent();
  const isAdminRoute = pathname.startsWith("/admin");
  const [isInitialLoadingScreenDismissed, setIsInitialLoadingScreenDismissed] =
    useState(false);
  const [displayedPath, setDisplayedPath] = useState(pathname);
  const isRouteReady =
    isInitialLoadingScreenDismissed && pathname === displayedPath;

  useEffect(() => {
    if (!isInitialLoadComplete) return;

    const initialLoadingScreen = document.getElementById("app-loading-screen");

    if (!initialLoadingScreen) {
      setIsInitialLoadingScreenDismissed(true);
      return;
    }

    initialLoadingScreen.classList.add("is-hidden");
    const timeout = window.setTimeout(() => {
      initialLoadingScreen.remove();
      setIsInitialLoadingScreenDismissed(true);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [isInitialLoadComplete]);

  useEffect(() => {
    if (pathname === displayedPath) return;
    const timeout = window.setTimeout(() => setDisplayedPath(pathname), 450);
    return () => window.clearTimeout(timeout);
  }, [displayedPath, pathname]);

  useLayoutEffect(() => {
    const anchorId = hash.slice(1);
    const anchor = anchorId ? document.getElementById(anchorId) : null;

    if (anchor) {
      anchor.scrollIntoView({ behavior: "instant" });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [hash, isInitialLoadComplete, isRouteReady, pathname, search]);

  return (
    <>
      {pathname !== displayedPath && (
        <div className="route-loading-screen" role="status" aria-live="polite">
          <div className="route-loading-content">
            <div className="route-loading-spinner" aria-hidden="true" />
            <span>Patientez…</span>
          </div>
        </div>
      )}
      {!isAdminRoute && (
        <>
          <a className="skip-link" href="#contenu">
            Aller au contenu
          </a>
          <SiteHeader />
          {error && (
            <p className="site-data-warning" role="status">
              {error} Les dernières informations locales restent affichées.
            </p>
          )}
        </>
      )}
      {isRouteReady ? (
        <Routes>
          <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/evenements" element={<EventsPage />} />
          <Route path="/hebergement" element={<AccommodationPage />} />
          <Route path="/reservation" element={<ReservationPage />} />
          <Route path="/restaurant" element={<RestaurantPage />} />
          <Route path="/galerie" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/mentions-legales" element={<LegalPage document="mentions" />} />
          <Route
            path="/politique-confidentialite"
            element={<LegalPage document="confidentialite" />}
          />
          <Route path="/politique-cookies" element={<LegalPage document="cookies" />} />
          <Route
            path="/conditions-utilisation"
            element={<LegalPage document="conditions" />}
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
      ) : null}
      {!isAdminRoute && isRouteReady && (
        <SiteFooter />
      )}
    </>
  );
}

function HomeSectionWave({ edge }: { edge: "top" | "bottom" }) {
  const wave =
    edge === "top"
      ? "M0 48 C120 48 240 20 360 20 C480 20 600 48 720 48 C840 48 960 76 1080 76 C1200 76 1320 48 1440 48 L1440 120 L0 120 Z"
      : "M0 -24 L1440 -24 L1440 48 C1320 48 1200 76 1080 76 C960 76 840 48 720 48 C600 48 480 20 360 20 C240 20 120 48 0 48 Z";

  return (
    <div className={`home-section-wave home-section-wave--${edge}`} aria-hidden="true">
      <svg
        className="home-section-wave-svg"
        viewBox="0 0 2880 96"
        preserveAspectRatio="none"
        focusable="false"
      >
        {[0, 1440].map((offset) => (
          <g key={offset} transform={`translate(${offset} 0)`}>
            <path className="home-section-wave-fill" d={wave} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function HomePage() {
  const { content } = useSiteContent();
  const { site, homeContent } = content;
  const clientGalleryPhotos = getClientGalleryPhotos(
    content.galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  );
  const heroSitePhoto = clientGalleryPhotos["home-hero"];
  const welcomeSitePhoto = clientGalleryPhotos["home-welcome"];
  const staySitePhoto = clientGalleryPhotos["home-stay-feature"];
  const galleryRestaurantPhoto =
    clientGalleryPhotos["home-restaurant-feature"];
  const experiencePhotos = [
    clientGalleryPhotos["home-experience-stay"] ?? null,
    clientGalleryPhotos["home-experience-restaurant"] ?? null,
    clientGalleryPhotos["home-experience-saloum"] ?? null,
  ];
  const gallerySlots = [
    "home-gallery-1",
    "home-gallery-2",
    "home-gallery-3",
    "home-gallery-4",
  ] as const;
  const galleryPhotos = gallerySlots.flatMap((slot) => {
    const photo = clientGalleryPhotos[slot];
    return photo ? [{ src: photo.url, alt: getGalleryPhotoAlt(photo) }] : [];
  });
  const address = site.address.trim() || "Quartier Médine, Sokone, Sénégal";
  const email = site.email.trim() || "annifadione@gmail.com";
  const mapUrl = site.coordinates
    ? `https://www.google.com/maps?q=${site.coordinates.latitude},${site.coordinates.longitude}`
    : "https://maps.app.goo.gl/dmh1CR2zPtemMwzX9";
  const openingHours = site.openingHours.filter(
    (item) => item.service.trim() && item.hours.trim(),
  );

  useEffect(() => {
    document.title = "Keur Ana-Fi — Maison des Bolongs à Sokone";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      "Découvrez Keur Ana-Fi, Maison des Bolongs à Sokone, au cœur du Sine-Saloum. Hébergement, restaurant et art de vivre au fil des bolongs.",
    );
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const homePage = document.querySelector<HTMLElement>(".home-page");
    if (!homePage || !("IntersectionObserver" in window)) return;

    homePage.classList.add("home-reveal-ready");
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            return;
          }

          const leftViewport =
            entry.boundingClientRect.bottom <= 0 ||
            entry.boundingClientRect.top >= window.innerHeight;
          if (leftViewport) {
            entry.target.classList.remove("is-visible");
          }
        });
      },
      { threshold: 0 },
    );
    const observed = new WeakSet<Element>();
    const observeNewElements = () => {
      homePage.querySelectorAll("[data-home-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        revealObserver.observe(element);
      });
    };
    observeNewElements();
    const mutations = new MutationObserver(observeNewElements);
    mutations.observe(homePage, { childList: true, subtree: true });
    const revealFallback = window.setTimeout(() => {
      const viewportHeight = window.innerHeight;
      homePage.querySelectorAll("[data-home-reveal]").forEach((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom >= 0 && bounds.top <= viewportHeight * 0.92) {
          element.classList.add("is-visible");
        }
      });
    }, 1800);

    return () => {
      window.clearTimeout(revealFallback);
      mutations.disconnect();
      revealObserver.disconnect();
      homePage.classList.remove("home-reveal-ready");
    };
  }, []);

  return (
    <main id="contenu" className="home-page">
        <section className="hero home-hero" aria-labelledby="hero-title">
          <div className="home-hero-background">
            {heroSitePhoto && (
              <img
                className="home-hero-background-image"
                src={heroSitePhoto.url}
                alt={getGalleryPhotoAlt(heroSitePhoto)}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="home-hero-overlay" aria-hidden="true" />
          </div>
          <div className="hero-content">
            <span
              className="home-hero-overline"
              aria-label="La Maison des Bolongs"
            >
              {Array.from("La Maison des Bolongs", (character, index) => (
                <span
                  className="home-hero-overline-character"
                  aria-hidden="true"
                  key={index}
                  style={{ animationDelay: `${index * 38}ms` }}
                >
                  {character === " " ? "\u00a0" : character}
                </span>
              ))}
            </span>
            <h1 id="hero-title">{homeContent.heroTitle}</h1>
            <p>{homeContent.heroDescription}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#experiences">
                Explorer la maison <ArrowRight size={16} />
              </a>
            </div>
          </div>
          <a
            className="hero-scroll"
            href="#bienvenue"
            aria-label="Défiler vers la suite"
          >
            <span>Défiler pour découvrir</span>
            <ArrowDown size={16} />
          </a>
        </section>

        <div className="home-marquee" aria-hidden="true">
          <div className="home-marquee-track" aria-hidden="true">
            {Array.from({ length: 2 }, (_, index) => (
              <span className="home-marquee-group" key={index}>
                <span>Séjourner</span><Sparkles size={14} />
                <span>Se retrouver</span><Sparkles size={14} />
                <span>Explorer Sokone</span><Sparkles size={14} />
                <span>Vivre le Sine-Saloum</span><Sparkles size={14} />
              </span>
            ))}
          </div>
        </div>

        <section className="welcome section-pad" id="bienvenue">
          {welcomeSitePhoto && (
            <div className="welcome-photo-wrap" data-home-reveal="curtain">
              <img
                src={welcomeSitePhoto.url}
                alt={getGalleryPhotoAlt(welcomeSitePhoto)}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.parentElement?.style.setProperty(
                    "display",
                    "none",
                  );
                }}
              />
            </div>
          )}
          <div className="welcome-copy" data-home-reveal="words" data-home-reveal-delay="1">
            <span className="eyebrow">L’esprit de la maison</span>
            <h2>{homeContent.welcomeTitle}</h2>
            <p>{homeContent.welcomeDescription}</p>
            <p className="welcome-extra">
              Ici, l’hospitalité, les moments partagés et la découverte du
              territoire composent une escale à votre rythme.
            </p>
            <Link className="text-link" to="/contact">
              Parlons de votre séjour <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section
          className="home-experiences section-pad"
          id="experiences"
          aria-labelledby="experiences-title"
        >
          <HomeSectionWave edge="top" />
          <div className="home-experiences-heading" data-home-reveal="words">
            <span className="eyebrow">Vivre Keur Ana-Fi</span>
            <h2 id="experiences-title">
              Une même adresse, plusieurs façons d’en profiter
            </h2>
            <p>
              Faites de la maison votre point de départ pour vous reposer,
              partager un bon moment et découvrir Sokone.
            </p>
          </div>
          <div className="home-experiences-grid">
            <Link
              className="home-experience-card"
              to="/hebergement"
              data-home-reveal="prism"
            >
              <div className="home-experience-image">
                <HomeExperienceGalleryPhoto photo={experiencePhotos[0]} />
              </div>
              <div className="home-experience-copy">
                <span className="home-experience-icon">
                  <BedDouble size={20} aria-hidden="true" />
                </span>
                <span className="eyebrow">Faire une pause</span>
                <h3>L’hébergement</h3>
                <p>
                  Un lieu où poser ses valises et prendre le temps de profiter
                  de son séjour.
                </p>
                <span className="home-experience-link">
                  Découvrir <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
            </Link>
            <Link
              className="home-experience-card"
              to="/restaurant"
              data-home-reveal="prism"
              data-home-reveal-delay="1"
            >
              <div className="home-experience-image">
                <HomeExperienceGalleryPhoto photo={experiencePhotos[1]} />
              </div>
              <div className="home-experience-copy">
                <span className="home-experience-icon">
                  <UtensilsCrossed size={20} aria-hidden="true" />
                </span>
                <span className="eyebrow">Se retrouver</span>
                <h3>Le restaurant &amp; bar</h3>
                <p>
                  Une invitation à se retrouver autour de la table et à
                  prolonger les bons moments.
                </p>
                <span className="home-experience-link">
                  Découvrir <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
            </Link>
            <Link
              className="home-experience-card"
              to="/galerie"
              data-home-reveal="prism"
              data-home-reveal-delay="2"
            >
              <div className="home-experience-image">
                <HomeExperienceGalleryPhoto photo={experiencePhotos[2]} />
              </div>
              <div className="home-experience-copy">
                <span className="home-experience-icon">
                  <Compass size={20} aria-hidden="true" />
                </span>
                <span className="eyebrow">Changer de rythme</span>
                <h3>Sokone &amp; les bolongs</h3>
                <p>
                  Laissez-vous porter par les paysages et l’atmosphère du
                  Sine-Saloum.
                </p>
                <span className="home-experience-link">
                  Parcourir la galerie <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>
          <HomeSectionWave edge="bottom" />
        </section>

        <section className="stay home-feature section-pad" id="hebergement">
          {staySitePhoto && (
            <div className="home-feature-image" data-home-reveal="curtain">
              <img
                src={staySitePhoto.url}
                alt={getGalleryPhotoAlt(staySitePhoto)}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.parentElement?.style.setProperty(
                    "display",
                    "none",
                  );
                }}
              />
            </div>
          )}
          <div className="home-feature-copy" data-home-reveal="words" data-home-reveal-delay="1">
            <span className="eyebrow">Le temps de souffler</span>
            <h2>{homeContent.stayTitle}</h2>
            <p>{homeContent.stayDescription}</p>
            <p>
              Retrouvez une atmosphère accueillante, puis partez à la rencontre
              de Sokone et de ses environs.
            </p>
            <Link className="text-link" to="/hebergement">
              Découvrir l’hébergement <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="restaurant home-feature home-feature-reverse section-pad" id="restaurant">
          <div className="home-feature-copy" data-home-reveal="flip">
            <span className="eyebrow">Les plaisirs de la table</span>
            <h2>{homeContent.restaurantTitle}</h2>
            <p>
              Un espace pour se retrouver, partager un repas et profiter de
              l’ambiance de la maison.
            </p>
            <p>
              Découvrez l’univers du restaurant et du bar, au rythme de votre
              séjour.
            </p>
            <Link className="text-link" to="/restaurant">
              Explorer le restaurant <ArrowRight size={16} />
            </Link>
          </div>
          {galleryRestaurantPhoto && (
            <div
              className="home-feature-image"
              data-home-reveal="curtain"
              data-home-reveal-delay="1"
            >
              <img
                src={galleryRestaurantPhoto.url}
                alt={getGalleryPhotoAlt(galleryRestaurantPhoto)}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.parentElement?.style.setProperty(
                    "display",
                    "none",
                  );
                }}
              />
            </div>
          )}
        </section>

        <section
          className="testimonials section-pad"
          id="temoignages"
          aria-labelledby="testimonials-title"
        >
          <div className="testimonials-heading" data-home-reveal="words">
            <span className="eyebrow">Leurs mots, leur expérience</span>
            <h2 id="testimonials-title">Ils ont séjourné chez nous</h2>
            <p>
              Les avis défilent en continu. Survolez la bande ou placez-y le
              focus pour faire une pause.
            </p>
          </div>
          <div
            className="testimonials-marquee"
            role="region"
            aria-label="Avis des visiteurs en défilement continu. Placez le focus pour mettre en pause."
            tabIndex={0}
          >
            <div className="testimonials-track">
              {[false, true].map((isDuplicate) => (
                <div
                  className="testimonials-group"
                  aria-hidden={isDuplicate || undefined}
                  key={isDuplicate ? "duplicate-reviews" : "original-reviews"}
                >
                  {customerReviews.map((review, index) => (
                    <figure
                      className={`testimonial-card testimonial-card-${(index % 4) + 1}`}
                      key={`${review.name}-${index}-${isDuplicate ? "copy" : "original"}`}
                    >
                      <blockquote>{review.quote}</blockquote>
                      <figcaption>
                        <span className="testimonial-avatar" aria-hidden="true">
                          {review.name.charAt(0)}
                        </span>
                        <span className="testimonial-author">{review.name}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="events-teaser" id="evenements">
          <div className="events-teaser-card" data-home-reveal="events-panel">
            <div className="events-teaser-icon" aria-hidden="true" data-home-reveal="orbit">
              <CalendarDays size={30} strokeWidth={1.4} />
            </div>
            <div className="events-teaser-copy" data-home-reveal="words" data-home-reveal-delay="1">
              <span className="eyebrow">La vie de la maison</span>
              <h2>{homeContent.eventsTitle}</h2>
              <p>
                {content.events.length > 0
                  ? "Retrouvez les rendez-vous et temps forts annoncés par Keur Ana-Fi."
                  : "Découvrez les événements et les temps forts de Keur Ana-Fi."}
              </p>
            </div>
            <Link
              className="button button-primary events-teaser-button"
              data-home-reveal="arc"
              data-home-reveal-delay="2"
              to="/evenements"
            >
              Voir les événements <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="gallery section-pad" id="galerie">
          <div data-home-reveal="words">
            <SectionHeading
              eyebrow="Un territoire à découvrir"
              title={homeContent.galleryTitle}
              description="Parcourez les images partagées par Keur Ana-Fi et laissez-vous inspirer par le Sine-Saloum."
            />
          </div>
          {galleryPhotos.length ? (
            <div className="gallery-grid">
              {galleryPhotos.map((photo, index) => (
                <figure
                  className={`gallery-item gallery-item-${index + 1}`}
                  key={photo.src}
                  data-home-reveal="tile"
                  data-home-reveal-delay={index % 3}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.parentElement?.style.setProperty(
                        "display",
                        "none",
                      );
                    }}
                  />
                </figure>
              ))}
            </div>
          ) : (
            <p className="gallery-note" data-home-reveal="words">
              Les photos publiées dans la Galerie apparaîtront ici.
            </p>
          )}
        </section>

        <section
          className="home-story section-pad"
          id="histoire"
          aria-labelledby="home-story-title"
          data-home-reveal="story-panel"
        >
          <div className="home-story-heading" data-home-reveal="words">
            <span className="eyebrow">Notre histoire &amp; nos valeurs</span>
            <h2 id="home-story-title">Une maison d’accueil et de partage</h2>
            <p>
              L’histoire de Keur Ana-Fi s’écrit à Sokone, au fil des accueils et
              des rencontres. Maison des Bolongs, elle porte des valeurs
              simples : l’hospitalité, le partage et l’envie de faire découvrir
              le Sine-Saloum.
            </p>
          </div>
        </section>

        <section
          className="visit-section section-pad"
          id="visite"
          data-home-reveal="visit-panel"
        >
          <div className="visit-heading" data-home-reveal="words">
            <span className="eyebrow">Préparer votre venue</span>
            <h2>Retrouvez la Maison des Bolongs à Sokone</h2>
            <p>
              Pour une question sur l’hébergement, le restaurant ou une
              réservation, l’équipe de {site.name} vous répond directement.
            </p>
          </div>
          <div className="visit-cards">
            <article className="visit-card visit-location-card" data-home-reveal="review">
              <span className="visit-icon">
                <MapPin size={22} aria-hidden="true" />
              </span>
              <span className="eyebrow">Nous trouver</span>
              <h3>{site.subtitle}</h3>
              <p>{address}</p>
              <p className="visit-region">{site.location}</p>
              <a
                className="visit-link"
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir l’itinéraire <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </article>
            <article
              className="visit-card visit-contact-card"
              data-home-reveal="review"
              data-home-reveal-delay="1"
            >
              <span className="visit-icon">
                <Mail size={22} aria-hidden="true" />
              </span>
              <span className="eyebrow">Nous contacter</span>
              <h3>Parlons de votre séjour</h3>
              {openingHours.length > 0 ? (
                <ul className="visit-hours">
                  {openingHours.map((item) => (
                    <li key={`${item.service}-${item.hours}`}>
                      <Clock3 size={15} aria-hidden="true" />
                      <span><strong>{item.service}</strong>{item.hours}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Contactez notre équipe pour organiser votre venue et obtenir
                  les informations pratiques.
                </p>
              )}
              {site.phoneNumber && (
                <a
                  className="visit-contact-detail"
                  href={`tel:${site.phoneNumber.replace(/[^\d+]/g, "")}`}
                >
                  <Phone size={15} aria-hidden="true" />
                  {site.phoneNumber}
                </a>
              )}
              <a className="visit-contact-detail" href={`mailto:${email}`}>
                <Mail size={15} aria-hidden="true" />
                {email}
              </a>
              <Link className="visit-link" to="/contact">
                Envoyer un message <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

    </main>
  );
}

export default App;
