import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { accommodations, type Accommodation } from "./accommodations";
import { events, type EventItem } from "./events";
import {
  clientGallerySlots,
  galleryPhotos,
  type ClientGallerySelection,
  type GalleryPhoto,
} from "./gallery";
import {
  menuCategories,
  restaurantMenu,
  type MenuItem,
} from "./restaurant";
import {
  site,
  type PaymentAccount,
  type SiteSettings,
} from "./site";
import { getErrorMessage } from "../lib/errorMessage";
import { supabase } from "../lib/supabase";

export type SiteContent = {
  site: SiteSettings;
  accommodations: Accommodation[];
  restaurantMenu: MenuItem[];
  galleryPhotos: GalleryPhoto[];
  homeGalleryPhotoIds: string[] | null;
  clientGalleryPhotoIds: ClientGallerySelection | null;
  events: EventItem[];
  amenityOptions: string[];
  homeContent: {
    heroTitle: string;
    heroDescription: string;
    welcomeTitle: string;
    welcomeDescription: string;
    stayTitle: string;
    stayDescription: string;
    stayFeatureTitle: string;
    stayFeatureDescription: string;
    restaurantTitle: string;
    restaurantDescription: string;
    eventsTitle: string;
    eventsDescription: string;
    galleryTitle: string;
    galleryDescription: string;
  };
};

const defaultContent: SiteContent = {
  site,
  accommodations,
  restaurantMenu,
  galleryPhotos,
  homeGalleryPhotoIds: null,
  clientGalleryPhotoIds: null,
  events,
  amenityOptions: [
    "climatisation",
    "ventilateur",
    "salle de bain privée",
    "salle de bain commune",
    "toilettes privées",
    "toilettes communes",
    "douche",
    "baignoire",
    "eau chaude",
    "Wi-Fi",
    "télévision",
    "armoire",
    "penderie",
    "bureau",
    "table",
    "chaise",
    "miroir",
    "prises électriques",
    "lampes de chevet",
    "draps",
    "couvertures",
    "oreillers",
    "serviettes de toilette",
    "moustiquaire",
    "rideaux",
    "fenêtre",
    "balcon",
    "terrasse",
    "vue sur le jardin",
    "vue sur la mer",
    "réfrigérateur",
    "mini-bar",
    "bouilloire électrique",
    "cafetière",
    "téléphone",
    "coffre-fort",
    "sèche-cheveux",
    "articles de toilette",
    "savon",
    "papier toilette",
    "service de ménage",
    "petit-déjeuner inclus",
    "espace de rangement",
    "table de chevet",
    "fauteuil",
    "canapé",
  ],
  homeContent: {
    heroTitle: "Votre escale au cœur du Sine-Saloum",
    heroDescription:
      "Séjournez, savourez et découvrez les bolongs depuis Keur Ana-Fi, à Sokone.",
    welcomeTitle: "Bienvenue à la Maison des Bolongs",
    welcomeDescription:
      "À Sokone, Keur Ana-Fi réunit hébergement et restauration dans un territoire façonné par l’eau, la mangrove et la douceur du Sine-Saloum. Une escale pour prendre le temps et découvrir la région à votre rythme.",
    stayTitle: "Le plaisir de faire une pause",
    stayDescription:
      "Une escale pensée pour découvrir Sokone et profiter du calme du Sine-Saloum.",
    stayFeatureTitle: "Une escale pensée pour vous",
    stayFeatureDescription:
      "Découvrez les hébergements proposés et les informations utiles pour préparer votre visite.",
    restaurantTitle: "Restaurant & bar",
    restaurantDescription:
      "Découvrez le restaurant et consultez les plats actuellement proposés dans la carte en ligne.",
    eventsTitle: "Les événements de Keur Ana-Fi",
    eventsDescription:
      "Consultez les rendez-vous et temps forts annoncés par Keur Ana-Fi.",
    galleryTitle: "Un aperçu du Sine-Saloum",
    galleryDescription:
      "Découvrez les photos et les moments partagés autour de Keur Ana-Fi.",
  },
};

function isPaymentAccount(value: unknown): value is PaymentAccount {
  if (typeof value !== "object" || value === null) return false;
  const account = value as Record<string, unknown>;
  return (
    typeof account.id === "string" &&
    typeof account.number === "string" &&
    (account.operator === "wave" ||
      account.operator === "orange_money" ||
      account.operator === "free_money")
  );
}

