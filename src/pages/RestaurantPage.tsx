import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ChefHat,
  ChevronDown,
  GlassWater,
  ShoppingBasket,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  menuCategories,
  type MenuCategory,
} from "../data/restaurant";
import {
  getClientGalleryPhotos,
  getGalleryPhotoAlt,
} from "../data/gallery";
import type { PaymentAccount, PaymentOperator } from "../data/site";
import { getErrorMessage } from "../lib/errorMessage";
import { useSiteContent } from "../data/SiteContentContext";
import { supabase } from "../lib/supabase";

type MenuFilter = "Tout" | MenuCategory;
type OrderReceipt = {
  reference: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  items: { id: string; name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string | null;
  businessName: string;
  businessSubtitle: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  paymentAccounts: PaymentAccount[];
};

const paymentOperatorLabels: Record<PaymentOperator, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
};

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("fr-FR").format(price)} FCFA`;
}

function formatReceiptDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Dakar",
  }).format(new Date(value));
}

async function downloadOrderReceiptImage(receipt: OrderReceipt) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de préparer l’image du reçu.");
  }

  const width = 900;
  const padding = 64;
  const contentWidth = width - padding * 2;
  const operations: Array<(target: CanvasRenderingContext2D) => void> = [];
  let y = padding;

  const addText = (
    text: string,
    x: number,
    top: number,
    maxWidth: number,
    font: string,
    color: string,
    lineHeight: number,
    align: CanvasTextAlign = "left",
  ) => {
    context.font = font;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);

    operations.push((target) => {
      target.font = font;
      target.fillStyle = color;
      target.textAlign = align;
      lines.forEach((lineText, index) => {
        target.fillText(lineText, x, top + index * lineHeight, maxWidth);
      });
    });
    return top + lines.length * lineHeight;
  };

  const addRule = (top: number, color: string, thickness = 1) => {
    operations.push((target) => {
      target.fillStyle = color;
      target.fillRect(padding, top, contentWidth, thickness);
    });
  };

  y = addText(
    `${receipt.businessName} · ${receipt.businessSubtitle}`,
    padding,
    y,
    contentWidth,
    "600 20px Arial, sans-serif",
    "#597061",
    28,
  ) + 16;
  y = addText(
    "Reçu de commande",
    padding,
    y,
    contentWidth,
    "bold 36px Arial, sans-serif",
    "#123d32",
    44,
  ) + 8;
  y = addText(
    `Référence : ${receipt.reference}`,
    padding,
    y,
    contentWidth,
    "18px Arial, sans-serif",
    "#555d54",
    26,
  );
  y = addText(
    formatReceiptDate(receipt.createdAt),
    padding,
    y,
    contentWidth,
    "18px Arial, sans-serif",
    "#555d54",
    26,
  ) + 18;
  addRule(y, "#214638", 3);
  y += 28;

  const addSectionTitle = (title: string) => {
    y = addText(
      title,
      padding,
      y,
      contentWidth,
      "bold 21px Arial, sans-serif",
      "#214638",
      28,
    ) + 8;
  };

  addSectionTitle("Client");
  y = addText(
    receipt.customerName,
    padding,
    y,
    contentWidth,
    "18px Arial, sans-serif",
    "#555d54",
    26,
  );
  y = addText(
    receipt.customerPhone,
    padding,
    y,
    contentWidth,
    "18px Arial, sans-serif",
    "#555d54",
    26,
  );
  if (receipt.deliveryAddress) {
    y = addText(
      `Livraison : ${receipt.deliveryAddress}`,
      padding,
      y,
      contentWidth,
      "18px Arial, sans-serif",
      "#555d54",
      26,
    );
  }
  y += 20;

  addSectionTitle("Détail de la commande");
  receipt.items.forEach((item) => {
    const rowY = y;
    const nameWidth = contentWidth - 210;
    const nameEnd = addText(
      `${item.quantity} × ${item.name}`,
      padding,
      rowY,
      nameWidth,
      "18px Arial, sans-serif",
      "#555d54",
      26,
    );
    addText(
      formatPrice(item.quantity * item.price),
      width - padding,
      rowY,
      200,
      "bold 18px Arial, sans-serif",
      "#555d54",
      26,
      "right",
    );
    y = Math.max(nameEnd, rowY + 26) + 10;
  });
  y += 8;

  const addTotal = (label: string, value: number, isGrandTotal = false) => {
    if (isGrandTotal) {
      y += 12;
      addRule(y, "#dcd7ca");
      y += 16;
    }
    const font = isGrandTotal
      ? "bold 22px Arial, sans-serif"
      : "18px Arial, sans-serif";
    const color = isGrandTotal ? "#123d32" : "#555d54";
    addText(label, padding, y, contentWidth - 210, font, color, 30);
    addText(
      formatPrice(value),
      width - padding,
      y,
      200,
      font,
      color,
      30,
      "right",
    );
    y += 36;
  };

  addTotal("Sous-total", receipt.subtotal);
  if (receipt.deliveryFee > 0) {
    addTotal("Livraison", receipt.deliveryFee);
  }
  addTotal("Total", receipt.total, true);
  y += 12;
  addRule(y, "#e1dccf");
  y += 22;

  addSectionTitle("Coordonnées de Keur Ana-Fi");
  y = addText(
    receipt.businessAddress,
    padding,
    y,
    contentWidth,
    "18px Arial, sans-serif",
    "#555d54",
    26,
  );
  if (receipt.businessPhone) {
    y = addText(
      `Téléphone : ${receipt.businessPhone}`,
      padding,
      y,
      contentWidth,
      "18px Arial, sans-serif",
      "#555d54",
      26,
    );
  }
  if (receipt.businessEmail) {
    y = addText(
      receipt.businessEmail,
      padding,
      y,
      contentWidth,
      "18px Arial, sans-serif",
      "#555d54",
      26,
    );
  }
  if (receipt.paymentAccounts.length > 0) {
    y += 8;
    y = addText(
      "Numéros de paiement",
      padding,
      y,
      contentWidth,
      "bold 18px Arial, sans-serif",
      "#34443a",
      26,
    );
    receipt.paymentAccounts.forEach((account) => {
      y = addText(
        `${paymentOperatorLabels[account.operator]} : ${account.number}`,
        padding,
        y,
        contentWidth,
        "18px Arial, sans-serif",
        "#34443a",
        26,
      );
    });
  }
  canvas.width = width;
  canvas.height = Math.ceil(y + padding);
  const imageContext = canvas.getContext("2d");
  if (!imageContext) {
    throw new Error("Impossible de préparer l’image du reçu.");
  }
  imageContext.fillStyle = "#fff";
  imageContext.fillRect(0, 0, canvas.width, canvas.height);
  imageContext.textBaseline = "top";
  operations.forEach((operation) => operation(imageContext));

  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Le fichier image du reçu n’a pas pu être créé."));
    }, "image/png");
  });
  const imageUrl = URL.createObjectURL(imageBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = imageUrl;
  downloadLink.download = `recu-commande-${receipt.reference}.png`;
  downloadLink.click();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

export default function RestaurantPage() {
  const { content, isLoading } = useSiteContent();
  const { restaurantMenu, galleryPhotos, site } = content;
  const availableMenu = restaurantMenu.filter(
    (item) =>
      !item.suspended &&
      item.name.trim() &&
      item.price != null &&
      Number.isFinite(item.price),
  );
  const clientGalleryPhotos = getClientGalleryPhotos(
    galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  );
  const restaurantExperiencePhotos = [
    clientGalleryPhotos["restaurant-experience-1"],
    clientGalleryPhotos["restaurant-experience-2"],
    clientGalleryPhotos["restaurant-experience-3"],
  ].flatMap((photo) => (photo ? [photo] : []));
  const restaurantHeroPhoto = clientGalleryPhotos["restaurant-hero"];
  const restaurantProofDisplayPhoto = clientGalleryPhotos["restaurant-proof"];
  const [activeFilter, setActiveFilter] = useState<MenuFilter>("Tout");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandableDescriptions, setExpandableDescriptions] = useState<Set<string>>(
    () => new Set(),
  );
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderReceipt, setOrderReceipt] = useState<OrderReceipt | null>(null);
  const [receiptDownloadError, setReceiptDownloadError] = useState("");
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [deliverySelected, setDeliverySelected] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const cartButtonRef = useRef<HTMLButtonElement | null>(null);
  const cartItems = availableMenu
    .filter((item) => (cart[item.id] ?? 0) > 0 && item.price !== undefined)
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantity: cart[item.id],
      price: item.price ?? 0,
    }));
  const cartTotal = cartItems.reduce(
    (total, item) => total + item.quantity * item.price,
    0,
  );
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const deliveryFee = deliverySelected ? 500 : 0;
  const orderTotal = cartTotal + deliveryFee;

  const categories: MenuFilter[] = [
    "Tout",
    ...menuCategories.filter((category) =>
      availableMenu.some((item) => item.category === category),
    ),
    ...(availableMenu.some((item) => item.category === "Cocktails")
      ? ["Cocktails" as const]
      : []),
  ];
  const filteredItems =
    activeFilter === "Tout"
      ? availableMenu
      : availableMenu.filter((item) => item.category === activeFilter);
  const descriptionContentKey = filteredItems
    .map((item) => `${item.id}:${item.description}`)
    .join("|");

  useEffect(() => {
    const paragraphs = Array.from(
      document.querySelectorAll<HTMLParagraphElement>(
        ".restaurant-page .restaurant-menu-description p[data-menu-description-id]",
      ),
    );
    const measureExpandableDescriptions = () => {
      const expandable = new Set<string>();
      paragraphs.forEach((paragraph) => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const lines = new Set(
          Array.from(range.getClientRects())
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.round(rect.top)),
        );
        const id = paragraph.dataset.menuDescriptionId;
        if (id && lines.size > 1) expandable.add(id);
      });
      setExpandableDescriptions((current) => {
        if (
          current.size === expandable.size &&
          [...current].every((id) => expandable.has(id))
        ) {
          return current;
        }
        return expandable;
      });
    };

    measureExpandableDescriptions();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureExpandableDescriptions);
    paragraphs.forEach((paragraph) => {
      if (paragraph.parentElement) observer?.observe(paragraph.parentElement);
    });
    let isMounted = true;
    document.fonts?.ready.then(() => {
      if (isMounted) measureExpandableDescriptions();
    });

    return () => {
      isMounted = false;
      observer?.disconnect();
    };
  }, [descriptionContentKey]);

  useEffect(() => {
    document.title = "Restaurant & Bar à Sokone — Keur Ana-Fi";
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    description?.setAttribute(
      "content",
      "Découvrez le restaurant et le bar de Keur Ana-Fi, Maison des Bolongs à Sokone. Consultez la carte et les informations confirmées.",
    );
  }, []);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".restaurant-page");
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
      page.querySelectorAll<HTMLElement>("[data-restaurant-reveal]").forEach((element) => {
        if (observed.has(element)) return;
        observed.add(element);
        observer.observe(element);
      });
    };

    page.classList.add("restaurant-reveal-ready");
    observeNewElements();
    const mutations = new MutationObserver(observeNewElements);
    mutations.observe(page, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      page.classList.remove("restaurant-reveal-ready");
    };
  }, []);

  useEffect(() => {
    if (!isOrderModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOrderModalOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      cartButtonRef.current?.focus();
    };
  }, [isOrderModalOpen]);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setOrderError("");
    setOrderSuccess("");
    if (!supabase) {
      setOrderError("La commande en ligne est momentanément indisponible.");
      return;
    }
    if (!cartItems.length) {
      setOrderError("Ajoutez au moins un plat à votre commande.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const receiptEntry = formData.get("receipt");
    const receiptFile =
      receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null;
    if (!receiptFile) {
      setOrderError("Ajoutez le reçu de paiement pour envoyer votre commande.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(receiptFile.type)) {
      setOrderError("Le reçu doit être une image JPG, PNG ou WEBP.");
      return;
    }
    if (receiptFile.size > 10 * 1024 * 1024) {
      setOrderError("Le reçu ne doit pas dépasser 10 Mo.");
      return;
    }
    const deliveryAddress = String(formData.get("delivery_address") ?? "").trim();
    if (deliverySelected && deliveryAddress.length < 5) {
      setOrderError("Veuillez indiquer une adresse de livraison précise.");
      return;
    }
    const customerNote = String(formData.get("note") ?? "").trim();
    const orderNote = [
      deliverySelected
        ? `Livraison à domicile (+500 FCFA) — Adresse : ${deliveryAddress}`
        : "À récupérer au restaurant",
      customerNote ? `Précisions : ${customerNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    setIsSubmittingOrder(true);
    let uploadedReceiptPath: string | null = null;
    let orderSubmissionPhase = "téléversement du reçu";
    try {
      const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      uploadedReceiptPath = `pending/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("restaurant-order-receipts")
        .upload(uploadedReceiptPath, receiptFile, {
          contentType: receiptFile.type,
          upsert: false,
        });
      if (uploadError) {
        if ("statusCode" in uploadError && uploadError.statusCode === "404") {
          throw new Error(
            "Le stockage des reçus n’est pas encore configuré. Contactez l’établissement.",
          );
        }
        throw uploadError;
      }

      orderSubmissionPhase = "enregistrement de la commande";
      const orderId = crypto.randomUUID();
      const { error } = await supabase.from("restaurant_orders").insert({
        id: orderId,
        name: String(formData.get("name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        items: cartItems,
        total: orderTotal,
        note: orderNote,
        receipt_path: uploadedReceiptPath,
      });
      if (error) throw error;
      setOrderReceipt({
        reference: orderId.slice(0, 8).toUpperCase(),
        createdAt: new Date().toISOString(),
        customerName: String(formData.get("name") ?? "").trim(),
        customerPhone: String(formData.get("phone") ?? "").trim(),
        items: cartItems.map((item) => ({ ...item })),
        subtotal: cartTotal,
        deliveryFee,
        total: orderTotal,
        deliveryAddress: deliverySelected ? deliveryAddress : null,
        businessName: site.name,
        businessSubtitle: site.subtitle,
        businessAddress: site.address || site.location,
        businessPhone: site.phoneNumber,
        businessEmail: site.email,
        paymentAccounts: site.paymentAccounts.map((account) => ({ ...account })),
      });
      setOrderSuccess("Votre commande a été envoyée au restaurant.");
      setCart({});
      setDeliverySelected(false);
      form.reset();
    } catch (error) {
      console.error("Échec de l’enregistrement de la commande.", error);
      if (uploadedReceiptPath) {
        const { error: cleanupError } = await supabase.storage
          .from("restaurant-order-receipts")
          .remove([uploadedReceiptPath]);
        if (cleanupError) {
          console.error("Le reçu téléversé n’a pas pu être supprimé après l’échec de la commande.", cleanupError);
        }
      }
      setOrderError(
        `Échec pendant l’étape « ${orderSubmissionPhase} » : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <main className="restaurant-page client-page" id="contenu">
      <header className="restaurant-hero">
        <div className="restaurant-hero-background" aria-hidden="true">
          {restaurantHeroPhoto && (
            <img
              src={restaurantHeroPhoto.url}
              alt=""
              className="restaurant-hero-background-image"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="restaurant-hero-shade" />
        </div>
        <div
          className="restaurant-hero-copy"
          data-restaurant-reveal="hero-copy"
        >
          <h1>Le goût du partage, à Sokone.</h1>
          <p>
            {availableMenu.length
              ? `Découvrez les ${availableMenu.length} références publiées et composez votre commande en quelques gestes.`
              : `Découvrez le restaurant et le bar de ${site.name}, au cœur de ${site.location}.`}
          </p>
          <div className="restaurant-hero-actions">
            <a className="button button-gold" href="#carte">
              Explorer la carte <ArrowRight size={16} />
            </a>
            <Link className="restaurant-hero-contact" to="/contact">
              Préparer ma visite <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="restaurant-hero-seal" aria-hidden="true">
          <span>Une parenthèse</span>
          <ChefHat size={28} strokeWidth={1.2} />
          <strong>gourmande</strong>
        </div>
      </header>

      <button
        className="restaurant-floating-cart"
        type="button"
        ref={cartButtonRef}
        aria-label={`Continuer la commande, ${cartItemCount} article(s) dans le panier`}
        onClick={() => {
          setOrderError("");
          if (!orderReceipt) setOrderSuccess("");
          setIsOrderModalOpen(true);
        }}
      >
        <ShoppingBasket size={22} aria-hidden="true" />
        <span>Panier</span>
        <strong>{cartItemCount}</strong>
      </button>

      <section
        className="restaurant-experience section-pad"
        data-restaurant-reveal="experience-panel"
      >
        <div
          className="restaurant-experience-heading"
          data-restaurant-reveal="heading"
        >
          <span className="eyebrow">L’expérience culinaire</span>
          <h2>Des saveurs à partager</h2>
          <p>
            Découvrez notre restaurant et notre bar, où se rencontrent cuisine
            savoureuse, moments de détente et convivialité.
          </p>
        </div>
        {restaurantExperiencePhotos.length ? (
          <div
            className={`restaurant-experience-gallery restaurant-experience-gallery-count-${restaurantExperiencePhotos.length}`}
            role="group"
            aria-label="Photos de la galerie Keur Ana-Fi"
          >
            {restaurantExperiencePhotos.map((photo) => (
              <figure
                className="restaurant-experience-image"
                key={photo.id}
                data-restaurant-reveal="feature"
              >
                <img
                  src={photo.url}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        ) : (
          <p className="restaurant-experience-empty" role="status">
            Les photos apparaîtront ici dès qu’elles seront publiées dans la
            galerie.
          </p>
        )}
      </section>

      <section
        className="restaurant-menu-section section-pad"
        id="carte"
      >
        <div
          className="restaurant-menu-heading"
          data-restaurant-reveal="heading"
        >
          <h2 className="restaurant-menu-section-title">AU MENU</h2>
          <p>
            Explorez notre sélection de plats et de boissons. Choisissez vos
            envies et passez commande directement auprès de Keur Ana-Fi.
          </p>
        </div>

        {availableMenu.length > 0 && (
          <div className="menu-filters" aria-label="Filtrer par catégorie">
            {categories.map((category) => (
              <button
                className={`menu-filter${activeFilter === category ? " is-active" : ""}`}
                type="button"
                key={category}
                aria-pressed={activeFilter === category}
                onClick={() => setActiveFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {isLoading && !availableMenu.length ? (
          <div className="restaurant-menu-loading" role="status">
            <span className="restaurant-menu-loading-indicator" aria-hidden="true" />
            La carte est en cours de chargement…
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="restaurant-menu-grid">
            {filteredItems.map((item) => {
              const CategoryIcon =
                item.category === "Boissons" || item.category === "Cocktails"
                  ? GlassWater
                  : UtensilsCrossed;
              const isDescriptionExpanded = expandedDescriptions.has(item.id);
              const isDescriptionExpandable = expandableDescriptions.has(item.id);
              return (
                <article
                  className="restaurant-menu-card"
                  key={item.id}
                  data-restaurant-reveal="dish"
                >
                  <div className="restaurant-menu-art">
                    {item.image ? (
                      <>
                        <img
                          className="restaurant-menu-art-backdrop"
                          src={item.image}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                        />
                        <img
                          className="restaurant-menu-art-photo"
                          src={item.image}
                          alt=""
                          loading="lazy"
                        />
                      </>
                    ) : (
                      <div className="restaurant-menu-placeholder" aria-hidden="true">
                        <CategoryIcon size={38} strokeWidth={1.1} />
                      </div>
                    )}
                    {item.price != null && (
                      <span className="restaurant-menu-price-badge">
                        {formatPrice(item.price)}
                      </span>
                    )}
                  </div>
                  <div className="restaurant-menu-content">
                    <div className="restaurant-menu-title">
                      <h3>{item.name}</h3>
                    </div>
                    {item.description && (
                      <div
                        className={`restaurant-menu-description${isDescriptionExpanded ? " is-expanded" : ""}`}
                      >
                        <p
                          id={`restaurant-menu-description-${item.id}`}
                          data-menu-description-id={item.id}
                          className={isDescriptionExpanded ? "is-expanded" : ""}
                        >
                          {item.description}
                        </p>
                        {isDescriptionExpandable && (
                          <button
                            className="restaurant-menu-description-toggle"
                            type="button"
                            aria-expanded={isDescriptionExpanded}
                            aria-controls={`restaurant-menu-description-${item.id}`}
                            onClick={() => {
                              setExpandedDescriptions((current) => {
                                const next = new Set(current);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                          >
                            {isDescriptionExpanded ? "Voir moins" : "Voir plus"}
                            <ChevronDown size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="restaurant-menu-actions">
                      <button
                        className="restaurant-menu-add"
                        type="button"
                        aria-label={`Ajouter ${item.name} au panier`}
                        onClick={() => {
                          setOrderSuccess("");
                          setOrderReceipt(null);
                          setCart((current) => ({
                            ...current,
                            [item.id]: (current[item.id] ?? 0) + 1,
                          }));
                        }}
                      >
                        <ShoppingBasket size={16} aria-hidden="true" />
                        {`Ajouter au panier${cart[item.id] ? ` · ${cart[item.id]}` : ""}`}
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="menu-empty" role="status">
            <UtensilsCrossed size={23} strokeWidth={1.4} />
            <h3>
              {activeFilter === "Tout"
                ? "Aucune carte publiée pour le moment"
                : `Aucun plat publié dans « ${activeFilter} »`}
            </h3>
            <p>
              Contactez {site.name} pour toute question sur le restaurant.
            </p>
          </div>
        )}
      </section>

      <section
        className="restaurant-proof section-pad"
        data-restaurant-reveal="proof-panel"
      >
        <div className="restaurant-proof-layout">
          <div
            className="restaurant-proof-copy"
            data-restaurant-reveal="proof"
          >
            <span className="eyebrow">Les saveurs à l’honneur</span>
            <h2>Une cuisine généreuse à partager</h2>
            <p>
              Des saveurs sénégalaises, des plats généreux et le plaisir de se
              retrouver autour d’une belle table : découvrez une cuisine
              conviviale, pensée pour le partage.
            </p>
            <div className="restaurant-proof-stats">
              <article data-restaurant-reveal="stat">
                <strong>+100</strong>
                <span>plats différents</span>
              </article>
              <article data-restaurant-reveal="stat">
                <strong>Personnel</strong>
                <span>qualifié et à votre écoute</span>
              </article>
            </div>
            {(site.phoneNumber || site.email) && (
              <div className="restaurant-proof-contact-details">
                {site.phoneNumber && (
                  <a href={`tel:${site.phoneNumber.replace(/[^\d+]/g, "")}`}>
                    {site.phoneNumber}
                  </a>
                )}
                {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
              </div>
            )}
            <div className="restaurant-proof-actions">
              <a className="button button-gold" href="#carte">
                Commander maintenant <ArrowRight size={16} />
              </a>
              {site.whatsappConfirmed && site.whatsappNumber && (
                <a
                  className="restaurant-proof-whatsapp"
                  href={`https://wa.me/${site.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Écrire sur WhatsApp <ArrowRight size={15} />
                </a>
              )}
            </div>
          </div>
          {restaurantProofDisplayPhoto && (
            <figure
              className="restaurant-proof-image"
              data-restaurant-reveal="image"
            >
              <img
                src={restaurantProofDisplayPhoto.url}
                alt={getGalleryPhotoAlt(restaurantProofDisplayPhoto)}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.parentElement?.style.setProperty(
                    "display",
                    "none",
                  );
                }}
              />
            </figure>
          )}
        </div>
      </section>

      {isOrderModalOpen && (
        <div
          className="restaurant-order-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOrderModalOpen(false);
            }
          }}
        >
          <section
            className="restaurant-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={orderReceipt ? undefined : "restaurant-order-modal-title"}
            aria-label={orderReceipt ? "Télécharger le reçu de paiement" : undefined}
          >
            {!orderReceipt && (
              <header className="restaurant-order-modal-header">
                <div>
                  <h2 id="restaurant-order-modal-title">Votre panier</h2>
                </div>
                <button
                  className="restaurant-order-modal-close"
                  type="button"
                  ref={closeButtonRef}
                  aria-label="Fermer le panier"
                  onClick={() => setIsOrderModalOpen(false)}
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </header>
            )}
            {cartItems.length ? (
              <div className="restaurant-order-modal-body">
                <ul className="restaurant-cart-list" aria-label="Articles de la commande">
                  {cartItems.map((item) => (
                    <li className="restaurant-cart-item" key={item.id}>
                      <div className="restaurant-cart-item-details">
                        <strong>{item.name}</strong>
                        <span>{formatPrice(item.price)} / unité</span>
                      </div>
                      <div className="restaurant-cart-item-side">
                        <span className="restaurant-cart-controls">
                          <button
                            type="button"
                            aria-label={`Retirer une portion de ${item.name}`}
                            onClick={() =>
                              setCart((current) => {
                                const nextQuantity = (current[item.id] ?? 0) - 1;
                                if (nextQuantity <= 0) {
                                  const next = { ...current };
                                  delete next[item.id];
                                  return next;
                                }
                                return { ...current, [item.id]: nextQuantity };
                              })
                            }
                          >
                            −
                          </button>
                          <strong>{item.quantity}</strong>
                          <button
                            type="button"
                            aria-label={`Ajouter une portion de ${item.name}`}
                            onClick={() =>
                              setCart((current) => ({
                                ...current,
                                [item.id]: (current[item.id] ?? 0) + 1,
                              }))
                            }
                          >
                            +
                          </button>
                        </span>
                        <strong className="restaurant-cart-line-total">
                          {formatPrice(item.quantity * item.price)}
                        </strong>
                      </div>
                    </li>
                  ))}
                  <li className="restaurant-cart-total">
                    <span>Sous-total</span>
                    <strong>{formatPrice(cartTotal)}</strong>
                  </li>
                  {deliverySelected && (
                    <li className="restaurant-cart-total">
                      <span>Livraison</span>
                      <strong>{formatPrice(deliveryFee)}</strong>
                    </li>
                  )}
                  <li className="restaurant-cart-total restaurant-cart-grand-total">
                    <strong>Total à payer</strong>
                    <strong>{formatPrice(orderTotal)}</strong>
                  </li>
                </ul>
                <form
                  className="restaurant-order-form"
                  onSubmit={(event) => void submitOrder(event)}
                >
                  <label>
                    Nom complet *
                    <input name="name" autoComplete="name" minLength={2} maxLength={100} required />
                  </label>
                  <label>
                    Téléphone *
                    <input name="phone" type="tel" autoComplete="tel" minLength={6} maxLength={30} required />
                  </label>
                  <label className="restaurant-order-receipt">
                    <span>Reçu de paiement *</span>
                    <span className="restaurant-order-field-note">JPG, PNG ou WEBP · 10 Mo max</span>
                    <input
                      name="receipt"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </label>
                  <label className="restaurant-delivery-option">
                    <input
                      name="delivery"
                      type="checkbox"
                      checked={deliverySelected}
                      onChange={(event) => setDeliverySelected(event.currentTarget.checked)}
                    />
                    <span>Livraison à domicile (+500 FCFA)</span>
                  </label>
                  {deliverySelected && (
                    <label>
                      Adresse exacte de livraison *
                      <textarea
                        name="delivery_address"
                        rows={2}
                        minLength={5}
                        maxLength={400}
                        autoComplete="street-address"
                        required
                      />
                    </label>
                  )}
                  <label>
                    Précisions (facultatif)
                    <textarea name="note" rows={3} maxLength={1400} />
                  </label>
                  {orderError && <p className="admin-error" role="alert">{orderError}</p>}
                  {orderSuccess && <p className="admin-success" role="status">{orderSuccess}</p>}
                  <button
                    className="button button-gold"
                    type="submit"
                    disabled={isSubmittingOrder}
                  >
                    {isSubmittingOrder ? "Envoi…" : "Envoyer la commande"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="restaurant-order-empty">
                {orderReceipt ? (
                  <>
                    <article className="restaurant-order-receipt-print">
                      <header>
                        <span className="eyebrow">
                          {orderReceipt.businessName} · {orderReceipt.businessSubtitle}
                        </span>
                        <h3>Reçu de commande</h3>
                        <p>Référence : {orderReceipt.reference}</p>
                        <p>{formatReceiptDate(orderReceipt.createdAt)}</p>
                      </header>
                      <section>
                        <h4>Client</h4>
                        <p>{orderReceipt.customerName}</p>
                        <p>{orderReceipt.customerPhone}</p>
                        {orderReceipt.deliveryAddress && (
                          <p>Livraison : {orderReceipt.deliveryAddress}</p>
                        )}
                      </section>
                      <section>
                        <h4>Détail de la commande</h4>
                        <ul>
                          {orderReceipt.items.map((item) => (
                            <li key={item.id}>
                              <span>{item.quantity} × {item.name}</span>
                              <strong>{formatPrice(item.quantity * item.price)}</strong>
                            </li>
                          ))}
                        </ul>
                        <p className="restaurant-receipt-total">
                          <span>Sous-total</span>
                          <strong>{formatPrice(orderReceipt.subtotal)}</strong>
                        </p>
                        {orderReceipt.deliveryFee > 0 && (
                          <p className="restaurant-receipt-total">
                            <span>Livraison</span>
                            <strong>{formatPrice(orderReceipt.deliveryFee)}</strong>
                          </p>
                        )}
                        <p className="restaurant-receipt-total is-grand-total">
                          <span>Total</span>
                          <strong>{formatPrice(orderReceipt.total)}</strong>
                        </p>
                      </section>
                      <footer>
                        <h4>Coordonnées de Keur Ana-Fi</h4>
                        <p>{orderReceipt.businessAddress}</p>
                        {orderReceipt.businessPhone && (
                          <p>Téléphone : {orderReceipt.businessPhone}</p>
                        )}
                        {orderReceipt.businessEmail && <p>{orderReceipt.businessEmail}</p>}
                        {orderReceipt.paymentAccounts.length > 0 && (
                          <div className="restaurant-receipt-payments">
                            <strong>Numéros de paiement</strong>
                            {orderReceipt.paymentAccounts.map((account) => (
                              <p key={account.id}>
                                {paymentOperatorLabels[account.operator]} : {account.number}
                              </p>
                            ))}
                          </div>
                        )}
                      </footer>
                    </article>
                    <div className="restaurant-order-receipt-actions">
                      <button
                        className="button button-gold"
                        type="button"
                        disabled={isDownloadingReceipt}
                        onClick={async () => {
                          setReceiptDownloadError("");
                          setIsDownloadingReceipt(true);
                          try {
                            await downloadOrderReceiptImage(orderReceipt);
                          } catch (error) {
                            console.error("Échec du téléchargement du reçu en image.", error);
                            setReceiptDownloadError(
                              `Le reçu n’a pas pu être téléchargé : ${getErrorMessage(error)}`,
                            );
                          } finally {
                            setIsDownloadingReceipt(false);
                          }
                        }}
                      >
                        {isDownloadingReceipt
                          ? "Préparation du reçu…"
                          : "Télécharger mon reçu"}
                      </button>
                      <button
                        className="button button-outline"
                        type="button"
                        onClick={() => setIsOrderModalOpen(false)}
                      >
                        Fermer
                      </button>
                    </div>
                    {receiptDownloadError && (
                      <p className="admin-error" role="alert">{receiptDownloadError}</p>
                    )}
                  </>
                ) : (
                  <>
                    {orderSuccess ? (
                      <p className="admin-success" role="status">{orderSuccess}</p>
                    ) : (
                      <p>Votre panier est vide. Choisissez des plats sur la carte pour continuer.</p>
                    )}
                    {orderError && <p className="admin-error" role="alert">{orderError}</p>}
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => setIsOrderModalOpen(false)}
                    >
                      Retour à la carte
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

    </main>
  );
}
