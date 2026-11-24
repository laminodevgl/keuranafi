import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "../data/SiteContentContext";
import useClientPageReveal from "../hooks/useClientPageReveal";

export type LegalDocument =
  | "mentions"
  | "confidentialite"
  | "cookies"
  | "conditions";

const legalDocuments: Record<
  LegalDocument,
  { title: string; description: string }
> = {
  mentions: {
    title: "Mentions légales",
    description: "Éditeur, coordonnées et services utilisés par le site.",
  },
  confidentialite: {
    title: "Politique de confidentialité",
    description: "Données recueillies par les formulaires et leur traitement.",
  },
  cookies: {
    title: "Politique relative aux cookies",
    description: "Stockage de la session d’administration et services tiers.",
  },
  conditions: {
    title: "Conditions d’utilisation",
    description: "Règles des demandes de réservation et commandes en ligne.",
  },
};

const policyLinks = [
  { document: "mentions", label: "Mentions légales", to: "/mentions-legales" },
  {
    document: "confidentialite",
    label: "Confidentialité",
    to: "/politique-confidentialite",
  },
  { document: "cookies", label: "Cookies", to: "/politique-cookies" },
  {
    document: "conditions",
    label: "Conditions d’utilisation",
    to: "/conditions-utilisation",
  },
] as const;

const businessEmail = "annifadione@gmail.com";
const businessAddress = "Quartier Médine, Sokone, Sénégal";
const publisherPhone = "+221 78 381 93 49";

export default function LegalPage({ document }: { document: LegalDocument }) {
  useClientPageReveal(".legal-page");
  const { content } = useSiteContent();
  const { title, description } = legalDocuments[document];
  const email = content.site.email.trim() || businessEmail;
  const address = content.site.address.trim() || businessAddress;
  const siteName = content.site.name || "Keur Ana-Fi";
  const siteSubtitle = content.site.subtitle || "Maison des Bolongs";

  useEffect(() => {
    window.document.title = `${title} — ${siteName}`;
    const metaDescription = window.document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    metaDescription?.setAttribute("content", description);
  }, [description, document, siteName, title]);

  return (
    <main className="legal-page client-page" id="contenu">
      <header className="legal-page-header" data-client-reveal="heading">
        <span className="eyebrow">
          {siteName} · {content.site.location}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <article className="legal-content" data-client-reveal="card">
        {document === "mentions" && (
          <>
            <section data-client-reveal="card">
              <h2>Éditeur et publication</h2>
              <p>
                <strong>
                  {siteName} — {siteSubtitle}
                </strong>
                <br />
                {address}
                <br />
                Publication : Lamine Fall
                <br />
                Téléphone :{" "}
                <a href="tel:+221783819349">{publisherPhone}</a>
                <br />
                E-mail : <a href={`mailto:${email}`}>{email}</a>
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Services utilisés</h2>
              <p>
                Supabase gère les données envoyées par les formulaires et les
                fichiers associés. Une carte Google Maps peut être affichée
                sur la page Contact lorsque les coordonnées de l’établissement
                sont configurées.
              </p>
            </section>
          </>
        )}

        {document === "confidentialite" && (
          <>
            <section data-client-reveal="card">
              <h2>Données recueillies</h2>
              <p>
                <strong>Contact :</strong> nom, téléphone, adresse e-mail
                facultative et message.
              </p>
              <p>
                <strong>Réservation :</strong> prénom, nom, téléphone, chambre,
                dates du séjour, heure d’arrivée estimée et nombre d’adultes et
                d’enfants. Aucun reçu de paiement n’est demandé dans ce
                formulaire actuellement.
              </p>
              <p>
                <strong>Commande au restaurant :</strong> nom, téléphone,
                articles, montant, précisions éventuelles et, en cas de
                livraison, adresse. Une image du reçu de paiement est
                obligatoire.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Utilisation et accès</h2>
              <p>
                Ces informations servent à traiter les messages, demandes de
                réservation et commandes. Elles sont enregistrées avec
                Supabase et accessibles aux administrateurs autorisés de
                Keur Ana-Fi. Les reçus de commande sont conservés dans un
                espace de stockage privé accessible aux administrateurs.
              </p>
              <p>
                Le site ne recueille pas de numéro de carte bancaire. Le
                paiement est effectué séparément auprès de l’opérateur choisi.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Durée de conservation</h2>
              <p>
                Aucune durée automatique de suppression n’est configurée dans
                le site. Pour demander l’accès à vos données, leur correction
                ou leur suppression, contactez{" "}
                <a href={`mailto:${email}`}>{email}</a>.
              </p>
            </section>
          </>
        )}

        {document === "cookies" && (
          <>
            <section data-client-reveal="card">
              <h2>Mesure d’audience et publicité</h2>
              <p>
                Aucun outil de mesure d’audience ni pixel publicitaire n’est
                configuré dans le site.
              </p>
              <p>
                La connexion à l’espace d’administration utilise Supabase Auth.
                Le service peut conserver la session d’administration dans le
                stockage local du navigateur ; il ne s’agit pas d’un cookie.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Google Maps</h2>
              <p>
                Si une carte est affichée sur la page Contact, le navigateur
                charge du contenu fourni par Google Maps. Google peut alors
                recevoir des données techniques, comme l’adresse IP. Consultez
                la{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  politique de confidentialité de Google
                </a>
                .
              </p>
            </section>
          </>
        )}

        {document === "conditions" && (
          <>
            <section data-client-reveal="card">
              <h2>Informations publiées</h2>
              <p>
                Les chambres réservables sont celles publiées avec un tarif.
                Les prix sont calculés par nuit et les disponibilités sont
                vérifiées lors de la demande.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Réservations</h2>
              <p>
                L’envoi du formulaire constitue une demande, pas une
                confirmation de séjour. L’arrivée est prévue à partir de
                14 h 00 et le départ avant 12 h 00 le lendemain de la dernière
                nuit. Toute exception nécessite l’accord de l’établissement.
                Une demande en attente bloque temporairement la chambre pendant
                30 minutes.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Commandes au restaurant</h2>
              <p>
                L’envoi d’une commande ne vaut pas confirmation. Le formulaire
                exige un reçu de paiement. La livraison, si elle est choisie,
                entraîne des frais de 500 FCFA et nécessite une adresse précise.
                Le site ne traite pas directement les paiements par carte.
              </p>
            </section>
            <section data-client-reveal="card">
              <h2>Contact</h2>
              <p>
                Pour toute question au sujet du site, d’une réservation ou
                d’une commande, écrivez à{" "}
                <a href={`mailto:${email}`}>{email}</a>.
              </p>
            </section>
          </>
        )}

        <nav
          className="legal-document-nav"
          aria-label="Autres informations légales"
          data-client-reveal="card"
        >
          <h2>Autres informations</h2>
          {policyLinks
            .filter((item) => item.document !== document)
            .map((item) => (
              <Link key={item.document} to={item.to}>
                {item.label}
              </Link>
            ))}
        </nav>
      </article>
    </main>
  );
}
