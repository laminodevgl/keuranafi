import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import ClientPageHero from "../components/ClientPageHero";
import { useSiteContent } from "../data/SiteContentContext";
import useClientPageReveal from "../hooks/useClientPageReveal";
import { supabase } from "../lib/supabase";

const contactSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Veuillez saisir votre nom complet.")
    .max(100, "Le nom ne doit pas dépasser 100 caractères."),
  phone: z
    .string()
    .trim()
    .min(6, "Veuillez saisir un numéro de téléphone valide.")
    .max(30, "Le numéro de téléphone est trop long."),
  email: z
    .union([
      z.literal(""),
      z.string().trim().email("L’adresse e-mail n’est pas valide."),
    ])
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "Votre message doit contenir au moins 10 caractères.")
    .max(3000, "Votre message ne doit pas dépasser 3 000 caractères."),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const contactPhoneNumbers = [
  { display: "33 948 30 11", href: "tel:+221339483011" },
  { display: "77 905 51 67", href: "tel:+221779055167" },
  { display: "77 364 64 19", href: "tel:+221773646419" },
];
const contactEmail = "annifadione@gmail.com";

function mapsUrl(site: {
  coordinates: { latitude: number; longitude: number } | null;
  address: string;
  name: string;
  subtitle: string;
  location: string;
}) {
  const query = site.coordinates
    ? `${site.coordinates.latitude},${site.coordinates.longitude}`
    : [site.address, site.name, site.subtitle, site.location]
        .filter(Boolean)
        .join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function ContactPage() {
  useClientPageReveal(".contact-page", true);
  const { content } = useSiteContent();
  const { site } = content;
  const [messageSent, setMessageSent] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      message: "",
    },
  });

  useEffect(() => {
    if (!messageSent) return;
    const timeoutId = window.setTimeout(() => setMessageSent(false), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [messageSent]);

  useEffect(() => {
    document.title = "Contact — Keur Ana-Fi, Maison des Bolongs";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      "Contactez Keur Ana-Fi, Maison des Bolongs à Sokone, pour une question sur l’hébergement, le restaurant ou votre séjour.",
    );
  }, []);

  const onSubmit = async (values: ContactFormValues) => {
    setSubmissionError("");
    if (!supabase) {
      setSubmissionError(
        "Le formulaire n’est pas connecté à Supabase. Réessayez plus tard ou contactez l’établissement directement.",
      );
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("contact_messages")
        .insert({
          full_name: values.fullName,
          phone: values.phone,
          email: values.email ?? "",
          subject: "Message de contact",
          request_type: "Message général",
          message: values.message,
        });
      if (insertError) throw insertError;
    } catch (insertError) {
      console.error("Échec de l’enregistrement du message de contact.", insertError);
      setSubmissionError(
        "Votre message n’a pas pu être enregistré. Vérifiez votre connexion puis réessayez.",
      );
      return;
    }

    setMessageSent(true);
    reset();
  };

  const address = site.address.trim();
  const openingHours = site.openingHours.filter(
    (hours) => hours.service.trim() && hours.hours.trim(),
  );
  const hasHours = openingHours.length > 0;

  return (
    <main className="contact-page client-page" id="contenu">
      <ClientPageHero
        gallerySlot="contact-hero"
        centered
        title={
          <>
            Nous sommes{" "}
            <span className="contact-hero-title-accent">à votre écoute</span>
          </>
        }
        description={
          <>
            Une question, une <strong>demande d’information</strong> ou un
            besoin particulier ? Notre équipe est disponible pour vous
            répondre.
          </>
        }
      >
        <a className="button button-light" href="#formulaire">
          Nous écrire <ArrowRight size={16} />
        </a>
      </ClientPageHero>

      <section
        className="contact-details-section section-pad"
        data-client-reveal="section"
      >
        <div className="contact-details-grid">
          {contactPhoneNumbers.map(({ display, href }) => (
            <a
              className="contact-detail"
              data-client-reveal="card"
              href={href}
              key={href}
            >
              <span className="contact-detail-icon">
                <Phone size={20} />
              </span>
              <span>
                <strong>Téléphone</strong>
                <small>{display}</small>
              </span>
              <ArrowRight className="contact-detail-arrow" size={16} />
            </a>
          ))}
          <a
            className="contact-detail"
            data-client-reveal="card"
            href={`mailto:${contactEmail}`}
          >
            <span className="contact-detail-icon">
              <Mail size={20} />
            </span>
            <span>
              <strong>E-mail</strong>
              <small>{contactEmail}</small>
            </span>
            <ArrowRight className="contact-detail-arrow" size={16} />
          </a>
        </div>
      </section>

      <section
        className="contact-form-section section-pad"
        id="formulaire"
        data-client-reveal="section"
      >
        <div className="contact-form-intro" data-client-reveal="card">
          <span className="eyebrow">Nous écrire</span>
          <h2>Comment pouvons-nous vous aider ?</h2>
          <p>
            Envoyez-nous votre message. Il sera enregistré dans l’administration
            afin que notre équipe puisse vous répondre.
          </p>
          <div className="contact-privacy-note">
            <CheckCircle2 size={18} />
            <span>
              Vos informations seront enregistrées afin que l’établissement
              puisse traiter votre demande.
            </span>
          </div>
        </div>

        <div className="contact-form-card" data-client-reveal="card">
          {messageSent && (
            <div className="contact-prepared" role="status" aria-live="polite">
              <CheckCircle2 size={24} aria-hidden="true" />
              <div>
                <h3>Message envoyé avec succès</h3>
                <p>
                  Votre message a bien été reçu par Keur Ana-Fi. Notre équipe
                  vous répondra dès que possible.
                </p>
              </div>
            </div>
          )}
          <form
            className="contact-form"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="contact-form-row">
              <label>
                Nom complet *
                <input
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "contact-name-error" : undefined}
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <span className="contact-field-error" id="contact-name-error">
                    {errors.fullName.message}
                  </span>
                )}
              </label>
              <label>
                Numéro de téléphone *
                <input
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "contact-phone-error" : undefined}
                  {...register("phone")}
                />
                {errors.phone && (
                  <span className="contact-field-error" id="contact-phone-error">
                    {errors.phone.message}
                  </span>
                )}
              </label>
            </div>

            <label>
              Adresse e-mail (facultative)
              <input
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <span className="contact-field-error" id="contact-email-error">
                  {errors.email.message}
                </span>
              )}
            </label>

            <label>
              Votre message *
              <textarea
                rows={6}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                {...register("message")}
              />
              {errors.message && (
                <span className="contact-field-error" id="contact-message-error">
                  {errors.message.message}
                </span>
              )}
            </label>

            <button
              className="button button-gold contact-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="contact-spinner" size={17} />
                  Envoi…
                </>
              ) : (
                <>
                  Envoyer mon message <Send size={16} />
                </>
              )}
            </button>
            {submissionError && (
              <p className="contact-field-error" role="alert">
                {submissionError}
              </p>
            )}
          </form>
        </div>
      </section>

      <section
        className={`contact-location-section section-pad${site.coordinates ? "" : " contact-location-section--no-map"}`}
        data-client-reveal="section"
      >
        <div className="contact-location-copy" data-client-reveal="card">
          <span className="eyebrow">Notre adresse</span>
          <h2>Où nous trouver</h2>
          <p>{address || site.location}</p>
          <a
            className="button button-gold contact-location-button"
            href={mapsUrl(site)}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans Google Maps <ExternalLink size={16} />
          </a>
        </div>
        {site.coordinates && (
          <iframe
            className="contact-map-embed"
            data-client-reveal="card"
            title="Carte Google Maps de Keur Ana-Fi"
            src={`https://www.google.com/maps?q=${site.coordinates.latitude},${site.coordinates.longitude}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        )}
      </section>

      {hasHours && (
        <section
          className="contact-hours-section section-pad"
          data-client-reveal="section"
        >
          <div className="contact-details-heading" data-client-reveal="heading">
            <span className="eyebrow">Planifier votre visite</span>
            <h2>Horaires</h2>
          </div>
          <div className="contact-hours-list">
            {openingHours.map((hours) => (
              <div key={hours.service} data-client-reveal="card">
                <Clock3 size={18} />
                <strong>{hours.service}</strong>
                <span>{hours.hours}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        className="contact-faq-section section-pad"
        data-client-reveal="section"
      >
        <div className="contact-details-heading" data-client-reveal="heading">
          <span className="eyebrow">Questions fréquentes</span>
          <h2>Avant de nous écrire</h2>
        </div>
        <div className="faq-list">
          <details data-client-reveal="card">
            <summary>Comment réserver une chambre ?</summary>
            <p>
              Envoyez une demande via la page{" "}
              <Link to="/reservation">Réservation</Link>. La disponibilité doit
              être confirmée par l’établissement.
            </p>
          </details>
          <details data-client-reveal="card">
            <summary>Comment contacter le restaurant ?</summary>
            <p>
              Écrivez-nous via le formulaire en précisant votre question sur le
              restaurant.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
