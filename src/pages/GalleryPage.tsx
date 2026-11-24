import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowLeft, ArrowRight, Images, X } from "lucide-react";
import { Link } from "react-router-dom";
import ClientPageHero from "../components/ClientPageHero";
import {
  compareGalleryPhotosNewestFirst,
  getClientGalleryPhotos,
  getGalleryPhotoAlt,
  getGalleryPhotoLabel,
} from "../data/gallery";
import { useSiteContent } from "../data/SiteContentContext";
import useClientPageReveal from "../hooks/useClientPageReveal";

export default function GalleryPage() {
  useClientPageReveal(".gallery-page", true);
  const { content } = useSiteContent();
  const { galleryPhotos, site } = content;
  const selectedClientPhotos = getClientGalleryPhotos(
    galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  );
  const galleryArtFront = selectedClientPhotos["gallery-art-front"];
  const galleryArtBack = selectedClientPhotos["gallery-art-back"];
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const photoTriggerRef = useRef<HTMLButtonElement | null>(null);

  const visiblePhotos = galleryPhotos
    .filter(
      (photo) =>
        photo.status === "published" &&
        !photo.provisional &&
        photo.url.trim(),
    )
    .sort(compareGalleryPhotosNewestFirst);
  const activePhotoIndex = visiblePhotos.findIndex(
    (photo) => photo.id === activePhotoId,
  );
  const activePhoto =
    activePhotoIndex >= 0 ? visiblePhotos[activePhotoIndex] : null;

  useEffect(() => {
    document.title = `Galerie — ${site.name}, ${site.subtitle}`;
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      `Découvrez les photos publiées par ${site.name}, à ${site.location}.`,
    );
  }, [site.location, site.name, site.subtitle]);

  useEffect(() => {
    if (!activePhoto) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeGallery();
      } else if (event.key === "ArrowRight" && visiblePhotos.length > 1) {
        setActivePhotoId(
          visiblePhotos[(activePhotoIndex + 1) % visiblePhotos.length].id,
        );
      } else if (event.key === "ArrowLeft" && visiblePhotos.length > 1) {
        setActivePhotoId(
          visiblePhotos[
            (activePhotoIndex - 1 + visiblePhotos.length) % visiblePhotos.length
          ].id,
        );
      } else if (event.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>(
          ".gallery-lightbox-dialog",
        );
        const focusable = dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhoto, activePhotoIndex, visiblePhotos]);

  function closeGallery() {
    setActivePhotoId(null);
    photoTriggerRef.current?.focus();
  }

  function movePhoto(direction: -1 | 1) {
    if (activePhotoIndex < 0 || visiblePhotos.length < 2) return;
    const nextIndex =
      (activePhotoIndex + direction + visiblePhotos.length) %
      visiblePhotos.length;
    setActivePhotoId(visiblePhotos[nextIndex].id);
  }

  function handlePhotoKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      photoTriggerRef.current = event.currentTarget;
    }
  }

  return (
    <main className="gallery-page client-page" id="contenu">
      <ClientPageHero
        gallerySlot="gallery-hero"
        centered
        title="Galerie"
        hideTitle
        description={
          <>
            <span className="gallery-hero-lead">
              Explorez notre <strong>galerie</strong>
            </span>
            <span className="gallery-hero-trail">
              et découvrez nos <strong>espaces</strong>, nos{" "}
              <strong>activités</strong> et les <strong>moments</strong> qui
              font vivre la maison.
            </span>
          </>
        }
        visual={
          galleryArtFront || galleryArtBack ? (
            <div
              className="gallery-hero-art"
              data-client-reveal="card"
              aria-hidden="true"
            >
              {galleryArtBack && (
                <img
                  className="gallery-hero-art-back"
                  src={galleryArtBack.url}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.closest<HTMLElement>(
                      ".gallery-hero-art",
                    )?.style.setProperty("display", "none");
                  }}
                />
              )}
              {galleryArtFront && (
                <figure className="gallery-hero-art-card">
                  <img
                    src={galleryArtFront.url}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.closest<HTMLElement>(
                        ".gallery-hero-art",
                      )?.style.setProperty("display", "none");
                    }}
                  />
                </figure>
              )}
              <span className="gallery-hero-art-glint" />
            </div>
          ) : null
        }
      />
      <section
        className="gallery-page-content"
        id="galerie-photos"
        aria-label="Galerie photos"
      >
        {visiblePhotos.length ? (
          <div className="editorial-gallery" aria-live="polite">
            {visiblePhotos.map((photo, index) => (
              <button
                className={`editorial-photo editorial-photo-${(index % 6) + 1}`}
                type="button"
                key={photo.id}
                data-client-reveal="photo"
                data-client-reveal-delay={index % 3}
                aria-label={`Agrandir : ${getGalleryPhotoLabel(photo)}`}
                onKeyDown={handlePhotoKeyDown}
                onClick={(event) => {
                  photoTriggerRef.current = event.currentTarget;
                  setActivePhotoId(photo.id);
                }}
              >
                <img
                  src={photo.url}
                  alt={getGalleryPhotoAlt(photo)}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.parentElement?.style.setProperty(
                      "display",
                      "none",
                    );
                  }}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="gallery-empty" role="status" data-client-reveal="card">
            <Images size={32} strokeWidth={1.4} aria-hidden="true" />
            <h2>Aucune photo publiée pour le moment</h2>
            <p>
              Les images ajoutées à la galerie par {site.name} seront affichées
              ici.
            </p>
            <Link className="button button-gold" to="/contact">
              Contacter l’établissement <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>

      {activePhoto && (
        <div className="gallery-lightbox">
          <button
            className="gallery-lightbox-backdrop"
            type="button"
            aria-label="Fermer la galerie"
            onClick={closeGallery}
          />
          <section
            className="gallery-lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Photographie agrandie"
          >
            <button
              className="gallery-lightbox-close"
              type="button"
              aria-label="Fermer"
              ref={closeButtonRef}
              onClick={closeGallery}
            >
              <X size={21} />
            </button>
            {visiblePhotos.length > 1 && (
              <button
                className="gallery-lightbox-previous"
                type="button"
                aria-label="Photographie précédente"
                onClick={() => movePhoto(-1)}
              >
                <ArrowLeft size={22} />
              </button>
            )}
            <figure>
              <img
                src={activePhoto.url}
                alt={getGalleryPhotoAlt(activePhoto)}
                width={activePhoto.width}
                height={activePhoto.height}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </figure>
            {visiblePhotos.length > 1 && (
              <button
                className="gallery-lightbox-next"
                type="button"
                aria-label="Photographie suivante"
                onClick={() => movePhoto(1)}
              >
                <ArrowRight size={22} />
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