type SiteContentContextValue = {
  content: SiteContent;
  isLoading: boolean;
  isInitialLoadComplete: boolean;
  error: string;
  isConnected: boolean;
  refresh: () => Promise<void>;
  updateAccommodations: (rooms: Accommodation[]) => void;
  saveSection: <K extends keyof SiteContent>(
    section: K,
    value: SiteContent[K],
  ) => Promise<void>;
  saveSections: (values: Partial<SiteContent>) => Promise<void>;
};

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState(defaultContent);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(!supabase);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("website_content")
        .select("content")
        .eq("id", 1)
        .maybeSingle();

      if (queryError) {
        setError(`Impossible de charger le contenu du site : ${queryError.message}`);
      } else if (data?.content && typeof data.content === "object") {
        const savedContent = data.content as Partial<SiteContent>;
        const hasSavedGallerySelection =
          typeof savedContent.clientGalleryPhotoIds === "object" &&
          savedContent.clientGalleryPhotoIds !== null &&
          !Array.isArray(savedContent.clientGalleryPhotoIds);
        const clientGalleryPhotoIds = hasSavedGallerySelection
          ? clientGallerySlots.reduce<ClientGallerySelection>(
              (selection, slot) => {
                const photoId = savedContent.clientGalleryPhotoIds?.[slot];
                if (typeof photoId === "string") selection[slot] = photoId;
                return selection;
              },
              {},
            )
          : null;
        const paymentAccounts = Array.isArray(savedContent.site?.paymentAccounts)
          ? savedContent.site.paymentAccounts.filter(isPaymentAccount)
          : [];
        setContent({
          ...defaultContent,
          ...savedContent,
          homeGalleryPhotoIds: Array.isArray(savedContent.homeGalleryPhotoIds)
            ? savedContent.homeGalleryPhotoIds.filter(
                (id): id is string => typeof id === "string",
              )
            : null,
          clientGalleryPhotoIds,
          site: {
            ...defaultContent.site,
            ...savedContent.site,
            paymentAccounts,
          },
        });
      }

      const { data: roomRows, error: roomError } = await supabase
        .from("accommodations")
        .select("*")
        .order("created_at", { ascending: true });
      if (roomError) {
        setError(`Impossible de charger les chambres : ${roomError.message}`);
      } else {
        const rooms: Accommodation[] = (roomRows ?? []).map((row) => {
          const images = Array.isArray(row.images)
            ? row.images.filter((image: unknown): image is string => typeof image === "string")
            : [];
          const amenities = Array.isArray(row.amenities)
            ? row.amenities.filter((amenity: unknown): amenity is string => typeof amenity === "string")
            : [];
          const beds = Array.isArray(row.beds)
            ? row.beds.filter(
                (bed: unknown): bed is { quantity: number; type: string } =>
                  typeof bed === "object" &&
                  bed !== null &&
                  "quantity" in bed &&
                  "type" in bed &&
                  typeof bed.quantity === "number" &&
                  typeof bed.type === "string",
              )
            : [];
          return {
            id: row.id,
            name: row.name,
            description: row.description,
            image: images[0] ?? "",
            images,
            imageAlt: row.image_alt,
            capacity: row.capacity ?? undefined,
            maxChildren: row.max_children ?? 0,
            amenities,
            price: row.price === null ? undefined : Number(row.price),
            beds,
            published: row.is_published,
            provisional: row.provisional,
          };
        });
        setContent((current) => ({ ...current, accommodations: rooms }));
      }
    } catch (loadError) {
      setError(
        `Impossible de charger le contenu du site : ${getErrorMessage(loadError)}`,
      );
    } finally {
      setIsLoading(false);
      setIsInitialLoadComplete(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel("website-content-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "website_content",
          filter: "id=eq.1",
        },
        () => {
          void refresh();
        },
      )
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "Les mises à jour en direct du contenu du site sont indisponibles.",
            subscriptionError,
          );
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh]);

  const saveSections = useCallback(
    async (
      values: Partial<SiteContent>,
    ) => {
      if (!supabase) throw new Error("Supabase n’est pas configuré.");
      const nextContent = { ...content, ...values };
      const { error: saveError } = await supabase.from("website_content").upsert({
        id: 1,
        content: nextContent,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      setContent(nextContent);
    },
    [content],
  );

  const saveSection = useCallback(
    async <K extends keyof SiteContent>(section: K, value: SiteContent[K]) => {
      await saveSections({ [section]: value });
    },
    [saveSections],
  );

  const updateAccommodations = useCallback((rooms: Accommodation[]) => {
    setContent((current) => ({ ...current, accommodations: rooms }));
  }, []);

  const value = useMemo(
    () => ({
      content,
      isLoading,
      isInitialLoadComplete,
      error,
      isConnected: Boolean(supabase),
      refresh,
      updateAccommodations,
      saveSection,
      saveSections,
    }),
    [
      content,
      error,
      isInitialLoadComplete,
      isLoading,
      refresh,
      saveSection,
      saveSections,
      updateAccommodations,
    ],
  );

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error("useSiteContent doit être utilisé dans SiteContentProvider.");
  }
  return context;
}

export const defaultSiteContent = defaultContent;
export { menuCategories };
