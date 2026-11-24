import {
  ArrowUpRight,
  Clock3,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { navigation } from "../data/site";
import { useSiteContent } from "../data/SiteContentContext";

const defaultSocialLinks = [
  { label: "TikTok", url: "https://vm.tiktok.com/ZS9fKAcQoHPGU-P0eoA/" },
  { label: "Facebook", url: "https://www.facebook.com/share/17yfSTbL58/" },
];

function getSocialIcon(label: string, url: string): LucideIcon {
  const platform = `${label} ${url}`.toLowerCase();
  if (platform.includes("facebook")) return Facebook;
  if (platform.includes("instagram")) return Instagram;
  if (platform.includes("youtube")) return Youtube;
  if (platform.includes("linkedin")) return Linkedin;
  if (platform.includes("twitter") || platform.includes("x.com")) return Twitter;
  if (platform.includes("tiktok")) return Music2;
  return ArrowUpRight;
}

export default function SiteFooter() {
  const { content } = useSiteContent();
  const { site } = content;
  const email = site.email.trim() || "annifadione@gmail.com";
  const address = site.address.trim() || "Quartier Médine, Sokone, Sénégal";
  const socialLinks = (
    site.socialLinks.length ? site.socialLinks : defaultSocialLinks
  ).filter((item) => item.url.trim());
  const openingHours = site.openingHours.filter(
    (item) => item.service.trim() && item.hours.trim(),
  );
  const mapUrl = site.coordinates
    ? `https://www.google.com/maps?q=${site.coordinates.latitude},${site.coordinates.longitude}`
    : "https://maps.app.goo.gl/dmh1CR2zPtemMwzX9";

  return (
    <footer className={`site-footer${openingHours.length ? " has-hours" : ""}`}>
      <div className="footer-main">
        <div className="footer-brand-block">
          <Link className="brand footer-brand" to="/">
            <span className="brand-name">{site.name}</span>
            <span className="brand-subtitle">{site.subtitle}</span>
          </Link>
          <p className="footer-intro">
            {site.name}, {site.subtitle} · {site.location}.
          </p>
        </div>

        <nav className="footer-column" aria-label="Liens du pied de page">
          <h2>Découvrir</h2>
          {navigation.filter((item) => item.href !== "/contact").map((item) => (
            <Link key={item.href} to={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className="footer-column">
          <h2>Nous contacter</h2>
          <p>
            <MapPin size={15} aria-hidden="true" />
            <span>{address}</span>
          </p>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer">
              Voir sur la carte <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
          {site.phoneNumber && (
            <a href={`tel:${site.phoneNumber.replace(/[^\d+]/g, "")}`}>
              <Phone size={15} aria-hidden="true" />
              {site.phoneNumber}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`}>
              <Mail size={15} aria-hidden="true" />
              {email}
            </a>
          )}
          {site.whatsappConfirmed && site.whatsappNumber && (
            <a
              href={`https://wa.me/${site.whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={15} aria-hidden="true" />
              WhatsApp
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
          <Link className="footer-contact-link" to="/contact">
            Envoyer un message <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          {socialLinks.length > 0 && (
            <div className="footer-socials">
              <h3>Suivez-nous</h3>
              {socialLinks.map((item) => {
                const SocialIcon = getSocialIcon(item.label, item.url);
                return (
                  <a
                    className="footer-social-link"
                    key={`${item.label}-${item.url}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                  >
                    <SocialIcon size={16} aria-hidden="true" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {openingHours.length > 0 && (
          <div className="footer-column footer-hours">
            <h2>Horaires</h2>
            {openingHours.map((item) => (
              <p key={`${item.service}-${item.hours}`}>
                <Clock3 size={15} aria-hidden="true" />
                <span><strong>{item.service}</strong>{item.hours}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</span>
        <nav className="footer-legal-links" aria-label="Informations légales">
          <Link to="/mentions-legales">Mentions légales</Link>
          <Link to="/politique-confidentialite">Confidentialité</Link>
          <Link to="/politique-cookies">Cookies</Link>
          <Link to="/conditions-utilisation">Conditions</Link>
        </nav>
        <div>
          <span className="footer-credit">
            Site édité par Tritech ·{" "}
            <a
              href="https://wa.me/221783819349"
              target="_blank"
              rel="noreferrer"
              aria-label="Contacter Tritech sur WhatsApp"
            >
              Contactez-nous
            </a>
          </span>
          <Link to="/admin">Administration</Link>
          <a href="#contenu">Retour en haut ↑</a>
        </div>
      </div>
    </footer>
  );
}
