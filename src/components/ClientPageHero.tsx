import type { ReactNode } from "react";
import {
  getClientGalleryPhotos,
  type ClientGallerySlot,
} from "../data/gallery";
import { useSiteContent } from "../data/SiteContentContext";

type ClientPageHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  description: ReactNode;
  gallerySlot: ClientGallerySlot;
  children?: ReactNode;
  visual?: ReactNode;
  centered?: boolean;
  hideTitle?: boolean;
};

export default function ClientPageHero({
  eyebrow,
  title,
  description,
  gallerySlot,
  children,
  visual,
  centered = false,
  hideTitle = false,
}: ClientPageHeroProps) {
  const { content } = useSiteContent();
  const heroPhoto = getClientGalleryPhotos(
    content.galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  )[gallerySlot];

  return (
    <header
      className={`client-page-hero${centered ? " client-page-hero-centered" : ""}`}
    >
      {heroPhoto && (
        <img
          className="client-page-hero-image"
          src={heroPhoto.url}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="client-page-hero-shade" aria-hidden="true" />
      {visual && <div className="client-page-hero-visual">{visual}</div>}
      <div className="client-page-hero-copy">
        {centered && eyebrow ? (
          <div className="client-page-hero-kicker">
            <span className="eyebrow">{eyebrow}</span>
          </div>
        ) : (
          !centered && eyebrow && <span className="eyebrow">{eyebrow}</span>
        )}
        <h1 className={hideTitle ? "client-page-hero-title-hidden" : undefined}>
          {title}
        </h1>
        {centered && !hideTitle && (
          <div className="client-page-hero-ornament" aria-hidden="true">
            <span />
            <span className="client-page-hero-ornament-gem" />
            <span />
          </div>
        )}
        <p>{description}</p>
        {children && <div className="client-page-hero-actions">{children}</div>}
      </div>
    </header>
  );
}
