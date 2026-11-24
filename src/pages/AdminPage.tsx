import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BedDouble,
  Banknote,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  Phone,
  ShieldCheck,
  TrendingUp,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import AdminAccommodationCalendar from "../components/AdminAccommodationCalendar";
import {
  compareGalleryPhotosNewestFirst,
  getClientGalleryPhotoUsage,
  getClientGallerySelection,
  getHomeGalleryPhotos,
  getPublishedGalleryPhotos,
  type ClientGallerySlot,
  type GalleryPhoto,
} from "../data/gallery";
import type { EventItem } from "../data/events";
import type { MenuCategory, MenuItem } from "../data/restaurant";
import { useSiteContent } from "../data/SiteContentContext";
import { getErrorMessage } from "../lib/errorMessage";
import type { PaymentAccount, PaymentOperator } from "../data/site";
import { hasActiveReservationOverlap } from "../lib/reservationOverlap";
import { getReservationReference } from "../lib/reservationReference";
import { supabase } from "../lib/supabase";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "rejected"
  | "cancelled";

function AdminRoomPhotoCarousel({
  roomName,
  photos,
}: {
  roomName: string;
  photos: string[];
}) {
  const [activePhoto, setActivePhoto] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="admin-room-card-photos">
        <div className="admin-room-no-photos">
          <Camera size={28} aria-hidden="true" />
          <small>Aucune photo</small>
        </div>
      </div>
    );
  }

  const photoIndex = activePhoto % photos.length;

  return (
    <div className="admin-room-card-photos">
      <img
        src={photos[photoIndex]}
        alt={`${roomName} — photo ${photoIndex + 1}`}
        loading="lazy"
      />
      {photos.length > 1 && (
        <div
          className="room-photo-controls admin-room-photo-controls"
          aria-label={`Photos de ${roomName}`}
        >
          <button
            type="button"
            className="room-photo-arrow admin-room-photo-arrow"
            onClick={() =>
              setActivePhoto((current) => (current - 1 + photos.length) % photos.length)
            }
            aria-label="Afficher la photo précédente"
          >
            <ChevronLeft size={20} />
          </button>
          <span
            className="room-photo-counter admin-room-photo-counter"
            aria-live="polite"
          >
            {photoIndex + 1} / {photos.length}
          </span>
          <button
            type="button"
            className="room-photo-arrow admin-room-photo-arrow"
            onClick={() => setActivePhoto((current) => (current + 1) % photos.length)}
            aria-label="Afficher la photo suivante"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

type ContactStatus = "new" | "in_progress" | "handled";
type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
type Reservation = {
  id: string;
  name: string;
  phone: string;
  arrival: string;
  departure: string;
  room_id?: string | null;
  guests: number;
  adults?: number | null;
  children?: number | null;
  estimated_arrival_time?: string | null;
  approved_checkin_time?: string | null;
  approved_checkout_time?: string | null;
  price_per_night_snapshot?: number | null;
  total_amount_snapshot?: number | null;
  receipt_path?: string | null;
  room: string;
  message: string;
  status: ReservationStatus;
  created_at: string;
};
type AccommodationStatsReservation = Pick<
  Reservation,
  | "id"
  | "status"
  | "total_amount_snapshot"
  | "name"
  | "arrival"
  | "departure"
  | "room_id"
  | "room"
  | "created_at"
>;
type ContactMessage = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  subject: string;
  request_type: string;
  message: string;
  status: ContactStatus;
  created_at: string;
};
type DashboardContactActivity = Pick<
  ContactMessage,
  "id" | "full_name" | "created_at" | "status"
>;
type OrderLine = { id: string; name: string; quantity: number; price: number };
type RestaurantOrder = {
  id: string;
  name: string;
  phone: string;
  items: OrderLine[];
  total: number;
  note: string;
  receipt_path?: string | null;
  status: OrderStatus;
  created_at: string;
};
type RoomMaintenanceBlock = {
  id: string;
  room_id: string;
  starts_at: string;
  ends_at: string;
  reason: "maintenance" | "cleaning";
  notes: string;
  created_at: string;
};
type DebtDirection = "receivable" | "payable";
type DebtStatus = "unpaid" | "settled";
type DebtRecord = {
  id: string;
  direction: DebtDirection;
  person_name: string;
  amount: number;
  description: string;
  due_date: string | null;
  status: DebtStatus;
  settled_at: string | null;
  created_at: string;
};
type AdminUserRole = "super_admin" | "employee";
type AdminUser = {
  user_id: string;
  email: string | null;
  created_at: string;
  role: AdminUserRole;
  is_suspended: boolean;
};
type AdminUserFunctionRequest =
  | { action: "create"; email: string; password: string; role: AdminUserRole }
  | {
      action: "update";
      user_id: string;
      email: string;
      password?: string;
      role: AdminUserRole;
    }
  | { action: "suspend" | "reactivate"; user_id: string };
type AdminPageKey =
  | "dashboard"
  | "admins"
  | "accommodation"
  | "accommodation_rooms"
  | "accommodation_amenities"
  | "accommodation_reservations"
  | "accommodation_calendar"
  | "accommodation_payments"
  | "accommodation_checkin"
  | "accommodation_housekeeping"
  | "accommodation_statistics"
  | "restaurant"
  | "restaurant_entrees"
  | "restaurant_plats"
  | "restaurant_accompagnements"
  | "restaurant_desserts"
  | "restaurant_boissons"
  | "restaurant_statistics"
  | "debt_receivable"
  | "debt_payable"
  | "gallery"
  | "events"
  | "contact";

const navigation: { key: AdminPageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { key: "admins", label: "Gestion des administrateurs", icon: ShieldCheck },
  { key: "accommodation", label: "Hébergement", icon: BedDouble },
  { key: "restaurant", label: "Restaurant", icon: UtensilsCrossed },
  { key: "debt_receivable", label: "Dettes", icon: Banknote },
  { key: "gallery", label: "Galerie", icon: Camera },
  { key: "events", label: "Événements", icon: CalendarDays },
  { key: "contact", label: "Contact", icon: Mail },
];

async function invokeAdminUserFunction(body: AdminUserFunctionRequest) {
  if (!supabase) throw new Error("La connexion à Supabase est indisponible.");
  const { error } = await supabase.functions.invoke("manage-admin-user", { body });
  if (!error) return;

  let message = error.message;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const responseText = await error.context.text();
    let responseBody: unknown = null;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = null;
    }
    if (
      typeof responseBody === "object" &&
      responseBody !== null &&
      "error" in responseBody &&
      typeof responseBody.error === "string"
    ) {
      message = responseBody.error;
    }
  }
  throw new Error(message);
}

const debtPages: { key: AdminPageKey; label: string; direction: DebtDirection }[] = [
  { key: "debt_receivable", label: "On me doit", direction: "receivable" },
  { key: "debt_payable", label: "Je dois", direction: "payable" },
];

const accommodationPages: { key: AdminPageKey; label: string }[] = [
  { key: "accommodation_rooms", label: "Gestion des chambres" },
  { key: "accommodation_amenities", label: "Équipements" },
  { key: "accommodation_reservations", label: "Gestion des réservations" },
  { key: "accommodation_calendar", label: "Calendrier des disponibilités" },
  { key: "accommodation_payments", label: "Gestion des paiements" },
  { key: "accommodation_checkin", label: "Arrivées et départs" },
  { key: "accommodation_housekeeping", label: "Nettoyage" },
  { key: "accommodation_statistics", label: "Statistiques" },
];

const restaurantCategoryPages: {
  key: AdminPageKey;
  label: string;
  category: MenuCategory;
}[] = [
  { key: "restaurant_entrees", label: "Entrées", category: "Entrées" },
  { key: "restaurant_plats", label: "Plats principaux", category: "Plats principaux" },
  {
    key: "restaurant_accompagnements",
    label: "Accompagnements",
    category: "Accompagnements",
  },
  { key: "restaurant_desserts", label: "Desserts", category: "Desserts" },
  { key: "restaurant_boissons", label: "Boissons", category: "Boissons" },
];
const orderStatuses: {
  status: OrderStatus;
  label: string;
  color: string;
}[] = [
  { status: "new", label: "Nouvelles", color: "#FFDD00" },
  { status: "preparing", label: "En préparation", color: "#FFDD00" },
  { status: "ready", label: "Prêtes", color: "#d0f600" },
  { status: "completed", label: "Terminées", color: "#FFDD00" },
  { status: "cancelled", label: "Annulées", color: "#ee0039" },
];
const restaurantSalesCategoryOrder = [
  "Entrées",
  "Plats principaux",
  "Accompagnements",
  "Desserts",
  "Boissons",
  "Cocktails",
  "Autres",
];
const restaurantSalesCategoryColors: Record<string, string> = {
  Entrées: "#a78bfa",
  "Plats principaux": "#fb923c",
  Accompagnements: "#2dd4bf",
  Desserts: "#f472b6",
  Boissons: "#60a5fa",
  Cocktails: "#facc15",
  Autres: "#94a3b8",
};
const orderStatusSequence: OrderStatus[] = [
  "new",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];
const orderStatusActions: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const orderStatusOrder: Partial<Record<OrderStatus, number>> = {
  new: 0,
  preparing: 1,
  ready: 2,
  completed: 3,
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  in_progress: "En cours",
  completed: "Terminée",
  rejected: "Refusée",
  cancelled: "Annulée",
};
const reservationStatusActions: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  rejected: ["cancelled"],
  cancelled: [],
};
const reservationStatusSequence: ReservationStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];
const reservationStatusOrder: Partial<Record<ReservationStatus, number>> = {
  pending: 0,
  confirmed: 1,
  in_progress: 2,
  completed: 3,
};
const paymentOperatorLabels: Record<PaymentOperator, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
};
const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "En préparation",
  ready: "Prête",
  completed: "Terminée",
  cancelled: "Annulée",
};
function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dakarDateKey(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + offset));
  return date.toISOString().slice(0, 10);
}

function getDashboardMotivation() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Dakar",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour >= 6 && hour <= 11) {
    return {
      greeting: "Bonjour !",
      message: "Chaque nouvelle journée est une occasion de faire grandir ton établissement. Avance avec détermination !",
    };
  }
  if (hour === 12) {
    return {
      greeting: "Bon après-midi !",
      message: "La matinée est derrière toi. Garde le rythme, chaque effort compte !",
    };
  }
  if (hour === 13) {
    return {
      greeting: "Belle journée !",
      message: "Continue sur ta lancée. La qualité de ton travail construit la réputation de ton établissement.",
    };
  }
  if (hour === 14) {
    return {
      greeting: "Bonjour et bon courage !",
      message: "Chaque détail compte. Donne le meilleur de toi-même et fais de cette journée une réussite.",
    };
  }
  if (hour === 15) {
    return {
      greeting: "Bonsoir !",
      message: "La journée avance, mais les belles réussites se construisent à chaque instant. Ne relâche pas tes efforts !",
    };
  }
  if (hour === 16) {
    return {
      greeting: "Bonne fin de journée !",
      message: "Reste concentré sur tes objectifs. Les résultats d'aujourd'hui préparent les réussites de demain.",
    };
  }
  if (hour === 17) {
    return {
      greeting: "Bonsoir !",
      message: "Chaque client satisfait est une victoire. Continue à offrir le meilleur de ton établissement !",
    };
  }
  if (hour === 18) {
    return {
      greeting: "Excellente soirée !",
      message: "Prends un instant pour apprécier le chemin parcouru. Chaque progrès mérite d'être reconnu.",
    };
  }
  if (hour >= 19) {
    return {
      greeting: "Bonne soirée !",
      message: "Une journée de travail bien menée est un pas de plus vers tes ambitions. Continue à bâtir ton succès !",
    };
  }
  return {
    greeting: "Toujours au travail ?",
    message: "Il se fait tard, mais chaque effort compte. Le succès récompense la persévérance. N'oublie pas aussi de prendre soin de toi.",
  };
}

function millisecondsUntilNextDakarHour() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dakar",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return (60 - value("minute")) * 60_000 -
    value("second") * 1_000 -
    now.getMilliseconds();
}

function dakarTimestampDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dakar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDakarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatDakarTimestampDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

function matchesReservationSearch(reservation: Reservation, query: string) {
  const search = query.trim().toLocaleLowerCase("fr");
  if (!search) return true;

  const searchable = [
    getReservationReference(reservation.id),
    reservation.id,
    reservation.name,
    reservation.phone,
    reservation.room,
    reservation.message,
    reservation.arrival,
    reservation.departure,
  ]
    .join(" ")
    .toLocaleLowerCase("fr");
  return searchable.includes(search);
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function AdminSection({
  title,
  description,
  action,
  hideHeading = false,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  hideHeading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel">
      {!hideHeading ? (
        <header className="admin-panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p className="admin-help">{description}</p>}
          </div>
          {action}
        </header>
      ) : action ? (
        <div className="admin-panel-actions-only">{action}</div>
      ) : null}
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

function formatCompactAmount(value: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)} FCFA`;
}

function smoothChartPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const beforePrevious = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const controlOneX = previous.x + (point.x - beforePrevious.x) / 6;
    const minY = Math.min(previous.y, point.y);
    const maxY = Math.max(previous.y, point.y);
    const controlOneY = Math.min(
      maxY,
      Math.max(minY, previous.y + (point.y - beforePrevious.y) / 6),
    );
    const controlTwoX = point.x - (next.x - previous.x) / 6;
    const controlTwoY = Math.min(
      maxY,
      Math.max(minY, point.y - (next.y - previous.y) / 6),
    );
    return `${path} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${point.x} ${point.y}`;
  }, "");
}

const adminGallerySlotLabels: Partial<Record<ClientGallerySlot, string>> = {
  "gallery-art-front": "Galerie — photo principale de la vignette",
  "gallery-art-back": "Galerie — seconde photo de la vignette",
};

function AdminGalleryPhotoCard({
  photo,
  slot,
  slotLabel,
  isUploadingReplacement,
  isSaving,
  onReplace,
  onTogglePublication,
  onDelete,
}: {
  photo: GalleryPhoto;
  slot: ClientGallerySlot | null;
  slotLabel?: string;
  isUploadingReplacement: boolean;
  isSaving: boolean;
  onReplace: (imageFile: File) => void;
  onTogglePublication: () => void;
  onDelete: () => void;
}) {
  const replacementInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <article className="admin-gallery-card">
      <img src={photo.url} alt={photo.alt} />
      {slotLabel && (
        <span className="admin-gallery-card-slot-label">{slotLabel}</span>
      )}
      {slot && (
        <div className="admin-gallery-replace-control">
          <input
            ref={replacementInputRef}
            className="admin-gallery-replace-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            aria-label={`Choisir une nouvelle image pour ${photo.caption || photo.category}`}
            onChange={(event) => {
              const imageFile = event.currentTarget.files?.[0];
              if (imageFile) onReplace(imageFile);
              event.currentTarget.value = "";
            }}
          />
          <button
            className="admin-gallery-replace-button"
            type="button"
            disabled={isSaving || isUploadingReplacement}
            title="Choisir une image sur votre appareil"
            onClick={() => replacementInputRef.current?.click()}
          >
            {isUploadingReplacement ? "Remplacement…" : "Remplacer"}
          </button>
        </div>
      )}
      <div className="admin-gallery-card-actions">
        <button
          type="button"
          aria-label={photo.status === "published" ? "Dépublier l’image" : "Publier l’image"}
          title={photo.status === "published" ? "Dépublier" : "Publier"}
          disabled={isSaving}
          onClick={onTogglePublication}
        >
          {photo.status === "published" ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Supprimer l’image"
          title="Supprimer"
          disabled={isSaving}
          onClick={onDelete}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export default function AdminPage() {
  const {
    content,
    isConnected,
    isLoading,
    saveSection,
    saveSections,
    updateAccommodations,
  } = useSiteContent();
  const publishedGalleryPhotos = getPublishedGalleryPhotos(content.galleryPhotos);
  const clientGalleryUsage = getClientGalleryPhotoUsage(
    content.galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  );
  const clientGalleryPhotoIds = getClientGallerySelection(
    content.galleryPhotos,
    content.clientGalleryPhotoIds,
    content.homeGalleryPhotoIds,
  );
  const clientGalleryUsedIds = new Set(
    clientGalleryUsage.map(({ photo }) => photo.id),
  );
  const clientHomeGalleryPhotos = getHomeGalleryPhotos(
    publishedGalleryPhotos,
    content.homeGalleryPhotoIds,
  );
  const otherGalleryPhotos = content.galleryPhotos
    .filter((photo) => !clientGalleryUsedIds.has(photo.id))
    .sort(compareGalleryPhotosNewestFirst);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentAdminUserId, setCurrentAdminUserId] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState<AdminPageKey>("dashboard");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminUserEmail, setAdminUserEmail] = useState("");
  const [adminUserPassword, setAdminUserPassword] = useState("");
  const [adminUserRole, setAdminUserRole] = useState<AdminUser["role"]>("employee");
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editingAdminEmail, setEditingAdminEmail] = useState("");
  const [editingAdminPassword, setEditingAdminPassword] = useState("");
  const [editingAdminRole, setEditingAdminRole] =
    useState<AdminUserRole>("employee");
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [isSavingAdminUsers, setIsSavingAdminUsers] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUsersMessage, setAdminUsersMessage] = useState("");
  const [showCheckinHistory, setShowCheckinHistory] = useState(false);
  const [historyType, setHistoryType] = useState<"arrival" | "departure">("arrival");
  const [historyStartDate, setHistoryStartDate] = useState(() => dakarDateKey(-30));
  const [historyEndDate, setHistoryEndDate] = useState(() => dakarDateKey());
  const [checkinSearch, setCheckinSearch] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const reservationsRef = useRef<Reservation[]>([]);
  const [showCompletedReservationHistory, setShowCompletedReservationHistory] =
    useState(false);
  const [completedReservationHistory, setCompletedReservationHistory] = useState<
    Reservation[]
  >([]);
  const [isLoadingCompletedReservationHistory, setIsLoadingCompletedReservationHistory] =
    useState(false);
  const [completedReservationHistoryError, setCompletedReservationHistoryError] =
    useState("");
  const [accommodationStatsReservations, setAccommodationStatsReservations] =
    useState<AccommodationStatsReservation[]>([]);
  const [dashboardContactActivity, setDashboardContactActivity] = useState<
    DashboardContactActivity[]
  >([]);
  const [dashboardStartDate, setDashboardStartDate] = useState(() => dakarDateKey());
  const [dashboardEndDate, setDashboardEndDate] = useState(() => dakarDateKey());
  const [hoveredDashboardPoint, setHoveredDashboardPoint] = useState<{
    chartKey: string;
    dayIndex: number;
  } | null>(null);
  const [isLoadingAccommodationStats, setIsLoadingAccommodationStats] = useState(false);
  const [accommodationStatsError, setAccommodationStatsError] = useState("");
  const [accommodationStatsStartDate, setAccommodationStatsStartDate] = useState(
    () => dakarDateKey(),
  );
  const [accommodationStatsEndDate, setAccommodationStatsEndDate] = useState(
    () => dakarDateKey(),
  );
  const [restaurantStatsStartDate, setRestaurantStatsStartDate] = useState(
    () => dakarDateKey(),
  );
  const [restaurantStatsEndDate, setRestaurantStatsEndDate] = useState(
    () => dakarDateKey(),
  );
  const [dashboardMotivation, setDashboardMotivation] =
    useState(getDashboardMotivation);
  const [statisticsToday, setStatisticsToday] = useState(dakarDateKey);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationHistorySearch, setReservationHistorySearch] = useState("");
  const [reservationStatusFilter, setReservationStatusFilter] = useState<
    "all" | ReservationStatus
  >("all");
  const [savingReservationStatuses, setSavingReservationStatuses] = useState<
    Set<string>
  >(() => new Set());
  const [orderReceiptUrls, setOrderReceiptUrls] = useState<Record<string, string>  >({});
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [isLoadingDebts, setIsLoadingDebts] = useState(false);
  const [debtError, setDebtError] = useState("");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [savingDebtIds, setSavingDebtIds] = useState<Set<string>>(() => new Set());
  const [showDebtHistory, setShowDebtHistory] = useState(false);
  const [contactSyncError, setContactSyncError] = useState("");
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [savingOrderStatuses, setSavingOrderStatuses] = useState<Set<string>>(
    () => new Set(),
  );
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | OrderStatus>("all");
  const [orderHistorySearch, setOrderHistorySearch] = useState("");
  const [maintenanceBlocks, setMaintenanceBlocks] = useState<RoomMaintenanceBlock[]>([]);
  const [accommodationStatsCleaningBlocks, setAccommodationStatsCleaningBlocks] =
    useState<RoomMaintenanceBlock[]>([]);
  const [calendarSyncError, setCalendarSyncError] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [savingMaintenanceBlockIds, setSavingMaintenanceBlockIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showMaintenanceHistory, setShowMaintenanceHistory] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [orderReceiptPreview, setOrderReceiptPreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [showContactHistory, setShowContactHistory] = useState(false);
  const [editingMaintenance, setEditingMaintenance] =
    useState<RoomMaintenanceBlock | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const inboxInitialLoadAttemptedRef = useRef(false);
  const realtimeRefreshTimeoutRef = useRef<number | null>(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [contentError, setContentError] = useState("");
  const [contentMessage, setContentMessage] = useState("");
  const [showDishForm, setShowDishForm] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [isSavingDish, setIsSavingDish] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [replacingGalleryPhotoId, setReplacingGalleryPhotoId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem & { id?: string } | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const roomFormPanelRef = useRef<HTMLElement | null>(null);
  const [editingRoom, setEditingRoom] = useState<(typeof content.accommodations)[number] | null>(null);
  const [roomImages, setRoomImages] = useState<string[]>([]);
  const [selectedRoomPhotos, setSelectedRoomPhotos] = useState<File[]>([]);
  const [selectedRoomAmenities, setSelectedRoomAmenities] = useState<string[]>([]);
  const [roomAmenitySearch, setRoomAmenitySearch] = useState("");
  const [roomError, setRoomError] = useState("");
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [updatingRoomPublicationIds, setUpdatingRoomPublicationIds] = useState<
    Set<string>
  >(() => new Set());
  const [newAmenity, setNewAmenity] = useState("");
  const [amenityError, setAmenityError] = useState("");
  const [isSavingAmenity, setIsSavingAmenity] = useState(false);
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentOperator, setPaymentOperator] =
    useState<PaymentOperator>("wave");
  const [editingPaymentAccount, setEditingPaymentAccount] =
    useState<PaymentAccount | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [isSavingPaymentAccounts, setIsSavingPaymentAccounts] = useState(false);

  useEffect(() => {
    let timeout: number;
    const updateAtNextHour = () => {
      timeout = window.setTimeout(() => {
        setDashboardMotivation(getDashboardMotivation());
        updateAtNextHour();
      }, millisecondsUntilNextDakarHour());
    };
    updateAtNextHour();
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!showRoomForm || activePage !== "accommodation_rooms") return;
    const frame = window.requestAnimationFrame(() => {
      roomFormPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      roomFormPanelRef.current
        ?.querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePage, showRoomForm]);

  useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);

  function closeRoomForm() {
    if (isSavingRoom) return;
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomImages([]);
    setSelectedRoomPhotos([]);
    setSelectedRoomAmenities([]);
    setRoomAmenitySearch("");
    setRoomError("");
  }

  useEffect(() => {
    if (!showCheckinHistory) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowCheckinHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCheckinHistory]);

  useEffect(() => {
    if (
      !showCompletedReservationHistory ||
      activePage !== "accommodation_reservations"
    ) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowCompletedReservationHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, showCompletedReservationHistory]);

  useEffect(() => {
    if (!showMaintenanceHistory || activePage !== "accommodation_housekeeping") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMaintenanceHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, showMaintenanceHistory]);

  useEffect(() => {
    if (!showOrderHistory || activePage !== "restaurant") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowOrderHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, showOrderHistory]);

  useEffect(() => {
    if (!orderReceiptPreview || activePage !== "restaurant") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOrderReceiptPreview(null);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, orderReceiptPreview]);

  useEffect(() => {
    if (activePage !== "restaurant") {
      setOrderReceiptPreview(null);
    }
  }, [activePage]);

  useEffect(() => {
    if (!showContactHistory || activePage !== "contact") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowContactHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, showContactHistory]);

  useEffect(() => {
    if (!showDebtHistory || !activePage.startsWith("debt_")) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDebtHistory(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePage, showDebtHistory]);

  useEffect(() => {
    if (
      !isAdmin ||
      (activePage !== "accommodation_statistics" && activePage !== "dashboard") ||
      !supabase
    ) return;

    let active = true;
    const client = supabase;
    const pageSize = 1000;
    setIsLoadingAccommodationStats(true);
    setAccommodationStatsError("");

    async function fetchAccommodationStatsReservations() {
      const allReservations: AccommodationStatsReservation[] = [];
      let page = 0;
      while (active) {
        const { data, error } = await client
          .from("reservation_requests")
          .select("id,status,total_amount_snapshot,name,arrival,departure,room_id,room,created_at")
          .order("created_at", { ascending: false })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;

        const rows = (data ?? []) as AccommodationStatsReservation[];
        allReservations.push(...rows);
        if (rows.length < pageSize) break;
        page += 1;
      }
      return allReservations;
    }

    async function loadAccommodationStats() {
      try {
        const allReservations = await fetchAccommodationStatsReservations();

        const allCleaningBlocks: RoomMaintenanceBlock[] = [];
        if (activePage === "accommodation_statistics") {
          let cleaningPage = 0;
          while (active) {
            const { data, error } = await client
              .from("room_maintenance_blocks")
              .select("*")
              .eq("reason", "cleaning")
              .order("starts_at", { ascending: false })
              .range(cleaningPage * pageSize, (cleaningPage + 1) * pageSize - 1);
            if (error) throw error;

            const rows = (data ?? []) as RoomMaintenanceBlock[];
            allCleaningBlocks.push(...rows);
            if (rows.length < pageSize) break;
            cleaningPage += 1;
          }
        }

        if (active && activePage === "dashboard") {
          const contactRows: DashboardContactActivity[] = [];
          let contactPage = 0;
          while (active) {
            const { data, error } = await client
              .from("contact_messages")
              .select("id,full_name,created_at,status")
              .order("created_at", { ascending: true })
              .range(contactPage * pageSize, (contactPage + 1) * pageSize - 1);
            if (error) throw error;
            const rows = (data ?? []) as DashboardContactActivity[];
            contactRows.push(...rows);
            if (rows.length < pageSize) break;
            contactPage += 1;
          }

          if (active) setDashboardContactActivity(contactRows);
        }

        if (active) {
          setAccommodationStatsReservations(allReservations);
        }
        if (active && activePage === "accommodation_statistics") {
          setAccommodationStatsCleaningBlocks(allCleaningBlocks);
        }
      } catch (error) {
        if (active) {
          setAccommodationStatsError(
            `Impossible de charger les statistiques : ${getErrorMessage(error)}`,
          );
        }
      } finally {
        if (active) setIsLoadingAccommodationStats(false);
      }
    }

    void loadAccommodationStats();
    let refreshTimeout: number | undefined;
    const channel = client
      .channel("admin-accommodation-statistics-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservation_requests" },
        () => {
          window.clearTimeout(refreshTimeout);
          refreshTimeout = window.setTimeout(() => {
            void fetchAccommodationStatsReservations()
              .then((reservations) => {
                if (active) {
                  setAccommodationStatsReservations(reservations);
                  setAccommodationStatsError("");
                }
              })
              .catch((error: unknown) => {
                if (active) {
                  setAccommodationStatsError(
                    `Impossible d’actualiser les statistiques : ${getErrorMessage(error)}`,
                  );
                }
              });
          }, 250);
        },
      )
      .subscribe((status) => {
        if (
          active &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        ) {
          setAccommodationStatsError(
            "La mise à jour en direct des statistiques est indisponible.",
          );
        }
      });

    return () => {
      active = false;
      window.clearTimeout(refreshTimeout);
      void client.removeChannel(channel);
    };
  }, [activePage, isAdmin]);

  useEffect(() => {
    if (!isAdmin || activePage !== "accommodation_statistics") return;
    const clockInterval = window.setInterval(
      () => setStatisticsToday(dakarDateKey()),
      60_000,
    );
    return () => window.clearInterval(clockInterval);
  }, [activePage, isAdmin]);

  useEffect(() => {
    if (!supabase) {
      setIsCheckingAuth(false);
      return;
    }
    let active = true;

    async function checkAdmin(userId: string | undefined) {
      if (!userId || !supabase) {
        if (active) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setCurrentAdminUserId(null);
          setIsCheckingAuth(false);
        }
        return;
      }

      setIsCheckingAuth(true);
      const { data, error } = await supabase
        .from("admin_users")
        .select("user_id, role, is_suspended")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setAuthError(`Vérification des droits impossible : ${error.message}`);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setCurrentAdminUserId(null);
      } else if (!data) {
        setAuthError("Ce compte n’a pas accès à l’administration.");
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setCurrentAdminUserId(null);
        await supabase.auth.signOut();
      } else if (data.is_suspended) {
        setAuthError("Ce compte est suspendu. Contactez un administrateur suprême.");
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setCurrentAdminUserId(null);
        await supabase.auth.signOut();
      } else {
        setAuthError("");
        setIsAdmin(true);
        setIsSuperAdmin(data.role === "super_admin");
        setCurrentAdminUserId(userId);
      }
      setIsCheckingAuth(false);
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(`Lecture de la session impossible : ${error.message}`);
        setIsCheckingAuth(false);
      } else {
        void checkAdmin(data.session?.user.id);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkAdmin(session?.user.id);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    const client = supabase;
    const showInitialLoading = !inboxInitialLoadAttemptedRef.current;
    if (showInitialLoading) {
      inboxInitialLoadAttemptedRef.current = true;
      setIsLoadingInbox(true);
    }
    setInboxError("");
    setOrdersError("");
    setMaintenanceError("");
    try {
      const [
        reservationResult,
        contactResult,
        maintenanceResult,
      ] = await Promise.all([
        client
          .from("reservation_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        client
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        client
          .from("room_maintenance_blocks")
          .select("*")
          .order("starts_at", { ascending: false })
          .limit(200),
      ]);
      if (maintenanceResult.error) {
        setMaintenanceBlocks([]);
        setMaintenanceError(
          maintenanceResult.error.code === "PGRST205"
            ? "La table room_maintenance_blocks n’existe pas encore. Exécutez le SQL de mise à jour fourni."
            : `Impossible de charger les périodes bloquées : ${getErrorMessage(maintenanceResult.error)}`,
        );
      } else {
        setMaintenanceBlocks(
          (maintenanceResult.data ?? []) as RoomMaintenanceBlock[],
        );
      }
      const queryError = reservationResult.error ?? contactResult.error;
      if (queryError) throw queryError;
      const reservationRows = (reservationResult.data ?? []) as Reservation[];
      setReservations(reservationRows);
      setContacts((contactResult.data ?? []) as ContactMessage[]);
      const orderRows: RestaurantOrder[] = [];
      const orderPageSize = 1000;
      let orderPage = 0;
      let orderQueryError: { code: string; message: string } | null = null;
      while (true) {
        const { data, error } = await client
          .from("restaurant_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(orderPage * orderPageSize, (orderPage + 1) * orderPageSize - 1);
        if (error) {
          orderQueryError = error;
          break;
        }
        const pageRows = (data ?? []) as RestaurantOrder[];
        orderRows.push(...pageRows);
        if (pageRows.length < orderPageSize) break;
        orderPage += 1;
      }
      if (orderQueryError) {
        setOrders([]);
        setOrderReceiptUrls({});
        setOrdersError(
          orderQueryError.code === "PGRST205"
            ? "La table restaurant_orders n’existe pas encore dans Supabase. Exécutez le script SQL de configuration mis à jour."
            : `Impossible de charger les commandes : ${getErrorMessage(orderQueryError)}`,
        );
      } else {
        setOrders(orderRows);
        const orderReceiptUrlEntries = await Promise.all(
          orderRows
            .filter(
              (order) =>
                order.receipt_path &&
                order.status !== "completed" &&
                order.status !== "cancelled",
            )
            .map(async (order) => {
              const { data, error } = await client.storage
                .from("restaurant-order-receipts")
                .createSignedUrl(order.receipt_path!, 3600);
              if (error) {
                console.error(
                  `Impossible de créer un lien sécurisé pour le reçu de la commande de ${order.name}.`,
                  error,
                );
                return null;
              }
              return [order.id, data.signedUrl] as const;
            }),
        );
        if (orderReceiptUrlEntries.some((entry) => entry === null)) {
          setOrdersError(
            "Certains reçus de commande ne peuvent pas être ouverts. Vérifiez le bucket privé restaurant-order-receipts et ses règles d’accès.",
          );
        }
        setOrderReceiptUrls(
          Object.fromEntries(
            orderReceiptUrlEntries.filter(
              (entry): entry is readonly [string, string] => entry !== null,
            ),
          ),
        );
      }
    } catch (error) {
      setInboxError(
        `Impossible de charger les demandes : ${getErrorMessage(error)}`,
      );
    } finally {
      if (showInitialLoading) setIsLoadingInbox(false);
    }
  }, [isAdmin]);

  const scheduleRealtimeDataRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current !== null) return;
    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null;
      void loadData();
    }, 250);
  }, [loadData]);

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  const loadDebtRecords = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setIsLoadingDebts(true);
    setDebtError("");
    try {
      const { data, error } = await supabase
        .from("debt_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(
          error.code === "PGRST205"
            ? "La table des dettes n’existe pas encore. Exécutez le script SQL de configuration mis à jour."
            : `Impossible de charger les dettes : ${getErrorMessage(error)}`,
        );
      }
      setDebtRecords((data ?? []) as DebtRecord[]);
    } catch (error) {
      setDebtError(getErrorMessage(error));
    } finally {
      setIsLoadingDebts(false);
    }
  }, [isAdmin]);

  const loadAdminUsers = useCallback(async () => {
    if (!supabase || !isSuperAdmin) return;
    setIsLoadingAdminUsers(true);
    setAdminUsersError("");
    try {
      const { data, error } = await supabase.rpc("manage_admin_users", {
        p_action: "list",
        p_user_id: null,
        p_role: null,
      });
      if (error) {
        setAdminUsersError(
          error.code === "PGRST202"
            ? "La gestion des comptes n’est pas encore configurée. Exécutez le fichier supabase/setup.sql dans Supabase."
            : `Impossible de charger les comptes : ${getErrorMessage(error)}`,
        );
        return;
      }
      setAdminUsers((data ?? []) as AdminUser[]);
    } catch (error) {
      setAdminUsersError(`Impossible de charger les comptes : ${getErrorMessage(error)}`);
    } finally {
      setIsLoadingAdminUsers(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin, loadData]);

  useEffect(() => {
    if (isSuperAdmin && activePage === "admins") void loadAdminUsers();
  }, [activePage, isSuperAdmin, loadAdminUsers]);

  useEffect(() => {
    if (activePage.startsWith("debt_") || activePage === "dashboard") {
      void loadDebtRecords();
    }
  }, [activePage, loadDebtRecords]);

  useEffect(() => {
    if (!supabase || !isAdmin) return;
    const client = supabase;
    const channel = client
      .channel("admin-accommodation-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservation_requests" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const changedReservation = payload.new as Partial<Reservation>;
            if (typeof changedReservation.id !== "string") {
              scheduleRealtimeDataRefresh();
              return;
            }

            setReservations((current) =>
              current.map((reservation) =>
                reservation.id === changedReservation.id
                  ? { ...reservation, ...changedReservation }
                  : reservation,
              ),
            );
            if (
              changedReservation.status === "completed" ||
              changedReservation.status === "cancelled"
            ) {
              const existingReservation = reservationsRef.current.find(
                (reservation) => reservation.id === changedReservation.id,
              );
              if (existingReservation) {
                syncCompletedReservationHistory({
                  ...existingReservation,
                  ...changedReservation,
                });
              }
            }
            return;
          }

          scheduleRealtimeDataRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_maintenance_blocks" },
        scheduleRealtimeDataRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setCalendarSyncError("");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setCalendarSyncError(
            "La mise à jour instantanée du calendrier est indisponible. Utilisez « Actualiser » pour recharger les données.",
          );
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [isAdmin, scheduleRealtimeDataRefresh]);

  useEffect(() => {
    if (!supabase || !isAdmin) return;
    const client = supabase;
    const channel = client
      .channel("admin-contact-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_messages" },
        scheduleRealtimeDataRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setContactSyncError("");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setContactSyncError(
            "La réception instantanée des messages est indisponible. Actualisez la page pour voir les nouveaux messages.",
          );
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [isAdmin, scheduleRealtimeDataRefresh]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    setIsCheckingAuth(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setAuthError(
        `Connexion impossible : ${getErrorMessage(error)}`,
      );
      setIsCheckingAuth(false);
    }
  }

  async function signOutAdmin() {
    if (!supabase) return;
    setIsSigningOut(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthError(`Déconnexion impossible : ${getErrorMessage(error)}`);
    } finally {
      setIsSigningOut(false);
    }
  }

  async function addAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetEmail = adminUserEmail.trim();
    if (!supabase || !isSuperAdmin || !targetEmail) return;
    setIsSavingAdminUsers(true);
    setAdminUsersError("");
    setAdminUsersMessage("");
    try {
      await invokeAdminUserFunction({
        action: "create",
        email: targetEmail,
        password: adminUserPassword,
        role: adminUserRole,
      });
      setAdminUserEmail("");
      setAdminUserPassword("");
      setAdminUserRole("employee");
      setAdminUsersMessage(
        adminUserRole === "super_admin"
          ? "Le compte administrateur suprême a été créé."
          : "Le compte employé a été créé.",
      );
      await loadAdminUsers();
    } catch (error) {
      setAdminUsersError(`Impossible de créer le compte : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingAdminUsers(false);
    }
  }

  function openAdminEditor(admin: AdminUser) {
    setEditingAdmin(admin);
    setEditingAdminEmail(admin.email ?? "");
    setEditingAdminPassword("");
    setEditingAdminRole(admin.role);
    setAdminUsersError("");
    setAdminUsersMessage("");
  }

  function closeAdminEditor() {
    if (isSavingAdminUsers) return;
    setEditingAdmin(null);
    setEditingAdminEmail("");
    setEditingAdminPassword("");
  }

  async function updateAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAdmin || !isSuperAdmin) return;
    setIsSavingAdminUsers(true);
    setAdminUsersError("");
    setAdminUsersMessage("");
    try {
      await invokeAdminUserFunction({
        action: "update",
        user_id: editingAdmin.user_id,
        email: editingAdminEmail.trim(),
        ...(editingAdminPassword ? { password: editingAdminPassword } : {}),
        role: editingAdminRole,
      });
      setAdminUsersMessage("Les informations du compte ont été modifiées.");
      setEditingAdmin(null);
      setEditingAdminPassword("");
      await loadAdminUsers();
    } catch (error) {
      setAdminUsersError(`Impossible de modifier le compte : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingAdminUsers(false);
    }
  }

  async function toggleAdminSuspension(admin: AdminUser) {
    if (admin.user_id === currentAdminUserId) return;
    const activeSuperAdminCount = adminUsers.filter(
      (user) => user.role === "super_admin" && !user.is_suspended,
    ).length;
    if (
      !admin.is_suspended &&
      admin.role === "super_admin" &&
      activeSuperAdminCount <= 1
    ) {
      setAdminUsersError("Le dernier administrateur suprême actif ne peut pas être suspendu.");
      return;
    }

    const action = admin.is_suspended ? "reactivate" : "suspend";
    const label = admin.role === "super_admin"
      ? "l’administrateur suprême"
      : "l’employé";
    if (!window.confirm(
      admin.is_suspended
        ? `Réactiver le compte de ${admin.email ?? label} ?`
        : `Suspendre le compte de ${admin.email ?? label} ? Cette personne ne pourra plus se connecter.`,
    )) {
      return;
    }

    setIsSavingAdminUsers(true);
    setAdminUsersError("");
    setAdminUsersMessage("");
    try {
      await invokeAdminUserFunction({ action, user_id: admin.user_id });
      await loadAdminUsers();
    } catch (error) {
      setAdminUsersError(`Impossible de modifier le statut du compte : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingAdminUsers(false);
    }
  }

  async function updateStatus(
    table: "reservation_requests",
    id: string,
    status: ReservationStatus,
  ): Promise<boolean> {
    if (!supabase) return false;
    const reservation = reservations.find((item) => item.id === id);
    if (!reservation) {
      setInboxError("Cette réservation n’a pas été trouvée. Actualisez la page et réessayez.");
      return false;
    }
    if (reservation.status === status) return true;

    const currentOrder = reservationStatusOrder[reservation.status];
    const nextOrder = reservationStatusOrder[status];
    const isForwardProgress =
      currentOrder !== undefined &&
      nextOrder !== undefined &&
      nextOrder > currentOrder;
    const isAllowedTerminalStatus =
      status === "cancelled" &&
      reservation.status !== "completed" &&
      reservation.status !== "cancelled";
    if (!isForwardProgress && !isAllowedTerminalStatus) {
      setInboxError("Le statut d’une réservation ne peut pas revenir à une étape précédente.");
      return false;
    }

    setSavingReservationStatuses((current) => new Set(current).add(id));
    setInboxError("");
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ status })
        .eq("id", id)
        .eq("status", reservation.status)
        .select("id")
        .maybeSingle();
      if (error) {
        setInboxError(
          error.code === "23P01"
            ? "Ce changement créerait un chevauchement avec une autre réservation ou une période bloquée."
            : `Impossible de modifier le statut : ${error.message}`,
        );
        return false;
      }
      if (!data) {
        setInboxError(
          "Le statut a changé ailleurs. Les réservations sont en cours d’actualisation.",
        );
        void loadData();
        return false;
      }
      const updatedReservation = { ...reservation, status };
      setReservations((current) =>
        current.map((item) => (item.id === id ? updatedReservation : item)),
      );
      setAccommodationStatsReservations((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      syncCompletedReservationHistory(updatedReservation);
      return true;
    } catch (error) {
      setInboxError(`Impossible de modifier le statut : ${getErrorMessage(error)}`);
      return false;
    } finally {
      setSavingReservationStatuses((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  function syncCompletedReservationHistory(reservation: Reservation) {
    setCompletedReservationHistory((current) => {
      const historyStatuses: ReservationStatus[] = ["completed", "cancelled"];
      const existing = current.filter((item) => item.id !== reservation.id);
      if (!historyStatuses.includes(reservation.status)) return existing;

      return [...existing, reservation].sort((left, right) =>
        right.departure.localeCompare(left.departure),
      );
    });
  }

  async function saveMaintenanceBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("starts_at") ?? "");
    const endsAt = String(formData.get("ends_at") ?? "");
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setMaintenanceError("La fin doit être postérieure au début de la période.");
      return;
    }

    const block = {
      room_id: String(formData.get("room_id") ?? ""),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      reason: String(formData.get("reason") ?? "maintenance"),
      notes: String(formData.get("notes") ?? "").trim(),
    };
    const roomName = content.accommodations.find(
      (room) => room.id === block.room_id,
    )?.name;
    if (
      block.reason === "cleaning" &&
      hasActiveReservationOverlap(
        reservations,
        block.room_id,
        block.starts_at,
        block.ends_at,
        roomName,
      )
    ) {
      setMaintenanceError(
        "Impossible de planifier un nettoyage pendant une réservation confirmée, en cours ou encore en attente.",
      );
      return;
    }
    setIsSavingMaintenance(true);
    setMaintenanceError("");
    try {
      const query = editingMaintenance
        ? supabase
            .from("room_maintenance_blocks")
            .update(block)
            .eq("id", editingMaintenance.id)
        : supabase.from("room_maintenance_blocks").insert(block);
      const { error } = await query;
      if (error) {
        setMaintenanceError(
          error.code === "23P01"
            ? error.message
            : `Impossible d’enregistrer la période : ${error.message}`,
        );
        return;
      }
      setShowMaintenanceForm(false);
      setEditingMaintenance(null);
      await loadData();
    } catch (error) {
      setMaintenanceError(
        `Impossible d’enregistrer la période : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSavingMaintenance(false);
    }
  }

  async function deleteMaintenanceBlock(
    block: Pick<RoomMaintenanceBlock, "id">,
    confirmationMessage = "Supprimer cette période de maintenance/nettoyage ?",
  ) {
    if (
      !supabase ||
      !window.confirm(confirmationMessage)
    ) {
      return;
    }
    const { error } = await supabase
      .from("room_maintenance_blocks")
      .delete()
      .eq("id", block.id);
    if (error) {
      setMaintenanceError(`Impossible de supprimer la période : ${error.message}`);
      return;
    }
    await loadData();
  }

  async function finishMaintenanceBlock(block: RoomMaintenanceBlock) {
    if (!supabase) {
      setMaintenanceError("Supabase n’est pas configuré.");
      return;
    }

    const now = new Date();
    const startsAt = new Date(block.starts_at);
    if (startsAt > now) {
      setMaintenanceError(
        "Ce blocage ne peut être terminé qu’après le début de la période prévue.",
      );
      return;
    }

    setMaintenanceError("");
    setSavingMaintenanceBlockIds((current) => new Set(current).add(block.id));
    try {
      const { error } = await supabase
        .from("room_maintenance_blocks")
        .update({ ends_at: now.toISOString() })
        .eq("id", block.id);
      if (error) {
        setMaintenanceError(
          `Impossible de terminer le blocage : ${getErrorMessage(error)}`,
        );
        return;
      }
      await loadData();
    } catch (error) {
      setMaintenanceError(
        `Impossible de terminer le blocage : ${getErrorMessage(error)}`,
      );
    } finally {
      setSavingMaintenanceBlockIds((current) => {
        const next = new Set(current);
        next.delete(block.id);
        return next;
      });
    }
  }

  async function updateContactStatus(id: string, status: ContactStatus) {
    if (!supabase) return;
    const { error } = await supabase
      .from("contact_messages")
      .update({ status })
      .eq("id", id);
    if (error) setInboxError(`Impossible de modifier le statut : ${error.message}`);
    else await loadData();
  }

  async function updateOrderStatus(id: string, status: OrderStatus) {
    if (!supabase) {
      setOrdersError("Supabase n’est pas configuré.");
      return;
    }
    const order = orders.find((item) => item.id === id);
    if (!order) {
      setOrdersError("Cette commande est introuvable. Actualisez la page et réessayez.");
      return;
    }
    if (order.status === status) return;

    const currentOrder = orderStatusOrder[order.status];
    const nextOrder = orderStatusOrder[status];
    const isForwardProgress =
      currentOrder !== undefined &&
      nextOrder !== undefined &&
      nextOrder > currentOrder;
    const isAllowedCancellation =
      status === "cancelled" &&
      order.status !== "completed" &&
      order.status !== "cancelled";
    if (!isForwardProgress && !isAllowedCancellation) {
      setOrdersError("Le statut d’une commande ne peut pas revenir à une étape précédente.");
      return;
    }

    setSavingOrderStatuses((current) => new Set(current).add(id));
    setOrdersError("");
    try {
      const { data, error } = await supabase
        .from("restaurant_orders")
        .update({ status })
        .eq("id", id)
        .eq("status", order.status)
        .select("id")
        .maybeSingle();
      if (error) {
        setOrdersError(`Impossible de modifier la commande : ${error.message}`);
        return;
      }
      if (!data) {
        setOrdersError(
          "Le statut a changé ailleurs. Les commandes sont en cours d’actualisation.",
        );
        await loadData();
        return;
      }
      await loadData();
    } catch (error) {
      setOrdersError(`Impossible de modifier la commande : ${getErrorMessage(error)}`);
    } finally {
      setSavingOrderStatuses((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteInboxItem(
    table: "reservation_requests" | "contact_messages" | "restaurant_orders",
    id: string,
  ) {
    if (!supabase || !window.confirm("Supprimer définitivement cet élément ?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setInboxError(`Suppression impossible : ${error.message}`);
    else await loadData();
  }

  async function saveDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setDebtError("Supabase n’est pas configuré.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setDebtError("Le montant doit être supérieur à zéro.");
      return;
    }

    const debtPage = debtPages.find((page) => page.key === activePage);
    if (!debtPage) return;
    const values = {
      direction: debtPage.direction,
      person_name: String(formData.get("person_name") ?? "").trim(),
      amount,
      description: String(formData.get("description") ?? "").trim(),
      due_date: String(formData.get("due_date") ?? "") || null,
    };

    setIsSavingDebt(true);
    setDebtError("");
    try {
      const { error } = await supabase.from("debt_records").insert(values);
      if (error) throw error;

      setShowDebtForm(false);
      await loadDebtRecords();
    } catch (error) {
      setDebtError(`Impossible d’enregistrer la dette : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingDebt(false);
    }
  }

  async function updateDebtStatus(debt: DebtRecord) {
    if (!supabase) {
      setDebtError("Supabase n’est pas configuré.");
      return;
    }
    setDebtError("");
    setSavingDebtIds((current) => new Set(current).add(debt.id));
    try {
      const { data, error } = await supabase
        .from("debt_records")
        .update({
          status: "settled",
          settled_at: new Date().toISOString(),
        })
        .eq("id", debt.id)
        .select("*")
        .single();
      if (error) throw error;
      setDebtRecords((current) =>
        current.map((item) => item.id === debt.id ? data as DebtRecord : item),
      );
    } catch (error) {
      setDebtError(`Impossible de modifier la dette : ${getErrorMessage(error)}`);
    } finally {
      setSavingDebtIds((current) => {
        const next = new Set(current);
        next.delete(debt.id);
        return next;
      });
    }
  }

  async function deleteDebt(debt: DebtRecord) {
    if (
      !supabase ||
      !window.confirm(`Supprimer définitivement la dette de ${debt.person_name} ?`)
    ) {
      return;
    }
    setDebtError("");
    setSavingDebtIds((current) => new Set(current).add(debt.id));
    try {
      const { error } = await supabase
        .from("debt_records")
        .delete()
        .eq("id", debt.id);
      if (error) throw error;
      setDebtRecords((current) => current.filter((item) => item.id !== debt.id));
    } catch (error) {
      setDebtError(`Impossible de supprimer la dette : ${getErrorMessage(error)}`);
    } finally {
      setSavingDebtIds((current) => {
        const next = new Set(current);
        next.delete(debt.id);
        return next;
      });
    }
  }

  async function saveContent<
    K extends
      | "restaurantMenu"
      | "galleryPhotos"
      | "homeGalleryPhotoIds"
      | "clientGalleryPhotoIds"
      | "events",
  >(
    section: K,
    value: (typeof content)[K],
  ): Promise<boolean> {
    setContentError("");
    setContentMessage("");
    setIsSavingContent(true);
    try {
      await saveSection(section, value);
      setContentMessage("Modifications enregistrées.");
      return true;
    } catch (error) {
      console.error(`Échec de l’enregistrement de ${section}.`, error);
      setContentError(
        `Enregistrement impossible : ${getErrorMessage(error)}`,
      );
      return false;
    } finally {
      setIsSavingContent(false);
    }
  }

  async function saveDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const imageEntry = data.get("image");
    const imageFile = imageEntry instanceof File && imageEntry.size > 0
      ? imageEntry
      : null;
    const dishId = editingDish?.id ?? crypto.randomUUID();
    let uploadedImagePath: string | null = null;

    if (
      imageFile &&
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type)
    ) {
      setContentError("L’image doit être au format JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (imageFile && imageFile.size > 10 * 1024 * 1024) {
      setContentError("L’image ne doit pas dépasser 10 Mo.");
      return;
    }
    if (imageFile && !supabase) {
      setContentError("Supabase doit être configuré pour téléverser une image.");
      return;
    }

    setIsSavingDish(true);
    setContentError("");
    try {
      let image = editingDish?.image;
      if (imageFile && supabase) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        uploadedImagePath = `restaurant-menu/${dishId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("accommodation-photos")
          .upload(uploadedImagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          });
        if (uploadError) {
          if ("statusCode" in uploadError && uploadError.statusCode === "404") {
            throw new Error(
              "Le bucket « accommodation-photos » est introuvable. Vérifiez sa configuration dans Supabase Storage.",
            );
          }
          throw uploadError;
        }
        image = supabase.storage
          .from("accommodation-photos")
          .getPublicUrl(uploadedImagePath).data.publicUrl;
      }

      const item: MenuItem = {
        id: dishId,
        name,
        description: String(data.get("description") ?? "").trim(),
        category:
          editingDish?.category ??
          restaurantCategoryPages.find((page) => page.key === activePage)?.category ??
          "Plats principaux",
        price: Number(data.get("price")),
        suspended: editingDish?.suspended ?? false,
        ...(image ? { image } : {}),
      };
      const next = editingDish
        ? content.restaurantMenu.map((existing) =>
            existing.id === editingDish.id ? item : existing,
          )
        : [...content.restaurantMenu, item];
      const saved = await saveContent("restaurantMenu", next);
      if (!saved && uploadedImagePath && supabase) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove([uploadedImagePath]);
        if (cleanupError) {
          console.error("L’image du plat n’a pas pu être nettoyée après l’échec de l’enregistrement.", cleanupError);
          setContentError(
            "Le plat n’a pas pu être enregistré et l’image téléversée n’a pas pu être supprimée.",
          );
        }
      }
      if (saved) {
        setShowDishForm(false);
        setEditingDish(null);
      }
    } catch (error) {
      if (uploadedImagePath && supabase) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove([uploadedImagePath]);
        if (cleanupError) {
          console.error("L’image du plat n’a pas pu être nettoyée après l’échec du téléversement.", cleanupError);
        }
      }
      setContentError(`Impossible d’enregistrer le plat : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingDish(false);
    }
  }

  async function toggleDishSuspension(dish: MenuItem) {
    await saveContent(
      "restaurantMenu",
      content.restaurantMenu.map((item) =>
        item.id === dish.id ? { ...item, suspended: !item.suspended } : item,
      ),
    );
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const imageEntry = data.get("image");
    const imageFile =
      imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
    if (!imageFile) {
      setContentError("Choisissez une image à ajouter à la galerie.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type)) {
      setContentError("L’image doit être au format JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      setContentError("L’image ne doit pas dépasser 10 Mo.");
      return;
    }
    if (!supabase) {
      setContentError("Supabase doit être configuré pour téléverser une image.");
      return;
    }

    const photoId = crypto.randomUUID();
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const imagePath = `gallery/${photoId}/${Date.now()}-${safeName}`;
    setContentError("");
    setIsUploadingPhoto(true);
    let uploadedImagePath: string | null = null;
    try {
      const { error: uploadError } = await supabase.storage
        .from("accommodation-photos")
        .upload(imagePath, imageFile, {
          contentType: imageFile.type,
          upsert: false,
        });
      if (uploadError) {
        if ("statusCode" in uploadError && uploadError.statusCode === "404") {
          throw new Error(
            "Le bucket « accommodation-photos » est introuvable. Vérifiez sa configuration dans Supabase Storage.",
          );
        }
        throw uploadError;
      }
      uploadedImagePath = imagePath;

      const imageName = imageFile.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const lastOrder =
        content.galleryPhotos.reduce(
          (maximum, photo) => Math.max(maximum, photo.order),
          0,
        ) + 10;
      const photo: GalleryPhoto = {
        id: photoId,
        url: supabase.storage
          .from("accommodation-photos")
          .getPublicUrl(imagePath).data.publicUrl,
        alt: imageName || "Photo de Keur Ana-Fi",
        caption: imageName || "Photo de Keur Ana-Fi",
        category: "L’établissement",
        order: lastOrder,
        date: new Date().toISOString(),
        status: "published",
        provisional: false,
        width: 900,
        height: 650,
      };
      setIsSavingContent(true);
      try {
        await saveSections({
          galleryPhotos: [photo, ...content.galleryPhotos],
          homeGalleryPhotoIds:
            content.homeGalleryPhotoIds ??
            clientHomeGalleryPhotos.map((homePhoto) => homePhoto.id),
          clientGalleryPhotoIds:
            content.clientGalleryPhotoIds ?? clientGalleryPhotoIds,
        });
        setContentMessage("Image ajoutée à la galerie.");
        setShowPhotoForm(false);
      } finally {
        setIsSavingContent(false);
      }
    } catch (error) {
      let cleanupFailed = false;
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove([uploadedImagePath]);
        if (cleanupError) {
          cleanupFailed = true;
          console.error("L’image de la galerie n’a pas pu être nettoyée après l’échec du téléversement.", cleanupError);
        }
      }
      setContentError(
        cleanupFailed
          ? `Impossible d’ajouter l’image : ${getErrorMessage(error)} L’image téléversée n’a pas pu être supprimée du stockage.`
          : `Impossible d’ajouter l’image : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function deletePhoto(id: string) {
    if (!window.confirm("Supprimer cette photo de la galerie ?")) return;
    await saveContent(
      "galleryPhotos",
      content.galleryPhotos.filter((photo) => photo.id !== id),
    );
  }

  async function togglePhotoPublication(photo: GalleryPhoto) {
    const status: GalleryPhoto["status"] =
      photo.status === "published" ? "draft" : "published";
    await saveContent(
      "galleryPhotos",
      content.galleryPhotos.map((item) =>
        item.id === photo.id
          ? { ...item, status }
          : item,
      ),
    );
  }

  async function replaceClientGalleryPhoto(
    slot: ClientGallerySlot,
    imageFile: File,
  ) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type)) {
      setContentError("L’image doit être au format JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      setContentError("L’image ne doit pas dépasser 10 Mo.");
      return;
    }
    if (!supabase) {
      setContentError("Supabase doit être configuré pour téléverser une image.");
      return;
    }

    const photoId = crypto.randomUUID();
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const imagePath = `gallery/${photoId}/${Date.now()}-${safeName}`;
    const imageName = imageFile.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    const previousPhoto = content.galleryPhotos.find(
      (photo) => photo.id === clientGalleryPhotoIds[slot],
    );
    const lastOrder =
      content.galleryPhotos.reduce(
        (maximum, photo) => Math.max(maximum, photo.order),
        0,
      ) + 10;
    const photo: GalleryPhoto = {
      id: photoId,
      url: "",
      alt: imageName || "Photo de Keur Ana-Fi",
      caption: imageName || "Photo de Keur Ana-Fi",
      category: previousPhoto?.category ?? "L’établissement",
      order: lastOrder,
      date: new Date().toISOString(),
      status: "published",
      provisional: false,
      width: 900,
      height: 650,
    };

    setContentError("");
    setContentMessage("");
    setIsUploadingPhoto(true);
    setIsSavingContent(true);
    setReplacingGalleryPhotoId(previousPhoto?.id ?? null);
    let uploadedImagePath: string | null = null;
    try {
      const { error: uploadError } = await supabase.storage
        .from("accommodation-photos")
        .upload(imagePath, imageFile, {
          contentType: imageFile.type,
          upsert: false,
        });
      if (uploadError) {
        if ("statusCode" in uploadError && uploadError.statusCode === "404") {
          throw new Error(
            "Le bucket « accommodation-photos » est introuvable. Vérifiez sa configuration dans Supabase Storage.",
          );
        }
        throw uploadError;
      }
      uploadedImagePath = imagePath;
      photo.url = supabase.storage
        .from("accommodation-photos")
        .getPublicUrl(imagePath).data.publicUrl;

      await saveSections({
        galleryPhotos: [photo, ...content.galleryPhotos],
        homeGalleryPhotoIds:
          content.homeGalleryPhotoIds ??
          clientHomeGalleryPhotos.map((homePhoto) => homePhoto.id),
        clientGalleryPhotoIds: {
          ...clientGalleryPhotoIds,
          [slot]: photo.id,
        },
      });
      setContentMessage("Image remplacée et ajoutée à la galerie.");
    } catch (error) {
      let cleanupFailed = false;
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove([uploadedImagePath]);
        if (cleanupError) {
          cleanupFailed = true;
          console.error(
            "L’image n’a pas pu être nettoyée après l’échec du remplacement.",
            cleanupError,
          );
        }
      }
      setContentError(
        cleanupFailed
          ? `Impossible de remplacer l’image : ${getErrorMessage(error)} L’image téléversée n’a pas pu être supprimée du stockage.`
          : `Impossible de remplacer l’image : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsUploadingPhoto(false);
      setIsSavingContent(false);
      setReplacingGalleryPhotoId(null);
    }
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const imageEntry = data.get("image");
    const imageFile =
      imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
    if (
      imageFile &&
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(imageFile.type)
    ) {
      setContentError("L’affiche doit être au format JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (imageFile && imageFile.size > 10 * 1024 * 1024) {
      setContentError("L’affiche ne doit pas dépasser 10 Mo.");
      return;
    }
    if (imageFile && !supabase) {
      setContentError("Supabase doit être configuré pour téléverser une affiche.");
      return;
    }

    const eventId = editingEvent?.id ?? crypto.randomUUID();
    let uploadedImagePath: string | null = null;
    setContentError("");
    setIsSavingEvent(true);
    try {
      let image = editingEvent?.image;
      if (imageFile && supabase) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        uploadedImagePath = `events/${eventId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("accommodation-photos")
          .upload(uploadedImagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          });
        if (uploadError) {
          if ("statusCode" in uploadError && uploadError.statusCode === "404") {
            throw new Error(
              "Le bucket « accommodation-photos » est introuvable. Vérifiez sa configuration dans Supabase Storage.",
            );
          }
          throw uploadError;
        }
        image = supabase.storage
          .from("accommodation-photos")
          .getPublicUrl(uploadedImagePath).data.publicUrl;
      }

    const item: EventItem & { id: string } = {
      id: eventId,
      title: String(data.get("title") ?? "").trim(),
      date: String(data.get("date") ?? ""),
      time: String(data.get("time") ?? "").trim() || undefined,
      description: String(data.get("description") ?? "").trim(),
      participation: String(data.get("participation") ?? "").trim(),
      location: String(data.get("location") ?? "").trim() || undefined,
      image,
    };
    const current = content.events as (EventItem & { id?: string })[];
    const next = editingEvent?.id
      ? current.map((existing) =>
          (existing.id ?? `${existing.date}-${existing.title}`) === editingEvent.id
            ? item
            : existing,
        )
      : [...current, item];
    if (await saveContent("events", next)) {
      setShowEventForm(false);
      setEditingEvent(null);
    } else if (uploadedImagePath && supabase) {
      const { error: cleanupError } = await supabase.storage
        .from("accommodation-photos")
        .remove([uploadedImagePath]);
      if (cleanupError) {
        console.error("L’affiche téléversée n’a pas pu être supprimée après l’échec de l’enregistrement.", cleanupError);
        setContentError(
          "L’événement n’a pas été enregistré et l’affiche téléversée n’a pas pu être supprimée.",
        );
      }
    }
    } catch (error) {
      if (uploadedImagePath && supabase) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove([uploadedImagePath]);
        if (cleanupError) {
          console.error("L’affiche n’a pas pu être nettoyée après l’échec de l’enregistrement.", cleanupError);
        }
      }
      setContentError(`Impossible d’enregistrer l’événement : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function saveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const roomId = editingRoom?.id ?? crypto.randomUUID();
    const selectedPhotos = Array.from(data.getAll("photos")).filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );
    const uploadedPaths: string[] = [];
    let phase = "validation des informations";
    let roomSaved = false;
    setRoomError("");
    setIsSavingRoom(true);

    try {
      const uploadedUrls: string[] = [];
      for (const [index, file] of selectedPhotos.entries()) {
        phase = `téléversement de la photo « ${file.name} »`;
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
          throw new Error(`« ${file.name} » doit être une image JPG, PNG, WEBP ou GIF.`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`« ${file.name} » dépasse la limite de 10 Mo.`);
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${roomId}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("accommodation-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          if ("statusCode" in uploadError && uploadError.statusCode === "404") {
            throw new Error(
              "L’API Storage de ce projet ne reconnaît pas le bucket « accommodation-photos ». Créez-le depuis Supabase → Storage (pas par SQL). S’il est déjà visible, vérifiez que le tableau de bord et le site utilisent le même projet; ne supprimez pas un bucket qui contient déjà des photos.",
            );
          }
          throw uploadError;
        }
        uploadedPaths.push(path);
        uploadedUrls.push(
          supabase.storage.from("accommodation-photos").getPublicUrl(path).data.publicUrl,
        );
      }

      const name = String(data.get("name") ?? "").trim();
      const imageAlt = String(data.get("image_alt") ?? "").trim();
      const images = [...roomImages, ...uploadedUrls];
      if (!images.length) {
        throw new Error("Ajoutez au moins une photo à la chambre.");
      }
      const capacity = Number(data.get("capacity"));
      const maxChildren = Number(data.get("max_children"));
      if (!Number.isInteger(maxChildren) || maxChildren < 0 || maxChildren > capacity) {
        throw new Error(
          "Le nombre maximum d’enfants doit être compris entre 0 et la capacité totale de la chambre.",
        );
      }
      const bedQuantity = Number(data.get("bed_quantity"));
      const bedType = String(data.get("bed_type") ?? "");
      const amenities = selectedRoomAmenities;

      phase = "enregistrement de la chambre dans la table accommodations";
      const { error: saveError } = await supabase.from("accommodations").upsert({
        id: roomId,
        name,
        description: String(data.get("description") ?? "").trim(),
        image_alt: imageAlt,
        images,
        capacity,
        max_children: maxChildren,
        amenities,
        price: Number(data.get("price")),
        beds: [{ quantity: bedQuantity, type: bedType }],
        is_published: editingRoom?.published ?? true,
        provisional: false,
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      roomSaved = true;

      const removedPaths = (editingRoom?.images ?? [])
        .filter((image) => !images.includes(image))
        .map((url) => {
          const marker = "/storage/v1/object/public/accommodation-photos/";
          const index = url.indexOf(marker);
          return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : "";
        })
        .filter(Boolean);
      if (removedPaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove(removedPaths);
        if (cleanupError) {
          console.error("La chambre est enregistrée, mais certaines anciennes photos n’ont pas été supprimées.", cleanupError);
        }
      }

      phase = "rechargement de la liste des chambres";
      await loadAccommodationData();
      setShowRoomForm(false);
      setEditingRoom(null);
      setRoomImages([]);
      setSelectedRoomPhotos([]);
      setSelectedRoomAmenities([]);
      setRoomAmenitySearch("");
    } catch (error) {
      if (!roomSaved && uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("accommodation-photos")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Impossible de supprimer les photos chargées après l’échec.", cleanupError);
        }
      }
      console.error("Échec de l’enregistrement de la chambre.", error);
      setRoomError(
        roomSaved
          ? `La chambre a été enregistrée, mais la liste n’a pas pu être actualisée : ${getErrorMessage(error)}`
          : `Enregistrement impossible (${phase}) : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSavingRoom(false);
    }
  }

  async function loadAccommodationData() {
    if (!supabase) throw new Error("Supabase n’est pas configuré.");
    const { data, error } = await supabase
      .from("accommodations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      throw error;
    }
    const rooms = (data ?? []).map((row) => {
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
    updateAccommodations(rooms);
  }

  async function addAmenity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amenity = newAmenity.trim();
    if (!amenity) return;
    if (content.amenityOptions.some((option) => option.toLocaleLowerCase("fr") === amenity.toLocaleLowerCase("fr"))) {
      setAmenityError("Cet équipement existe déjà.");
      return;
    }

    setAmenityError("");
    setIsSavingAmenity(true);
    try {
      await saveSection("amenityOptions", [...content.amenityOptions, amenity]);
      setNewAmenity("");
    } catch (error) {
      setAmenityError(
        `Impossible d’ajouter cet équipement : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSavingAmenity(false);
    }
  }

  async function deleteAmenity(amenity: string) {
    if (!supabase) return;
    const roomsUsingAmenity = content.accommodations.filter((room) =>
      room.amenities.includes(amenity),
    );
    const confirmation = roomsUsingAmenity.length
      ? `« ${amenity} » est utilisé dans ${roomsUsingAmenity.length} chambre(s). Le retirer aussi de ces chambres ?`
      : `Supprimer « ${amenity} » de la liste des équipements ?`;
    if (!window.confirm(confirmation)) return;

    setAmenityError("");
    setIsSavingAmenity(true);
    try {
      for (const room of roomsUsingAmenity) {
        const remainingAmenities = room.amenities.filter((item) => item !== amenity);
        const { error } = await supabase
          .from("accommodations")
          .update({ amenities: remainingAmenities })
          .eq("id", room.id);
        if (error) throw error;
      }

      await saveSection(
        "amenityOptions",
        content.amenityOptions.filter((option) => option !== amenity),
      );
      if (roomsUsingAmenity.length) {
        try {
          await loadAccommodationData();
        } catch (error) {
          setAmenityError(`Équipement supprimé, mais les chambres n’ont pas pu être actualisées : ${getErrorMessage(error)}`);
        }
      }
    } catch (error) {
      console.error("Échec de la suppression de l’équipement.", error);
      setAmenityError(
        `Impossible de supprimer cet équipement : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSavingAmenity(false);
    }
  }

  async function savePaymentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = paymentNumber.trim();
    if (number.length < 6 || number.length > 30) {
      setPaymentError("Le numéro doit contenir entre 6 et 30 caractères.");
      return;
    }

    const paymentAccounts = editingPaymentAccount
      ? content.site.paymentAccounts.map((account) =>
          account.id === editingPaymentAccount.id
            ? { ...account, operator: paymentOperator, number }
            : account,
        )
      : [
          ...content.site.paymentAccounts,
          { id: crypto.randomUUID(), operator: paymentOperator, number },
        ];

    setPaymentError("");
    setIsSavingPaymentAccounts(true);
    try {
      await saveSection("site", { ...content.site, paymentAccounts });
      setPaymentNumber("");
      setPaymentOperator("wave");
      setEditingPaymentAccount(null);
      setContentMessage("Numéro de paiement enregistré.");
      setContentError("");
    } catch (error) {
      setPaymentError(`Enregistrement impossible : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingPaymentAccounts(false);
    }
  }

  async function deletePaymentAccount(account: PaymentAccount) {
    if (
      !window.confirm(
        `Supprimer le numéro ${account.number} (${paymentOperatorLabels[account.operator]}) ?`,
      )
    ) {
      return;
    }

    setPaymentError("");
    setIsSavingPaymentAccounts(true);
    try {
      await saveSection("site", {
        ...content.site,
        paymentAccounts: content.site.paymentAccounts.filter(
          (item) => item.id !== account.id,
        ),
      });
      if (editingPaymentAccount?.id === account.id) {
        setEditingPaymentAccount(null);
        setPaymentNumber("");
        setPaymentOperator("wave");
      }
      setContentMessage("Numéro de paiement supprimé.");
      setContentError("");
    } catch (error) {
      setPaymentError(`Suppression impossible : ${getErrorMessage(error)}`);
    } finally {
      setIsSavingPaymentAccounts(false);
    }
  }

  async function deleteRoom(room: (typeof content.accommodations)[number]) {
    if (!supabase || !window.confirm(`Supprimer la chambre « ${room.name} » ?`)) return;
    setRoomError("");
    const [{ count: linkedById, error: idError }, { count: linkedByName, error: nameError }] =
      await Promise.all([
        supabase
          .from("reservation_requests")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id),
        supabase
          .from("reservation_requests")
          .select("id", { count: "exact", head: true })
          .eq("room", room.name),
      ]);
    if (idError || nameError) {
      setRoomError(`Vérification des réservations impossible : ${(idError ?? nameError)?.message}`);
      return;
    }

    if ((linkedById ?? 0) + (linkedByName ?? 0) > 0) {
      setRoomError(
        `Suppression impossible : des demandes d’hébergement sont liées à « ${room.name} ». Conservez cette fiche pour garder l’historique des réservations.`,
      );
      return;
    }

    const { error } = await supabase.from("accommodations").delete().eq("id", room.id);
    if (error) {
      setRoomError(
        error.code === "23503"
          ? "Cette chambre est liée à une réservation et ne peut pas être supprimée."
          : `Suppression impossible : ${error.message}`,
      );
      return;
    }

    const paths = room.images
      .map((url) => {
        const marker = "/storage/v1/object/public/accommodation-photos/";
        const index = url.indexOf(marker);
        return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : "";
      })
      .filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage
        .from("accommodation-photos")
        .remove(paths);
      if (storageError) {
        console.error("Chambre supprimée, mais certaines photos n’ont pas pu être supprimées.", storageError);
      }
    }
    try {
      await loadAccommodationData();
    } catch (error) {
      setRoomError(`Chambre supprimée, mais la liste n’a pas pu être actualisée : ${getErrorMessage(error)}`);
    }
  }

  async function toggleRoomPublication(room: (typeof content.accommodations)[number]) {
    if (!supabase) {
      setRoomError("La connexion à la base de données est indisponible.");
      return;
    }

    setRoomError("");
    setUpdatingRoomPublicationIds((current) => new Set(current).add(room.id));
    try {
      const { error } = await supabase
        .from("accommodations")
        .update({
          is_published: !room.published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);
      if (error) throw error;

      try {
        await loadAccommodationData();
      } catch (error) {
        setRoomError(
          `La chambre a été ${room.published ? "dépubliée" : "publiée"}, mais la liste n’a pas pu être actualisée : ${getErrorMessage(error)}`,
        );
        return;
      }
      setContentMessage(
        room.published
          ? `La chambre « ${room.name} » a été dépubliée.`
          : `La chambre « ${room.name} » est publiée.`,
      );
    } catch (error) {
      setRoomError(
        `Impossible de ${room.published ? "dépublier" : "publier"} la chambre : ${getErrorMessage(error)}`,
      );
    } finally {
      setUpdatingRoomPublicationIds((current) => {
        const next = new Set(current);
        next.delete(room.id);
        return next;
      });
    }
  }

  async function openCompletedReservationHistory() {
    setShowCompletedReservationHistory(true);
    setIsLoadingCompletedReservationHistory(true);
    setCompletedReservationHistoryError("");
    if (!supabase) {
      setCompletedReservationHistoryError(
        "La connexion à la base de données est indisponible.",
      );
      setIsLoadingCompletedReservationHistory(false);
      return;
    }

    try {
      const history: Reservation[] = [];
      const pageSize = 1000;
      let page = 0;
      while (true) {
        const { data, error } = await supabase
          .from("reservation_requests")
          .select("*")
          .in("status", ["completed", "cancelled"])
          .order("departure", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;

        const rows = (data ?? []) as Reservation[];
        history.push(...rows);
        if (rows.length < pageSize) break;
        page += 1;
      }
      setCompletedReservationHistory(history);
    } catch (error) {
      setCompletedReservationHistoryError(
        `Impossible de charger l’historique des réservations terminées ou annulées : ${getErrorMessage(error)}`,
      );
    } finally {
      setIsLoadingCompletedReservationHistory(false);
    }
  }

  async function deleteEvent(index: number) {
    if (!window.confirm("Supprimer cet événement ?")) return;
    await saveContent(
      "events",
      content.events.filter((_, eventIndex) => eventIndex !== index),
    );
  }

  if (!isConnected) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <h1>Administration</h1>
          <p>Configurez Supabase dans <code>.env.local</code>, puis relancez le serveur.</p>
        </section>
      </main>
    );
  }

  if (isCheckingAuth || isLoading) {
    return (
      <main className="admin-page admin-login-page">
        <section className="admin-login-card admin-login-wait">
          <span className="admin-login-mark" aria-hidden="true">
            <ShieldCheck size={23} />
          </span>
          <h1>Administration</h1>
          <p role="status">Ouverture de votre espace sécurisé…</p>
          <span className="admin-login-progress" aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-page admin-login-page">
        <section className="admin-login-card">
          <form className="admin-login-form" onSubmit={signIn}>
            <span className="admin-login-mark" aria-hidden="true">
              <ShieldCheck size={23} />
            </span>
            <div className="admin-login-heading">
              <span className="admin-login-eyebrow">Accès sécurisé</span>
              <h1 id="admin-login-title">Administration</h1>
            </div>
            <div className="admin-login-field-group">
              <label htmlFor="admin-login-email">Adresse e-mail</label>
              <div className="admin-login-field">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="admin-login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="admin-login-field-group">
              <label htmlFor="admin-login-password">Mot de passe</label>
              <div className="admin-login-field">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="admin-login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>
            {authError && (
              <p className="admin-error admin-login-error" role="alert">
                {authError}
              </p>
            )}
            <button className="admin-login-submit" type="submit">
              <span>Se connecter</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      </main>
    );
  }

  const newReservationCount = reservations.filter((item) => item.status === "pending").length;
  const isAccommodationStatsPeriodValid =
    Boolean(accommodationStatsStartDate) &&
    Boolean(accommodationStatsEndDate) &&
    accommodationStatsStartDate <= accommodationStatsEndDate;
  const periodStatsReservations = isAccommodationStatsPeriodValid
    ? accommodationStatsReservations.filter(
        (reservation) =>
          reservation.departure >= accommodationStatsStartDate &&
          reservation.departure <= accommodationStatsEndDate,
      )
    : [];
  const allCompletedStatsReservations = accommodationStatsReservations.filter(
    (reservation) =>
      reservation.status === "completed" &&
      reservation.total_amount_snapshot !== null &&
      reservation.total_amount_snapshot !== undefined,
  );
  const completedStatsReservations = periodStatsReservations.filter(
    (reservation) =>
      reservation.status === "completed" &&
      reservation.total_amount_snapshot !== null &&
      reservation.total_amount_snapshot !== undefined,
  );
  const cancelledStatsReservations = periodStatsReservations.filter(
    (reservation) => reservation.status === "cancelled",
  );
  const cancelledStatsRevenue = cancelledStatsReservations.reduce(
    (total, reservation) => total + (reservation.total_amount_snapshot ?? 0),
    0,
  );
  const completedStatsRevenue = completedStatsReservations.reduce(
    (total, reservation) => total + (reservation.total_amount_snapshot ?? 0),
    0,
  );
  const activeStatsRevenue = periodStatsReservations.reduce(
    (total, reservation) =>
      reservation.status === "confirmed" || reservation.status === "in_progress"
        ? total + (reservation.total_amount_snapshot ?? 0)
        : total,
    0,
  );
  const pendingStatsRevenue = periodStatsReservations.reduce(
    (total, reservation) =>
      reservation.status === "pending"
        ? total + (reservation.total_amount_snapshot ?? 0)
        : total,
    0,
  );
  const statsCurrentDate = statisticsToday;
  const statsChartDays = 30;
  const statsChartStart = new Date(`${statsCurrentDate}T00:00:00Z`);
  statsChartStart.setUTCDate(statsChartStart.getUTCDate() - (statsChartDays - 1));
  const statsChartStartKey = statsChartStart.toISOString().slice(0, 10);
  const last30DaysDailyTotals = new Map<
    string,
    { completed: number; cancelled: number; completedCount: number; cancelledCount: number }
  >();
  for (const reservation of accommodationStatsReservations) {
    const revenueDate =
      reservation.departure > statsCurrentDate
        ? statsCurrentDate
        : reservation.departure;
    if (
      revenueDate < statsChartStartKey ||
      (reservation.status !== "completed" && reservation.status !== "cancelled")
    ) {
      continue;
    }
    const current = last30DaysDailyTotals.get(revenueDate) ?? {
      completed: 0,
      cancelled: 0,
      completedCount: 0,
      cancelledCount: 0,
    };
    if (reservation.status === "completed") {
      current.completed += Number(reservation.total_amount_snapshot ?? 0);
      current.completedCount += 1;
    } else {
      current.cancelled += Number(reservation.total_amount_snapshot ?? 0);
      current.cancelledCount += 1;
    }
    last30DaysDailyTotals.set(revenueDate, current);
  }
  const last30DaysRevenue = Array.from(
    { length: statsChartDays },
    (_, index) => {
      const date = new Date(statsChartStart);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const daily = last30DaysDailyTotals.get(key);
      return {
        key,
        completed: daily?.completed ?? 0,
        cancelled: daily?.cancelled ?? 0,
        completedCount: daily?.completedCount ?? 0,
        cancelledCount: daily?.cancelledCount ?? 0,
      };
    },
  );
  const maxDailyAmount = Math.max(
    ...last30DaysRevenue.flatMap((day) => [day.completed, day.cancelled]),
    1,
  );
  const monthlyChartWidth = 820;
  const monthlyChartHeight = 290;
  const monthlyChartPadding = { left: 70, right: 22, top: 22, bottom: 52 };
  const monthlyChartPlotWidth =
    monthlyChartWidth - monthlyChartPadding.left - monthlyChartPadding.right;
  const monthlyChartPlotHeight =
    monthlyChartHeight - monthlyChartPadding.top - monthlyChartPadding.bottom;
  const completedRevenuePoints = last30DaysRevenue
    .map((day, index) => {
      return {
        x:
          monthlyChartPadding.left +
          (index / (statsChartDays - 1)) * monthlyChartPlotWidth,
        y:
          monthlyChartPadding.top +
          (1 - day.completed / maxDailyAmount) * monthlyChartPlotHeight,
      };
    });
  const cancelledRevenuePoints = last30DaysRevenue
    .map((day, index) => {
      return {
        x:
          monthlyChartPadding.left +
          (index / (statsChartDays - 1)) * monthlyChartPlotWidth,
        y:
          monthlyChartPadding.top +
          (1 - day.cancelled / maxDailyAmount) * monthlyChartPlotHeight,
      };
    });
  const chartDateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const chartDateTicks = last30DaysRevenue.filter(
    (_, index) => index % 5 === 0 || index === statsChartDays - 1,
  );
  const currentMonth = new Date(`${dakarDateKey().slice(0, 7)}-01T00:00:00Z`);
  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentMonth);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: new Intl.DateTimeFormat("fr-FR", {
        month: "short",
        timeZone: "UTC",
      }).format(date),
      amount: allCompletedStatsReservations.reduce(
        (total, reservation) =>
          reservation.departure.slice(0, 7) === key
            ? total + (reservation.total_amount_snapshot ?? 0)
            : total,
        0,
      ),
      count: allCompletedStatsReservations.filter(
        (reservation) => reservation.departure.slice(0, 7) === key,
      ).length,
    };
  });
  const roomRevenue = Array.from(
    completedStatsReservations.reduce((totals, reservation) => {
      const label = reservation.room?.trim() || "Chambre sans nom";
      totals.set(
        label,
        (totals.get(label) ?? 0) + (reservation.total_amount_snapshot ?? 0),
      );
      return totals;
    }, new Map<string, number>()),
    ([name, amount]) => ({ name, amount }),
  )
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);
  const maxRoomRevenue = Math.max(...roomRevenue.map((room) => room.amount), 1);
  const statsNow = Date.now();
  const cleaningStatsByRoom = content.accommodations
    .map((room) => {
      const roomBlocks = accommodationStatsCleaningBlocks.filter(
        (block) =>
          block.room_id === room.id &&
          isAccommodationStatsPeriodValid &&
          dakarTimestampDateKey(block.starts_at) >= accommodationStatsStartDate &&
          dakarTimestampDateKey(block.starts_at) <= accommodationStatsEndDate,
      );
      const completed = roomBlocks.filter(
        (block) => new Date(block.ends_at).getTime() <= statsNow,
      ).length;
      const scheduled = roomBlocks.length - completed;
      return {
        id: room.id,
        name: room.name,
        completed,
        scheduled,
        total: roomBlocks.length,
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total || left.name.localeCompare(right.name, "fr"),
    );
  const completedOrders = orders.filter((order) => order.status === "completed");
  const isRestaurantStatsPeriodValid =
    Boolean(restaurantStatsStartDate) &&
    Boolean(restaurantStatsEndDate) &&
    restaurantStatsStartDate <= restaurantStatsEndDate;
  const restaurantStatsOrders = isRestaurantStatsPeriodValid
    ? orders.filter((order) => {
        const orderDate = order.created_at.slice(0, 10);
        return (
          orderDate >= restaurantStatsStartDate &&
          orderDate <= restaurantStatsEndDate
        );
      })
    : [];
  const restaurantStatsCompletedOrders = restaurantStatsOrders.filter(
    (order) => order.status === "completed",
  );
  const completedOrderRevenue = restaurantStatsCompletedOrders.reduce(
    (total, order) => total + order.total,
    0,
  );
  const cancelledOrders = restaurantStatsOrders.filter(
    (order) => order.status === "cancelled",
  );
  const cancelledOrderRevenue = cancelledOrders.reduce(
    (total, order) => total + order.total,
    0,
  );
  const activeRestaurantOrders = restaurantStatsOrders.filter(
    (order) => order.status === "new" || order.status === "preparing" || order.status === "ready",
  );
  const currentRestaurantStatsMonth = new Date(
    `${dakarDateKey().slice(0, 7)}-01T00:00:00Z`,
  );
  const monthlyOrderRevenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentRestaurantStatsMonth);
    date.setUTCMonth(date.getUTCMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    const monthOrders = completedOrders.filter((order) => order.created_at.slice(0, 7) === key);
    return {
      key,
      label: new Intl.DateTimeFormat("fr-FR", {
        month: "short",
        timeZone: "UTC",
      }).format(date),
      amount: monthOrders.reduce((total, order) => total + order.total, 0),
      count: monthOrders.length,
    };
  });
  const maxMonthlyCompletedOrderCount = Math.max(
    ...monthlyOrderRevenue.map((month) => month.count),
    1,
  );
  const settledDebtRecords = debtRecords.filter((debt) => debt.status === "settled");
  const isDashboardPeriodValid = dashboardStartDate <= dashboardEndDate;
  const dashboardDateKeys: string[] = [];
  if (isDashboardPeriodValid) {
    const date = new Date(`${dashboardStartDate}T00:00:00Z`);
    const end = new Date(`${dashboardEndDate}T00:00:00Z`);
    while (date <= end) {
      dashboardDateKeys.push(date.toISOString().slice(0, 10));
      date.setUTCDate(date.getUTCDate() + 1);
    }
  }
  const isDashboardDailyPeriod = dashboardDateKeys.length <= 31;
  const dashboardPeriodBucketKeys = isDashboardDailyPeriod
    ? dashboardDateKeys
    : Array.from(
        new Set(dashboardDateKeys.map((date) => date.slice(0, 7))),
      );
  const dashboardPeriodBuckets = dashboardPeriodBucketKeys.map((key) => {
    const bucketStart = isDashboardDailyPeriod
      ? key
      : key === dashboardStartDate.slice(0, 7)
        ? dashboardStartDate
        : `${key}-01`;
    const bucketEnd = isDashboardDailyPeriod
      ? key
      : key === dashboardEndDate.slice(0, 7)
        ? dashboardEndDate
        : new Date(
            Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0),
          )
            .toISOString()
            .slice(0, 10);
    const date = new Date(`${isDashboardDailyPeriod ? key : `${key}-01`}T12:00:00Z`);
    return {
      key,
      startDate: bucketStart,
      endDate: bucketEnd,
      label: new Intl.DateTimeFormat("fr-FR", {
        ...(isDashboardDailyPeriod
          ? { day: "numeric", month: "short" }
          : { month: "short", year: "2-digit" }),
        timeZone: "UTC",
      }).format(date),
    };
  });
  const dashboardMonthlyRevenue = monthlyRevenue.map((month, index) => {
    const settledDebtAmount = settledDebtRecords
      .filter((debt) => debt.settled_at?.slice(0, 7) === month.key)
      .reduce((total, debt) => total + debt.amount, 0);
    return {
      ...month,
      amount:
        month.amount +
        (monthlyOrderRevenue[index]?.amount ?? 0) +
        settledDebtAmount,
    };
  });
  const maxDashboardMonthlyRevenue = Math.max(
    ...dashboardMonthlyRevenue.map((month) => month.amount),
    1,
  );
  const dashboardCompletedStatsReservations = allCompletedStatsReservations.filter(
    (reservation) =>
      reservation.departure >= dashboardStartDate &&
      reservation.departure <= dashboardEndDate,
  );
  const dashboardCompletedStatsRevenue = dashboardCompletedStatsReservations.reduce(
    (total, reservation) =>
      total + (reservation.total_amount_snapshot ?? 0),
    0,
  );
  const dashboardCompletedOrders = completedOrders.filter(
    (order) =>
      order.created_at.slice(0, 10) >= dashboardStartDate &&
      order.created_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardCompletedOrderRevenue = dashboardCompletedOrders.reduce(
    (total, order) => total + order.total,
    0,
  );
  const dashboardSettledDebtRecords = settledDebtRecords.filter(
    (debt) =>
      debt.settled_at !== null &&
      debt.settled_at.slice(0, 10) >= dashboardStartDate &&
      debt.settled_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardSettledDebtRevenue = dashboardSettledDebtRecords.reduce(
    (total, debt) => total + debt.amount,
    0,
  );
  const totalRealizedFortune =
    dashboardCompletedStatsRevenue +
    dashboardCompletedOrderRevenue +
    dashboardSettledDebtRevenue;
  const dashboardReservations = accommodationStatsReservations.filter(
    (reservation) =>
      reservation.created_at.slice(0, 10) >= dashboardStartDate &&
      reservation.created_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardOrders = orders.filter(
    (order) =>
      order.created_at.slice(0, 10) >= dashboardStartDate &&
      order.created_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardContacts = dashboardContactActivity.filter(
    (message) =>
      message.created_at.slice(0, 10) >= dashboardStartDate &&
      message.created_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardDebts = debtRecords.filter(
    (debt) =>
      debt.created_at.slice(0, 10) >= dashboardStartDate &&
      debt.created_at.slice(0, 10) <= dashboardEndDate,
  );
  const dashboardReservationCount = dashboardReservations.length;
  const dashboardPendingReservationCount = dashboardReservations.filter(
    (reservation) => reservation.status === "pending",
  ).length;
  const dashboardNewOrderCount = dashboardOrders.filter(
    (order) => order.status === "new",
  ).length;
  const dashboardContactCount = dashboardContacts.length;
  const dashboardNewContactCount = dashboardContacts.filter(
    (message) => message.status === "new",
  ).length;
  const isDashboardDataLoading =
    isLoadingAccommodationStats || isLoadingInbox || isLoadingDebts;
  const unpaidReceivableTotal = dashboardDebts
    .filter((debt) => debt.direction === "receivable" && debt.status === "unpaid")
    .reduce((total, debt) => total + debt.amount, 0);
  const unpaidPayableTotal = dashboardDebts
    .filter((debt) => debt.direction === "payable" && debt.status === "unpaid")
    .reduce((total, debt) => total + debt.amount, 0);
  const totalOutstandingDebts = unpaidReceivableTotal + unpaidPayableTotal;
  const overdueDebtCount = debtRecords.filter(
    (debt) =>
      debt.status === "unpaid" &&
      debt.due_date !== null &&
      debt.due_date < dakarDateKey(),
  ).length;
  const dashboardActivity = dashboardPeriodBuckets.map((bucket) => {
    const isInBucket = (value: string) =>
      value.slice(0, 10) >= bucket.startDate &&
      value.slice(0, 10) <= bucket.endDate;
    const reservationsForDay = dashboardReservations.filter(
      (reservation) => isInBucket(reservation.created_at),
    );
    const ordersForDay = dashboardOrders.filter(
      (order) => isInBucket(order.created_at),
    );
    const debtsForDay = dashboardDebts.filter((debt) =>
      isInBucket(debt.created_at),
    );
    const contactsForDay = dashboardContacts.filter(
      (message) => isInBucket(message.created_at),
    );
    return {
      key: bucket.key,
      label: bucket.label,
      contactsNew: contactsForDay.length,
      contactsHandled: contactsForDay.filter(
        (message) => message.status === "handled",
      ).length,
      reservationsCompleted: reservationsForDay.filter(
        (reservation) => reservation.status === "completed",
      ).length,
      reservationsCancelled: reservationsForDay.filter(
        (reservation) => reservation.status === "cancelled",
      ).length,
      ordersCompleted: ordersForDay.filter((order) => order.status === "completed").length,
      ordersCancelled: ordersForDay.filter((order) => order.status === "cancelled").length,
      debtsReceivable: debtsForDay
        .filter((debt) => debt.direction === "receivable")
        .reduce((total, debt) => total + debt.amount, 0),
      debtsPayable: debtsForDay
        .filter((debt) => debt.direction === "payable")
        .reduce((total, debt) => total + debt.amount, 0),
    };
  });
  const dashboardPeriodLabel = `${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Dakar",
  }).format(new Date(`${dashboardStartDate}T12:00:00Z`))} – ${new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Dakar",
    },
  ).format(new Date(`${dashboardEndDate}T12:00:00Z`))}`;
  const dashboardDateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Dakar",
  }).format(new Date(`${dakarDateKey()}T12:00:00Z`));
  const dashboardActivityCharts = [
    {
      key: "orders",
      title: "Commandes",
      unit: "commandes",
      currency: false,
      series: [
        {
          key: "completed",
          label: "Terminées",
          color: "#d0f600",
          values: dashboardActivity.map((day) => day.ordersCompleted),
        },
        {
          key: "cancelled",
          label: "Annulées",
          color: "#ee0039",
          values: dashboardActivity.map((day) => day.ordersCancelled),
        },
      ],
    },
    {
      key: "reservations",
      title: "Réservations",
      unit: "réservations",
      currency: false,
      series: [
        {
          key: "completed",
          label: "Terminées",
          color: "#d0f600",
          values: dashboardActivity.map((day) => day.reservationsCompleted),
        },
        {
          key: "cancelled",
          label: "Annulées",
          color: "#ee0039",
          values: dashboardActivity.map((day) => day.reservationsCancelled),
        },
      ],
    },
    {
      key: "debts",
      title: "Dettes",
      unit: "FCFA",
      currency: true,
      series: [
        {
          key: "receivable",
          label: "On me doit",
          color: "#FFDD00",
          values: dashboardActivity.map((day) => day.debtsReceivable),
        },
        {
          key: "payable",
          label: "Je dois",
          color: "#ee0039",
          values: dashboardActivity.map((day) => day.debtsPayable),
        },
      ],
    },
    {
      key: "contacts",
      title: "Messages de contact",
      unit: "messages",
      currency: false,
      series: [
        {
          key: "new",
          label: "Messages reçus",
          color: "#4BD200",
          values: dashboardActivity.map((day) => day.contactsNew),
        },
        {
          key: "handled",
          label: "Répondus",
          color: "#FFDD00",
          values: dashboardActivity.map((day) => day.contactsHandled),
        },
      ],
    },
  ];
  const recentDashboardOrders = [...dashboardOrders]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
  const recentDashboardReservations = [...dashboardReservations]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
  const recentDashboardDebts = [...dashboardDebts]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
  const recentDashboardContacts = [...dashboardContacts]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
  const restaurantMenuById = new Map(
    content.restaurantMenu.map((item) => [item.id, item]),
  );
  const restaurantMenuByName = new Map(
    content.restaurantMenu.map((item) => [
      item.name.trim().toLocaleLowerCase("fr"),
      item,
    ]),
  );
  const restaurantDishSalesByCategory = new Map<
    string,
    Map<string, { quantity: number; revenue: number }>
  >();
  for (const order of restaurantStatsCompletedOrders) {
    for (const line of order.items) {
      const menuItem =
        restaurantMenuById.get(line.id) ??
        restaurantMenuByName.get(line.name.trim().toLocaleLowerCase("fr"));
      const category = menuItem?.category ?? "Autres";
      const dishName = line.name.trim() || "Article sans nom";
      const categoryDishes =
        restaurantDishSalesByCategory.get(category) ??
        new Map<string, { quantity: number; revenue: number }>();
      const current = categoryDishes.get(dishName) ?? { quantity: 0, revenue: 0 };
      current.quantity += line.quantity;
      current.revenue += line.price * line.quantity;
      categoryDishes.set(dishName, current);
      restaurantDishSalesByCategory.set(category, categoryDishes);
    }
  }
  const restaurantCategorySales = Array.from(
    restaurantDishSalesByCategory,
    ([category, dishes]) => ({
      category,
      color: restaurantSalesCategoryColors[category] ?? restaurantSalesCategoryColors.Autres,
      revenue: Array.from(dishes.values()).reduce(
        (total, dish) => total + dish.revenue,
        0,
      ),
    }),
  ).sort(
    (left, right) =>
      restaurantSalesCategoryOrder.indexOf(left.category) -
      restaurantSalesCategoryOrder.indexOf(right.category),
  );
  const restaurantCategoryRevenueTotal = restaurantCategorySales.reduce(
    (total, category) => total + category.revenue,
    0,
  );
  const restaurantDishRankings = restaurantSalesCategoryOrder
    .map((category) => ({
      category,
      color: restaurantSalesCategoryColors[category],
      dishes: Array.from(
        restaurantDishSalesByCategory.get(category) ??
          new Map<string, { quantity: number; revenue: number }>(),
        ([name, values]) => ({ name, ...values }),
      ).sort(
        (left, right) =>
          right.quantity - left.quantity || right.revenue - left.revenue,
      ),
    }))
    .filter((category) => category.dishes.length > 0);
  const popularRestaurantItems = restaurantDishRankings
    .flatMap((category) =>
      category.dishes.map((dish) => ({ ...dish, category: category.category })),
    )
    .sort(
      (left, right) =>
        right.quantity - left.quantity || right.revenue - left.revenue,
    )
    .slice(0, 5);
  const maxPopularRestaurantQuantity = Math.max(
    ...popularRestaurantItems.map((item) => item.quantity),
    1,
  );
  const newOrderCount = orders.filter((item) => item.status === "new").length;
  const newContactCount = contacts.filter((item) => item.status === "new").length;
  const filteredReservations = reservations.filter((reservation) => {
    const matchesStatus =
      reservationStatusFilter === "all" ||
      reservation.status === reservationStatusFilter;
    return (
      reservation.status !== "completed" &&
      reservation.status !== "cancelled" &&
      matchesStatus &&
      matchesReservationSearch(reservation, reservationSearch)
    );
  });
  const filteredCompletedReservationHistory = completedReservationHistory.filter(
    (reservation) =>
      matchesReservationSearch(reservation, reservationHistorySearch),
  );
  const roomAmenityOptions = Array.from(
    new Set([
      ...content.amenityOptions,
      ...(editingRoom?.amenities ?? []),
    ]),
  );
  const filteredRoomAmenityOptions = roomAmenityOptions.filter((amenity) =>
    amenity
      .toLocaleLowerCase("fr")
      .includes(roomAmenitySearch.trim().toLocaleLowerCase("fr")),
  );
  const activeRestaurantPage = restaurantCategoryPages.find(
    (page) => page.key === activePage,
  );
  const activeRestaurantDishes = activeRestaurantPage
    ? content.restaurantMenu.filter(
        (dish) =>
          dish.category === activeRestaurantPage.category ||
          (activeRestaurantPage.category === "Boissons" &&
            dish.category === "Cocktails"),
      )
    : [];
  const now = Date.now();
  const activeMaintenanceBlocks = maintenanceBlocks.filter(
    (block) => new Date(block.ends_at).getTime() > now,
  );
  const maintenanceHistoryBlocks = maintenanceBlocks
    .filter((block) => new Date(block.ends_at).getTime() <= now)
    .sort(
      (left, right) =>
        new Date(right.ends_at).getTime() - new Date(left.ends_at).getTime(),
    );
  const pendingArrivals = reservations
    .filter(
      (reservation) =>
        reservation.status === "confirmed" &&
        matchesReservationSearch(reservation, checkinSearch),
    )
    .sort((left, right) =>
      left.arrival.localeCompare(right.arrival) ||
      (left.approved_checkin_time ?? left.estimated_arrival_time ?? "14:00").localeCompare(
        right.approved_checkin_time ?? right.estimated_arrival_time ?? "14:00",
      ),
    );
  const pendingDepartures = reservations
    .filter(
      (reservation) =>
        reservation.status === "in_progress" &&
        matchesReservationSearch(reservation, checkinSearch),
    )
    .sort((left, right) =>
      left.departure.localeCompare(right.departure) ||
      (left.approved_checkout_time ?? "12:00").localeCompare(
        right.approved_checkout_time ?? "12:00",
      ),
    );
  const isHistoryRangeValid =
    Boolean(historyStartDate) &&
    Boolean(historyEndDate) &&
    historyStartDate <= historyEndDate;
  const arrivalHistory = isHistoryRangeValid
    ? reservations
        .filter(
          (reservation) =>
            reservation.arrival >= historyStartDate &&
            reservation.arrival <= historyEndDate &&
            (reservation.status === "in_progress" ||
              reservation.status === "completed"),
        )
        .sort((left, right) => right.arrival.localeCompare(left.arrival))
    : [];
  const departureHistory = isHistoryRangeValid
    ? reservations
        .filter(
          (reservation) =>
            reservation.departure >= historyStartDate &&
            reservation.departure <= historyEndDate &&
            reservation.status === "completed",
        )
        .sort((left, right) => right.departure.localeCompare(left.departure))
    : [];
  const renderHistoryCard = (
    reservation: Reservation,
    type: "arrival" | "departure",
  ) => {
    const date = type === "arrival" ? reservation.arrival : reservation.departure;
    const time =
      type === "arrival"
        ? reservation.approved_checkin_time ?? reservation.estimated_arrival_time ?? "14:00"
        : reservation.approved_checkout_time ?? "12:00";

    return (
      <article className="admin-checkin-card is-completed" key={reservation.id}>
        <div className="admin-checkin-card-heading">
          <div>
            <h4>{reservation.name}</h4>
            <span className="admin-checkin-room">{reservation.room || "Chambre à préciser"}</span>
          </div>
          <span className="admin-checkin-badge is-done">
            {type === "arrival" && reservation.status === "in_progress"
              ? "En cours"
              : "Terminée"}
          </span>
        </div>
        <div className="admin-checkin-meta">
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {type === "arrival" ? "Arrivée" : "Départ"} le {formatDakarDate(date)} à {time.slice(0, 5)}
          </span>
          <span>
            <BedDouble size={15} aria-hidden="true" />
            {reservation.adults ?? reservation.guests} adulte(s), {reservation.children ?? 0} enfant(s)
          </span>
          <a href={`tel:${reservation.phone.replace(/[^\d+]/g, "")}`}>
            <Phone size={15} aria-hidden="true" />
            {reservation.phone}
          </a>
        </div>
      </article>
    );
  };
  const renderCheckinCard = (
    reservation: Reservation,
    type: "arrival" | "departure",
  ) => {
    const arrivalTime =
      reservation.approved_checkin_time ??
      reservation.estimated_arrival_time ??
      "14:00";
    const departureTime = reservation.approved_checkout_time ?? "12:00";
    const date = type === "arrival" ? reservation.arrival : reservation.departure;
    const time = type === "arrival" ? arrivalTime : departureTime;

    return (
      <article className="admin-checkin-card" key={reservation.id}>
        <div className="admin-checkin-card-heading">
          <div>
            <h4>{reservation.name}</h4>
            <span className="admin-checkin-room">{reservation.room || "Chambre à préciser"}</span>
          </div>
        </div>
        <div className="admin-checkin-meta">
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {formatDakarDate(date)} · {time.slice(0, 5)}
          </span>
          <a href={`tel:${reservation.phone.replace(/[^\d+]/g, "")}`}>
            <Phone size={15} aria-hidden="true" />
            {reservation.phone}
          </a>
        </div>
      </article>
    );
  };

  const orderHistory = orders.filter(
    (order) => order.status === "completed" || order.status === "cancelled",
  );
  const orderHistorySearchTerm = orderHistorySearch.trim().toLocaleLowerCase("fr");
  const filteredOrderHistory = orderHistory.filter((order) =>
    [
      order.name,
      order.phone,
      order.id,
      order.id.slice(0, 8),
      ...order.items.map((item) => item.name),
    ].some((value) => value.toLocaleLowerCase("fr").includes(orderHistorySearchTerm)),
  );
  const activeOrders = orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const newContactMessages = contacts.filter((message) => message.status !== "handled");
  const handledContactMessages = contacts.filter((message) => message.status === "handled");
  const searchTerm = orderSearch.trim().toLocaleLowerCase();
  const searchDigits = searchTerm.replace(/\D/g, "");
  const displayedOrders = activeOrders.filter((order) => {
    const matchesStatus = orderStatusFilter === "all" || order.status === orderStatusFilter;
    const reference = order.id.slice(0, 8).toLocaleLowerCase();
    const fullId = order.id.toLocaleLowerCase();
    const phoneDigits = order.phone.replace(/\D/g, "");
    const matchesSearch =
      !searchTerm ||
      reference.includes(searchTerm) ||
      fullId.includes(searchTerm) ||
      order.name.toLocaleLowerCase().includes(searchTerm) ||
      order.phone.toLocaleLowerCase().includes(searchTerm) ||
      order.items.some((item) => item.name.toLocaleLowerCase().includes(searchTerm)) ||
      (searchDigits.length > 0 && phoneDigits.includes(searchDigits));
    return matchesStatus && matchesSearch;
  });
  const currentDebtPage = debtPages.find((page) => page.key === activePage);
  const currentDebts = debtRecords.filter(
    (debt) => debt.direction === currentDebtPage?.direction,
  );
  const unpaidDebts = currentDebts.filter((debt) => debt.status === "unpaid");
  const settledDebts = currentDebts.filter((debt) => debt.status === "settled");
  const todayDateKey = dakarDateKey();
  const overdueDebts = unpaidDebts.filter(
    (debt) => debt.due_date && debt.due_date < todayDateKey,
  );
  const unpaidDebtTotal = unpaidDebts.reduce(
    (total, debt) => total + debt.amount,
    0,
  );
  const visibleNavigation = isSuperAdmin
    ? navigation
    : navigation.filter(({ key }) => key !== "admins");

  return (
    <main
      className={`admin-shell${activePage === "dashboard" ? " admin-shell-dashboard" : ""}${activePage.startsWith("accommodation_") ? " admin-shell-accommodation" : ""}${activePage === "restaurant" || activePage.startsWith("restaurant_") ? " admin-shell-restaurant" : ""}${activePage.startsWith("debt_") ? " admin-shell-debts" : ""}`}
    >
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/">
          <span className="eyebrow">Keur Ana-Fi</span>
          <strong>Administration</strong>
        </Link>
        <nav className="admin-sidebar-nav" aria-label="Administration">
          {visibleNavigation.map(({ key, label, icon: Icon }) => (
            <div className="admin-sidebar-group" key={key}>
              <button
                type="button"
                className={key === "accommodation"
                  ? activePage === key || activePage.startsWith("accommodation_")
                    ? "is-active"
                    : ""
                  : key === "restaurant"
                    ? activePage === key || activePage.startsWith("restaurant_")
                      ? "is-active"
                      : ""
                    : key === "debt_receivable"
                      ? activePage.startsWith("debt_")
                        ? "is-active"
                        : ""
                  : activePage === key
                    ? "is-active"
                    : ""}
                aria-current={
                  key === "accommodation"
                    ? activePage === key || activePage.startsWith("accommodation_")
                      ? "page"
                      : undefined
                    : key === "restaurant"
                      ? activePage === key || activePage.startsWith("restaurant_")
                        ? "page"
                        : undefined
                      : key === "debt_receivable"
                        ? activePage.startsWith("debt_")
                          ? "page"
                          : undefined
                    : activePage === key
                      ? "page"
                      : undefined
                }
                onClick={() => {
                  if (key === "accommodation") {
                    setActivePage("accommodation_rooms");
                    setContentError("");
                    setContentMessage("");
                    return;
                  }
                  if (key === "debt_receivable") {
                    setActivePage("debt_receivable");
                    setDebtError("");
                    setShowDebtForm(false);
                    setShowDebtHistory(false);
                    return;
                  }
                  setShowDebtHistory(false);
                  setActivePage(key);
                  setContentError("");
                  setContentMessage("");
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                {key === "accommodation" && newReservationCount > 0 && (
                  <small>{newReservationCount}</small>
                )}
                {key === "restaurant" && newOrderCount > 0 && <small>{newOrderCount}</small>}
                {key === "contact" && newContactCount > 0 && <small>{newContactCount}</small>}
              </button>
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          {authError && <p className="admin-error" role="alert">{authError}</p>}
          <button
            type="button"
            disabled={isSigningOut || isCheckingAuth}
            onClick={() => void signOutAdmin()}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>{isSigningOut ? "Déconnexion…" : "Déconnexion"}</span>
          </button>
        </div>
      </aside>

      <div className={`admin-main${activePage === "dashboard" ? " admin-main-dashboard" : ""}`}>
        {(inboxError || contentError) && (
          <p className="admin-error" role="alert">{inboxError || contentError}</p>
        )}
        {contentMessage && <p className="admin-success" role="status">{contentMessage}</p>}

        {activePage.startsWith("accommodation_") && (
          <nav className="admin-accommodation-tabs" aria-label="Pages Hébergement">
            {accommodationPages.map((page) => (
              <button
                type="button"
                key={page.key}
                className={activePage === page.key ? "is-active" : ""}
                aria-current={activePage === page.key ? "page" : undefined}
                onClick={() => setActivePage(page.key)}
              >
                {page.label}
              </button>
            ))}
          </nav>
        )}

        {(activePage === "restaurant" || activePage.startsWith("restaurant_")) && (
          <nav className="admin-accommodation-tabs" aria-label="Sous-pages du restaurant">
            <button
              type="button"
              className={activePage === "restaurant" ? "is-active" : ""}
              aria-current={activePage === "restaurant" ? "page" : undefined}
              onClick={() => {
                setActivePage("restaurant");
                setShowDishForm(false);
                setEditingDish(null);
              }}
            >
              Commandes
            </button>
            {restaurantCategoryPages.map((page) => (
              <button
                type="button"
                key={page.key}
                className={activePage === page.key ? "is-active" : ""}
                aria-current={activePage === page.key ? "page" : undefined}
                onClick={() => {
                  setActivePage(page.key);
                  setShowDishForm(false);
                  setEditingDish(null);
                }}
              >
                {page.label}
              </button>
            ))}
            <button
              type="button"
              className={activePage === "restaurant_statistics" ? "is-active" : ""}
              aria-current={activePage === "restaurant_statistics" ? "page" : undefined}
              onClick={() => {
                setActivePage("restaurant_statistics");
                setShowDishForm(false);
                setEditingDish(null);
              }}
            >
              Statistiques
            </button>
          </nav>
        )}

        {activePage.startsWith("debt_") && (
          <nav className="admin-accommodation-tabs" aria-label="Sous-pages des dettes">
            {debtPages.map((page) => (
              <button
                type="button"
                key={page.key}
                className={activePage === page.key ? "is-active" : ""}
                aria-current={activePage === page.key ? "page" : undefined}
                onClick={() => {
                  setActivePage(page.key);
                  setDebtError("");
                  setShowDebtForm(false);
                  setShowDebtHistory(false);
                }}
              >
                {page.label}
              </button>
            ))}
          </nav>
        )}

        {activePage === "dashboard" && (
          <>
            <div className="admin-dashboard-page">
              <section className="admin-dashboard-hero">
                <div className="admin-dashboard-hero-copy">
                  <h2>{dashboardMotivation.greeting}</h2>
                  <p>{dashboardMotivation.message}</p>
                  <div className="admin-dashboard-hero-meta">
                    <span><CalendarDays size={15} />{dashboardDateLabel}</span>
                    <span className="admin-dashboard-pending">
                      <i />
                      {isDashboardDataLoading
                        ? "Chargement des données…"
                        : `${dashboardPendingReservationCount + dashboardNewOrderCount + dashboardNewContactCount} éléments à traiter`}
                    </span>
                  </div>
                </div>
                <div className="admin-dashboard-hero-actions">
                  <button type="button" onClick={() => setActivePage("accommodation_reservations")}>
                    <BedDouble size={17} />
                    Réservations
                    <ArrowUpRight size={16} />
                  </button>
                  <button type="button" onClick={() => setActivePage("restaurant")}>
                    <UtensilsCrossed size={17} />
                    Commandes
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </section>
              <section className="admin-dashboard-period" aria-label="Filtrer le tableau de bord par période">
                <div className="admin-dashboard-period-heading">
                  <CalendarDays size={18} />
                  <div>
                    <strong>Période affichée</strong>
                    <span>Les indicateurs, la fortune et les courbes suivent ces dates.</span>
                  </div>
                </div>
                <div className="admin-dashboard-period-fields">
                  <label>
                    <span>Du</span>
                    <input
                      type="date"
                      value={dashboardStartDate}
                      max={dakarDateKey()}
                      aria-label="Date de début"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) return;
                        setDashboardStartDate(value);
                        if (value > dashboardEndDate) setDashboardEndDate(value);
                      }}
                    />
                  </label>
                  <label>
                    <span>Au</span>
                    <input
                      type="date"
                      value={dashboardEndDate}
                      min={dashboardStartDate}
                      max={dakarDateKey()}
                      aria-label="Date de fin"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!value) return;
                        setDashboardEndDate(value);
                        if (value < dashboardStartDate) setDashboardStartDate(value);
                      }}
                    />
                  </label>
                </div>
              </section>
            <div className="admin-stat-grid">
              <button type="button" className="admin-stat-card admin-stat-card-reservations" onClick={() => setActivePage("accommodation_reservations")}>
                <span className="admin-stat-icon"><BedDouble size={20} /></span>
                <span className="admin-stat-label">Demandes d’hébergement</span>
                <strong>{isLoadingAccommodationStats ? "…" : dashboardReservationCount}</strong>
                <small>
                  {isLoadingAccommodationStats
                    ? "Chargement des demandes…"
                    : `${dashboardPendingReservationCount} en attente de réponse`}
                </small>
              </button>
              <button type="button" className="admin-stat-card admin-stat-card-orders" onClick={() => setActivePage("restaurant")}>
                <span className="admin-stat-icon"><UtensilsCrossed size={20} /></span>
                <span className="admin-stat-label">Commandes reçues</span>
                <strong>{isLoadingInbox ? "…" : dashboardOrders.length}</strong>
                <small>
                  {isLoadingInbox
                    ? "Chargement des commandes…"
                    : `${dashboardNewOrderCount} nouvelle${dashboardNewOrderCount > 1 ? "s" : ""} commande${dashboardNewOrderCount > 1 ? "s" : ""}`}
                </small>
              </button>
              <button type="button" className="admin-stat-card admin-stat-card-contacts" onClick={() => setActivePage("contact")}>
                <span className="admin-stat-icon"><Mail size={20} /></span>
                <span className="admin-stat-label">Messages de contact</span>
                <strong>
                  {isLoadingAccommodationStats || isLoadingInbox ? "…" : dashboardContactCount}
                </strong>
                <small>
                  {isLoadingAccommodationStats || isLoadingInbox
                    ? "Chargement des messages…"
                    : `${dashboardNewContactCount} nouveau${dashboardNewContactCount > 1 ? "x" : ""} message${dashboardNewContactCount > 1 ? "s" : ""}`}
                </small>
              </button>
              <article className="admin-stat-card admin-stat-card-fortune">
                <span className="admin-stat-icon"><TrendingUp size={20} /></span>
                <span className="admin-stat-label">Fortune réalisée</span>
                <strong>
                  {isDashboardDataLoading
                    ? "…"
                    : formatPrice(totalRealizedFortune)}
                </strong>
                <small>Réservations, commandes terminées et dettes réglées</small>
              </article>
              <button
                type="button"
                className="admin-stat-card admin-stat-card-debts"
                onClick={() => setActivePage("debt_receivable")}
              >
                <span className="admin-stat-icon"><Banknote size={20} /></span>
                <span className="admin-stat-label">Dettes et créances</span>
                <strong>{isLoadingDebts ? "…" : formatPrice(totalOutstandingDebts)}</strong>
                <small className="admin-stat-debt-detail">
                  <span>Je dois : {formatCompactAmount(unpaidPayableTotal)}</span>
                  <span>On me doit :{" "}
                  {formatCompactAmount(unpaidReceivableTotal)}
                  </span>
                </small>
              </button>
              <article className="admin-stat-card admin-stat-card-overdue">
                <span className="admin-stat-icon"><CalendarDays size={20} /></span>
                <span className="admin-stat-label">Dettes en retard</span>
                <strong>{isLoadingDebts ? "…" : overdueDebtCount}</strong>
                <small>
                  {isLoadingDebts
                    ? "Chargement des dettes…"
                    : "Échéance dépassée · toutes périodes"}
                </small>
              </article>
            </div>
            {accommodationStatsError && (
              <p className="admin-error" role="alert">{accommodationStatsError}</p>
            )}
            {debtError && <p className="admin-error" role="alert">{debtError}</p>}
            <div className="admin-accommodation-charts admin-dashboard-charts">
              <section className="admin-accommodation-chart">
                <header>
                  <h3>Fortune mensuelle</h3>
                  <span>6 derniers mois · hébergement, restaurant et dettes réglées</span>
                </header>
                <div
                  className="admin-dashboard-revenue-chart"
                  style={{
                    gridTemplateColumns: `repeat(${dashboardMonthlyRevenue.length}, minmax(34px, 1fr))`,
                    minWidth: `${Math.max(dashboardMonthlyRevenue.length * 42, 100)}px`,
                  }}
                >
                  {dashboardMonthlyRevenue.map((month) => (
                    <div className="admin-dashboard-revenue-month" key={month.key}>
                      <strong title={formatPrice(month.amount)}>
                        {formatCompactAmount(month.amount)}
                      </strong>
                      <div
                        className="admin-dashboard-revenue-track"
                        role="img"
                        aria-label={`${month.label} : fortune totale ${formatPrice(month.amount)}`}
                      >
                        <div
                          className="admin-dashboard-revenue-total"
                          style={{
                            height: `${(month.amount / maxDashboardMonthlyRevenue) * 100}%`,
                          }}
                        />
                      </div>
                      <span>{month.label}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="admin-accommodation-chart">
                <header>
                  <h3>Fortune par activité</h3>
                  <span>{formatPrice(totalRealizedFortune)} au total</span>
                </header>
                <div className="admin-dashboard-source-chart">
                  <div className="admin-dashboard-source-row">
                    <span>Hébergement</span>
                    <div className="admin-room-revenue-track">
                      <div
                        className="admin-dashboard-source-bar is-accommodation"
                        style={{
                          width: `${totalRealizedFortune > 0 ? (dashboardCompletedStatsRevenue / totalRealizedFortune) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCompactAmount(dashboardCompletedStatsRevenue)}</strong>
                  </div>
                  <div className="admin-dashboard-source-row">
                    <span>Restaurant</span>
                    <div className="admin-room-revenue-track">
                      <div
                        className="admin-dashboard-source-bar is-restaurant"
                        style={{
                          width: `${totalRealizedFortune > 0 ? (dashboardCompletedOrderRevenue / totalRealizedFortune) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCompactAmount(dashboardCompletedOrderRevenue)}</strong>
                  </div>
                  <div className="admin-dashboard-source-row">
                    <span>Dettes réglées</span>
                    <div className="admin-room-revenue-track">
                      <div
                        className="admin-dashboard-source-bar is-settled-debt"
                        style={{
                          width: `${totalRealizedFortune > 0 ? (dashboardSettledDebtRevenue / totalRealizedFortune) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{formatCompactAmount(dashboardSettledDebtRevenue)}</strong>
                  </div>
                </div>
              </section>
            </div>
            <section className="admin-accommodation-chart admin-dashboard-activity-panel">
              <header>
                <h3>Évolution de l’activité</h3>
                <span>
                  {dashboardPeriodLabel} · statut actuel, par{" "}
                  {isDashboardDailyPeriod ? "jour" : "mois"} d’enregistrement
                </span>
              </header>
              {isLoadingAccommodationStats || isLoadingInbox || isLoadingDebts ? (
                <p role="status">Chargement de l’évolution…</p>
              ) : (
                <div className="admin-dashboard-activity-charts">
                  {dashboardActivityCharts.map((chart) => {
                    const plot = {
                      left: 48,
                      right: 770,
                      top: 38,
                      bottom: 210,
                    };
                    const maximum = Math.max(
                      1,
                      ...chart.series.flatMap((series) => series.values),
                    );
                    const chartMaximum = Math.ceil(maximum / 4) * 4;
                    const hoveredIndex = hoveredDashboardPoint?.chartKey === chart.key
                      ? hoveredDashboardPoint.dayIndex
                      : null;
                    const chartLines = chart.series.map((series) => {
                      const points = series.values.map((value, index) => ({
                        x: plot.left + (index / Math.max(series.values.length - 1, 1)) *
                          (plot.right - plot.left),
                        y: plot.bottom - (value / chartMaximum) *
                          (plot.bottom - plot.top),
                      }));
                      const linePath = smoothChartPath(points);
                      const areaPath = points.length
                        ? `${linePath} L ${points[points.length - 1].x} ${plot.bottom} L ${points[0].x} ${plot.bottom} Z`
                        : "";
                      return { ...series, points, linePath, areaPath };
                    });
                    const hoveredDay = hoveredIndex === null
                      ? null
                      : dashboardActivity[hoveredIndex] ?? null;
                    const hoveredPointX = hoveredIndex === null
                      ? plot.left
                      : chartLines[0]?.points[hoveredIndex]?.x ?? plot.left;
                    const hoveredPointY = hoveredIndex === null
                      ? plot.top
                      : Math.min(
                          ...chartLines.map((series) =>
                            series.points[hoveredIndex]?.y ?? plot.bottom,
                          ),
                        );
                    const tooltipWidth = 220;
                    const tooltipHeight = 72;
                    const tooltipX = Math.min(
                      800 - tooltipWidth - 8,
                      Math.max(8, hoveredPointX - tooltipWidth / 2),
                    );
                    const tooltipY = hoveredPointY > plot.top + tooltipHeight + 8
                      ? hoveredPointY - tooltipHeight - 8
                      : Math.min(260 - tooltipHeight - 8, hoveredPointY + 8);
                    return (
                      <div className="admin-dashboard-activity-card" key={chart.key}>
                        <div className="admin-dashboard-activity-heading">
                          <h4>{chart.title}</h4>
                          <span>
                            {chart.series.map((series) => series.label).join(" / ")}
                          </span>
                        </div>
                        <div className="admin-dashboard-activity-content">
                          <div>
                            <div className="admin-dashboard-activity-chart">
                          <svg
                            viewBox="0 0 800 260"
                            role="img"
                            aria-label={`Évolution ${isDashboardDailyPeriod ? "quotidienne" : "mensuelle"} : ${chart.series.map((series) => series.label).join(" et ")}, du ${dashboardPeriodLabel}`}
                          >
                            <defs>
                              {chartLines.map((series) => (
                                <linearGradient
                                  key={`${chart.key}-${series.key}-gradient`}
                                  id={`${chart.key}-${series.key}-gradient`}
                                  x1="0"
                                  x2="0"
                                  y1="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stopColor={series.color} stopOpacity="0.38" />
                                  <stop offset="95%" stopColor={series.color} stopOpacity="0" />
                                </linearGradient>
                              ))}
                            </defs>
                            {[0, 1, 2, 3, 4].map((step) => {
                              const y = plot.bottom - step *
                                ((plot.bottom - plot.top) / 4);
                              const value = chartMaximum * step / 4;
                              return (
                                <g key={step}>
                                  <line
                                    x1={plot.left}
                                    y1={y}
                                    x2={plot.right}
                                    y2={y}
                                    className="admin-dashboard-chart-gridline"
                                  />
                                  <text x={plot.left - 10} y={y + 4} textAnchor="end">
                                    {chart.currency
                                      ? new Intl.NumberFormat("fr-FR", {
                                          notation: "compact",
                                          maximumFractionDigits: 1,
                                        }).format(value)
                                      : Math.round(value)}
                                  </text>
                                </g>
                              );
                            })}
                            {dashboardActivity.map((day, index) => {
                              const labelInterval = Math.max(
                                1,
                                Math.ceil(dashboardActivity.length / 7),
                              );
                              if (
                                index % labelInterval !== 0 &&
                                index !== dashboardActivity.length - 1
                              ) {
                                return null;
                              }
                              const x = chartLines[0]?.points[index]?.x ?? plot.left;
                              return (
                                <g key={day.key}>
                                  <line
                                    x1={x}
                                    y1={plot.top}
                                    x2={x}
                                    y2={plot.bottom}
                                    className="admin-dashboard-chart-dayline"
                                  />
                                  <text
                                    x={x}
                                    y="241"
                                    textAnchor="middle"
                                    className="admin-dashboard-chart-month"
                                  >
                                    {day.label}
                                  </text>
                                </g>
                              );
                            })}
                            {chartLines.map((series) => (
                              <g key={`${chart.key}-${series.key}`}>
                                {series.areaPath && (
                                  <path
                                    d={series.areaPath}
                                    fill={`url(#${chart.key}-${series.key}-gradient)`}
                                    className="admin-dashboard-activity-area"
                                  />
                                )}
                                {series.linePath && (
                                  <path
                                    d={series.linePath}
                                    fill="none"
                                    stroke={series.color}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    pathLength="1000"
                                    className="admin-dashboard-activity-line"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                )}
                                {series.values.map((_, index) => {
                                  const point = series.points[index];
                                  if (!point) return null;
                                  return (
                                    <circle
                                      key={`${series.key}-${index}`}
                                      cx={point.x}
                                      cy={point.y}
                                      r={hoveredIndex === index ? "6" : "3.5"}
                                      fill={hoveredIndex === index ? series.color : "#23003F"}
                                      stroke={series.color}
                                      strokeWidth="2"
                                    />
                                  );
                                })}
                              </g>
                            ))}
                            {dashboardActivity.map((day, index) => {
                              const x = chartLines[0]?.points[index]?.x ?? plot.left;
                              const step = (plot.right - plot.left) /
                                Math.max(dashboardActivity.length - 1, 1);
                              const hitWidth = Math.max(12, step);
                              return (
                                <rect
                                  key={`hit-${day.key}`}
                                  x={Math.max(plot.left, x - hitWidth / 2)}
                                  y={plot.top}
                                  width={Math.min(hitWidth, plot.right - Math.max(plot.left, x - hitWidth / 2))}
                                  height={plot.bottom - plot.top}
                                  fill="transparent"
                                  onMouseEnter={() => setHoveredDashboardPoint({
                                    chartKey: chart.key,
                                    dayIndex: index,
                                  })}
                                  onMouseLeave={() => setHoveredDashboardPoint(null)}
                                  onFocus={() => setHoveredDashboardPoint({
                                    chartKey: chart.key,
                                    dayIndex: index,
                                  })}
                                  onBlur={() => setHoveredDashboardPoint(null)}
                                  tabIndex={0}
                                  aria-label={`${day.key}, ${chart.series.map((series) => `${series.label} ${chart.currency ? formatPrice(series.values[index] ?? 0) : series.values[index]}`).join(", ")}`}
                                />
                              );
                            })}
                          {hoveredDay && hoveredIndex !== null && (
                            <g
                              key={`tooltip-${chart.key}-${hoveredIndex}`}
                              className="admin-dashboard-chart-tooltip"
                              transform={`translate(${tooltipX} ${tooltipY})`}
                              pointerEvents="none"
                              aria-hidden="true"
                            >
                              <rect
                                width={tooltipWidth}
                                height={tooltipHeight}
                                rx="8"
                              />
                              <text className="admin-dashboard-chart-tooltip-date" x="12" y="19">
                                {hoveredDay.label}
                              </text>
                              {chart.series.map((series, index) => (
                                <g key={series.key}>
                                  <circle
                                    cx="16"
                                    cy={41 + index * 17}
                                    r="3.5"
                                    fill={series.color}
                                  />
                                  <text
                                    className="admin-dashboard-chart-tooltip-value"
                                    x="26"
                                    y={45 + index * 17}
                                  >
                                    {series.label} : {chart.currency
                                      ? formatPrice(series.values[hoveredIndex] ?? 0)
                                      : `${series.values[hoveredIndex] ?? 0} ${chart.unit}`}
                                  </text>
                                </g>
                              ))}
                            </g>
                          )}
                          </svg>
                            </div>
                            <div className="admin-dashboard-chart-legend">
                              {chart.series.map((series) => (
                                <span key={series.key}>
                                  <i style={{ backgroundColor: series.color }} />
                                  {series.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <aside className="admin-dashboard-recent">
                            <h5>5 dernières entrées</h5>
                            {chart.key === "orders" && (
                              recentDashboardOrders.length ? (
                                <ul>
                                  {recentDashboardOrders.map((order) => (
                                    <li key={order.id}>
                                      <strong>{order.name} · {formatPrice(order.total)}</strong>
                                      <span>
                                        {formatDate(order.created_at)} · {orderStatusLabels[order.status]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p>Aucune commande récente.</p>
                            )}
                            {chart.key === "reservations" && (
                              recentDashboardReservations.length ? (
                                <ul>
                                  {recentDashboardReservations.map((reservation) => (
                                    <li key={`${reservation.created_at}-${reservation.name}-${reservation.room}`}>
                                      <strong>{reservation.name} · {reservation.room || "Chambre non précisée"}</strong>
                                      <span>
                                        {formatDate(reservation.created_at)} · {reservationStatusLabels[reservation.status]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p>Aucune réservation récente.</p>
                            )}
                            {chart.key === "debts" && (
                              recentDashboardDebts.length ? (
                                <ul>
                                  {recentDashboardDebts.map((debt) => (
                                    <li key={debt.id}>
                                      <strong>
                                        {debt.person_name} · {formatPrice(debt.amount)}
                                      </strong>
                                      <span>
                                        {formatDate(debt.created_at)} ·{" "}
                                        {debt.direction === "receivable" ? "On me doit" : "Je dois"}
                                        {" · "}{debt.status === "settled" ? "Réglée" : "Non réglée"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p>Aucune dette récente.</p>
                            )}
                            {chart.key === "contacts" && (
                              recentDashboardContacts.length ? (
                                <ul>
                                  {recentDashboardContacts.map((message) => (
                                    <li key={message.id}>
                                      <strong>{message.full_name}</strong>
                                      <span>
                                        {formatDate(message.created_at)} ·{" "}
                                        {message.status === "handled"
                                          ? "Répondu"
                                          : message.status === "in_progress"
                                            ? "En cours"
                                            : "Nouveau"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <p>Aucun message récent.</p>
                            )}
                          </aside>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <p className="admin-accommodation-stats-note">
              La fortune additionne les commandes et réservations terminées ainsi que les dettes réglées.
              Elle correspond aux montants enregistrés, pas à une preuve d’encaissement.
            </p>
            </div>
          </>
        )}

        {currentDebtPage && (
          <>
            <AdminSection
              title={currentDebtPage.label}
              description={
                currentDebtPage.direction === "receivable"
                  ? "Suivez les sommes que des personnes vous doivent."
                  : "Suivez les sommes que vous devez à des personnes ou fournisseurs."
              }
              action={
                <div className="admin-row-actions">
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => setShowDebtHistory(true)}
                  >
                    <History size={16} aria-hidden="true" />
                    Historique ({settledDebts.length})
                  </button>
                  <button
                    className="button button-gold"
                    type="button"
                    onClick={() => {
                      setDebtError("");
                      setShowDebtForm(true);
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Ajouter
                  </button>
                </div>
              }
            >
              {debtError && <p className="admin-error" role="alert">{debtError}</p>}
              <div className="admin-debt-overview" aria-label="Résumé des dettes">
                <article>
                  <span>
                    {currentDebtPage.direction === "receivable"
                      ? "Montant à recevoir"
                      : "Montant à payer"}
                  </span>
                  <strong>{formatPrice(unpaidDebtTotal)}</strong>
                </article>
                <article>
                  <span>Dettes non réglées</span>
                  <strong>{unpaidDebts.length}</strong>
                </article>
                <article className={overdueDebts.length ? "is-overdue" : ""}>
                  <span>Échéances dépassées</span>
                  <strong>{overdueDebts.length}</strong>
                </article>
              </div>
              {showDebtForm && (
                <form
                  className="admin-entry-form admin-debt-form"
                  onSubmit={(event) => void saveDebt(event)}
                >
                  <label>
                    {currentDebtPage.direction === "receivable"
                      ? "Nom de la personne qui me doit"
                      : "Nom du créancier ou fournisseur"}
                    <input
                      name="person_name"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Montant (FCFA)
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      step="1"
                      required
                    />
                  </label>
                  <label>
                    Date d’échéance (facultative)
                    <input name="due_date" type="date" />
                  </label>
                  <label>
                    Détail (facultatif)
                    <textarea
                      name="description"
                      rows={3}
                      maxLength={1000}
                    />
                  </label>
                  <div className="admin-form-actions">
                    <button className="button button-gold" type="submit" disabled={isSavingDebt}>
                      {isSavingDebt ? "Enregistrement…" : "Ajouter la dette"}
                    </button>
                    <button
                      className="button button-outline"
                      type="button"
                      onClick={() => {
                        setShowDebtForm(false);
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
              {isLoadingDebts ? (
                <p role="status">Chargement des dettes…</p>
              ) : unpaidDebts.length ? (
                <div className="admin-inbox admin-debt-list">
                  {unpaidDebts.map((debt) => (
                    <article
                      className={`admin-inbox-item admin-debt-item${debt.due_date && debt.due_date < todayDateKey ? " is-overdue" : ""}`}
                      key={debt.id}
                    >
                      <div className="admin-debt-card-heading">
                        <div className="admin-debt-person">
                          <h3>{debt.person_name}</h3>
                          <span className={`admin-debt-status${debt.due_date && debt.due_date < todayDateKey ? " is-overdue" : ""}`}>
                            {debt.due_date && debt.due_date < todayDateKey
                              ? "En retard"
                              : "À régler"}
                          </span>
                        </div>
                        <strong className="admin-debt-amount">
                          {formatPrice(debt.amount)}
                        </strong>
                      </div>
                      <div className="admin-debt-meta">
                        <span>
                          Créée le {formatDakarTimestampDate(debt.created_at)}
                        </span>
                        <span>
                          Échéance : {debt.due_date
                            ? formatDakarDate(debt.due_date)
                            : "Non renseignée"}
                        </span>
                      </div>
                      {debt.description && (
                        <p className="admin-inbox-message">{debt.description}</p>
                      )}
                      <div className="admin-row-actions admin-debt-actions">
                        <button
                          className="admin-debt-settle-button"
                          type="button"
                          disabled={savingDebtIds.has(debt.id)}
                          onClick={() => void updateDebtStatus(debt)}
                        >
                          <Check size={15} aria-hidden="true" />
                          Régler
                        </button>
                        <button
                          className="admin-delete-button"
                          type="button"
                          aria-label={`Supprimer la dette de ${debt.person_name}`}
                          disabled={savingDebtIds.has(debt.id)}
                          onClick={() => void deleteDebt(debt)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>Aucune dette non réglée pour le moment.</EmptyState>
              )}
            </AdminSection>

            {showDebtHistory && (
              <div
                className="admin-checkin-history-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setShowDebtHistory(false);
                }}
              >
                <section
                  className="admin-checkin-history-dialog admin-debt-history-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="admin-debt-history-title"
                >
                  <header>
                    <div>
                      <span className="eyebrow">Dettes réglées</span>
                      <h3 id="admin-debt-history-title">Historique · {currentDebtPage.label}</h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Fermer l’historique"
                      onClick={() => setShowDebtHistory(false)}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </header>
                  {settledDebts.length ? (
                    <div className="admin-inbox admin-debt-list">
                      {settledDebts.map((debt) => (
                        <article className="admin-inbox-item admin-debt-item" key={debt.id}>
                          <div className="admin-debt-card-heading">
                            <div className="admin-debt-person">
                              <h3>{debt.person_name}</h3>
                              <span className="admin-debt-status is-settled">Réglée</span>
                            </div>
                            <strong className="admin-debt-amount">
                              {formatPrice(debt.amount)}
                            </strong>
                          </div>
                          <div className="admin-debt-meta">
                            <span>Créée le {formatDakarTimestampDate(debt.created_at)}</span>
                            <span>
                              Échéance : {debt.due_date
                                ? formatDakarDate(debt.due_date)
                                : "Non renseignée"}
                            </span>
                            <span>
                              Réglée le {debt.settled_at
                                ? formatDakarTimestampDate(debt.settled_at)
                                : "Non renseignée"}
                            </span>
                          </div>
                          {debt.description && (
                            <p className="admin-inbox-message">{debt.description}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>Aucune dette réglée dans cet historique.</EmptyState>
                  )}
                </section>
              </div>
            )}
          </>
        )}

        {activePage === "accommodation_rooms" && (
          <AdminSection
            hideHeading
            title="Gestion des chambres"
            description="Créez et gérez les fiches chambres affichées sur le site. Une nouvelle chambre est publiée automatiquement."
            action={
              <button
                className="button button-gold"
                type="button"
                onClick={() => {
                  setEditingRoom(null);
                  setRoomImages([]);
                  setSelectedRoomPhotos([]);
                  setSelectedRoomAmenities([]);
                  setRoomAmenitySearch("");
                  setRoomError("");
                  setShowRoomForm(true);
                }}
              >
                <Plus size={16} /> Ajouter une chambre
              </button>
            }
          >
            {roomError && <p className="admin-error" role="alert">{roomError}</p>}
            {showRoomForm && (
              <section className="admin-room-form-panel" ref={roomFormPanelRef}>
                <header>
                  <h3>
                    {editingRoom ? "Modifier la chambre" : "Ajouter une chambre"}
                  </h3>
                </header>
                  {roomError && <p className="admin-error" role="alert">{roomError}</p>}
                  <form className="admin-entry-form" onSubmit={(event) => void saveRoom(event)}>
                <label>
                  Nom ou numéro de chambre
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={editingRoom?.name ?? ""}
                  />
                </label>
                <label>
                  Capacité maximale (personnes)
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    defaultValue={editingRoom?.capacity ?? 1}
                  />
                </label>
                <label>
                  Nombre maximum d’enfants
                  <input
                    name="max_children"
                    type="number"
                    min="0"
                    max={editingRoom?.capacity ?? 100}
                    step="1"
                    required
                    defaultValue={editingRoom?.maxChildren ?? 0}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    rows={4}
                    required
                    defaultValue={editingRoom?.description ?? ""}
                  />
                </label>
                <fieldset className="admin-amenity-fieldset admin-room-amenity-picker">
                  <legend>Équipements de la chambre</legend>
                  {roomAmenityOptions.length ? (
                    <>
                      <p className="admin-room-amenity-hint">
                        {selectedRoomAmenities.length
                          ? `${selectedRoomAmenities.length} équipement${selectedRoomAmenities.length > 1 ? "s" : ""} sélectionné${selectedRoomAmenities.length > 1 ? "s" : ""}`
                          : "Choisissez les équipements à afficher pour cette chambre."}
                      </p>
                      {selectedRoomAmenities.length > 0 && (
                        <div className="admin-room-amenity-selected" aria-label="Équipements sélectionnés">
                          {selectedRoomAmenities.map((amenity) => (
                            <span className="admin-room-amenity-chip" key={amenity}>
                              {amenity}
                              <button
                                type="button"
                                aria-label={`Retirer ${amenity}`}
                                onClick={() =>
                                  setSelectedRoomAmenities((current) =>
                                    current.filter((value) => value !== amenity),
                                  )
                                }
                              >
                                <X size={13} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <details className="admin-room-amenity-options">
                        <summary>
                          <span>
                            <Plus size={15} aria-hidden="true" />
                            Ajouter ou modifier la sélection
                          </span>
                          <small>{roomAmenityOptions.length} disponibles</small>
                        </summary>
                        <label className="admin-room-amenity-search">
                          <Search size={16} aria-hidden="true" />
                          <input
                            type="search"
                            value={roomAmenitySearch}
                            onChange={(event) => setRoomAmenitySearch(event.target.value)}
                            placeholder="Rechercher un équipement"
                            aria-label="Rechercher un équipement"
                          />
                        </label>
                        <div className="admin-room-amenity-options-list">
                          {filteredRoomAmenityOptions.map((amenity) => {
                            const isSelected = selectedRoomAmenities.includes(amenity);
                            return (
                              <label className="admin-room-amenity-option" key={amenity}>
                                <input
                                  type="checkbox"
                                  name="amenities"
                                  value={amenity}
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelectedRoomAmenities((current) =>
                                      isSelected
                                        ? current.filter((value) => value !== amenity)
                                        : [...current, amenity],
                                    )
                                  }
                                />
                                <span>{amenity}</span>
                                {isSelected && <Check size={15} aria-hidden="true" />}
                              </label>
                            );
                          })}
                          {filteredRoomAmenityOptions.length === 0 && (
                            <p className="admin-room-amenity-no-results">
                              Aucun équipement ne correspond à la recherche.
                            </p>
                          )}
                        </div>
                      </details>
                    </>
                  ) : (
                    <p className="admin-help">
                      Ajoutez d’abord des équipements dans l’onglet « Équipements ».
                    </p>
                  )}
                </fieldset>
                <label>
                  Prix par nuit (FCFA)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={editingRoom?.price ?? ""}
                  />
                </label>
                <div className="admin-form-row">
                  <label>
                    Nombre de lits
                    <input
                      name="bed_quantity"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      required
                      defaultValue={editingRoom?.beds[0]?.quantity ?? 1}
                    />
                  </label>
                  <label>
                    Type de lit
                    <select name="bed_type" defaultValue={editingRoom?.beds[0]?.type ?? "Lit double"}>
                      {["Lit simple", "Lit double", "Lits jumeaux", "Lits superposés", "Lit queen size", "Lit king size"].map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Texte alternatif des photos
                  <input
                    name="image_alt"
                    required
                    defaultValue={editingRoom?.imageAlt ?? ""}
                    placeholder="Description des photos pour l’accessibilité"
                  />
                </label>
                <label className="admin-photo-input">
                  Ajouter des photos (vous pouvez en sélectionner plusieurs à la fois; JPG, PNG, WEBP ou GIF, 10 Mo maximum chacune)
                  <input
                    name="photos"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={(event) =>
                      setSelectedRoomPhotos(Array.from(event.currentTarget.files ?? []))
                    }
                  />
                </label>
                {selectedRoomPhotos.length > 0 && (
                  <p className="admin-help" role="status">
                    {selectedRoomPhotos.length} nouvelle(s) photo(s) seront ajoutées à cette chambre.
                  </p>
                )}
                {roomImages.length > 0 && (
                  <div className="admin-room-photo-list">
                    {roomImages.map((url, index) => (
                      <div key={`${url}-${index}`}>
                        <img src={url} alt={`Photo actuelle ${index + 1}`} />
                        <button
                          type="button"
                          aria-label={`Retirer la photo ${index + 1}`}
                          onClick={() =>
                            setRoomImages((current) =>
                              current.filter((_, photoIndex) => photoIndex !== index),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="admin-form-actions">
                  <button className="button button-gold" type="submit" disabled={isSavingRoom}>
                    {isSavingRoom ? "Enregistrement…" : editingRoom ? "Enregistrer les modifications" : "Créer la chambre"}
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={isSavingRoom}
                    onClick={closeRoomForm}
                  >
                    Annuler
                  </button>
                </div>
                  </form>
              </section>
            )}
            {content.accommodations.length > 0 ? (
              <div className="admin-room-grid">
                {content.accommodations.map((room) => {
                  const roomPhotos =
                    room.images.length > 0
                      ? room.images
                      : room.image
                        ? [room.image]
                        : [];
                  return (
                    <article className="admin-room-card" key={room.id}>
                      <AdminRoomPhotoCarousel
                        roomName={room.name}
                        photos={roomPhotos}
                      />
                      <div className="admin-room-card-body">
                        <div className="admin-room-title">
                          <h3>{room.name}</h3>
                          <span className={room.published ? "admin-published" : "admin-draft"}>
                            {room.published ? <><Check size={14} /> Publiée</> : "Non publiée"}
                          </span>
                        </div>
                        {room.provisional && (
                          <span className="admin-room-provisional">Informations à confirmer</span>
                        )}
                        <p className="admin-room-description">{room.description}</p>
                        <div className="admin-room-facts">
                          <div>
                            <span>Tarif par nuit</span>
                            <strong>
                              {room.price === undefined
                                ? "Non défini"
                                : formatPrice(room.price)}
                            </strong>
                          </div>
                          <div>
                            <span>Capacité maximale</span>
                            <strong>
                              {room.capacity === undefined
                                ? "Non définie"
                                : `${room.capacity} personne(s)`}
                            </strong>
                          </div>
                          <div>
                            <span>Couchages</span>
                            <strong>
                              {room.beds.length
                                ? room.beds.map((bed) => `${bed.quantity} × ${bed.type}`).join(", ")
                                : "Non définis"}
                            </strong>
                          </div>
                        </div>
                        {room.amenities.length > 0 && (
                          <div className="admin-room-amenities">
                            <span className="admin-room-amenities-label">Équipements</span>
                            <div>
                              {room.amenities.map((amenity) => (
                                <span key={amenity}>{amenity}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="admin-inline-actions">
                          <button
                            type="button"
                            disabled={updatingRoomPublicationIds.has(room.id)}
                            onClick={() => {
                              setEditingRoom(room);
                              setRoomImages(room.images);
                              setSelectedRoomPhotos([]);
                              setSelectedRoomAmenities(room.amenities);
                              setRoomAmenitySearch("");
                              setRoomError("");
                              setShowRoomForm(true);
                            }}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Modifier
                          </button>
                          <button
                            className="admin-room-publication-button"
                            type="button"
                            disabled={updatingRoomPublicationIds.has(room.id)}
                            onClick={() => void toggleRoomPublication(room)}
                          >
                            {updatingRoomPublicationIds.has(room.id)
                              ? "Mise à jour…"
                              : room.published
                                ? <><EyeOff size={14} aria-hidden="true" /> Dépublier</>
                                : <><Eye size={14} aria-hidden="true" /> Publier</>}
                          </button>
                          <button
                            type="button"
                            disabled={updatingRoomPublicationIds.has(room.id)}
                            onClick={() => void deleteRoom(room)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState>Aucune chambre créée. Ajoutez la première fiche chambre.</EmptyState>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_amenities" && (
          <AdminSection
            hideHeading
            title="Gestion des équipements"
            description="Gérez les équipements disponibles, puis sélectionnez-les dans la fiche de chaque chambre."
          >
            <form className="admin-amenity-form" onSubmit={(event) => void addAmenity(event)}>
              <label htmlFor="new-amenity">Nouvel équipement</label>
              <div>
                <input
                  id="new-amenity"
                  value={newAmenity}
                  onChange={(event) => setNewAmenity(event.target.value)}
                  maxLength={80}
                  required
                  placeholder="Ex. espace de travail"
                />
                <button className="button button-gold" type="submit" disabled={isSavingAmenity}>
                  <Plus size={16} /> {isSavingAmenity ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            </form>
            {amenityError && <p className="admin-error" role="alert">{amenityError}</p>}
            <p className="admin-amenity-count">
              {content.amenityOptions.length} équipement(s) disponibles
            </p>
            <div className="admin-amenity-list">
              {content.amenityOptions.map((amenity) => (
                <div className="admin-amenity-item" key={amenity}>
                  <span>{amenity}</span>
                  <button
                    type="button"
                    aria-label={`Supprimer ${amenity}`}
                    title="Supprimer cet équipement"
                    disabled={isSavingAmenity}
                    onClick={() => void deleteAmenity(amenity)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </AdminSection>
        )}

        {activePage === "accommodation_payments" && (
          <AdminSection
            hideHeading
            title="Gestion des paiements"
            description="Ajoutez les numéros Wave, Orange Money ou Free Money qui seront présentés aux clients lors d’une réservation."
          >
            <form
              className="admin-entry-form admin-payment-form"
              onSubmit={(event) => void savePaymentAccount(event)}
            >
              <label>
                Opérateur
                <select
                  value={paymentOperator}
                  onChange={(event) =>
                    setPaymentOperator(event.target.value as PaymentOperator)
                  }
                  disabled={isSavingPaymentAccounts}
                >
                  {Object.entries(paymentOperatorLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Numéro de paiement
                <input
                  type="tel"
                  autoComplete="tel"
                  value={paymentNumber}
                  onChange={(event) => setPaymentNumber(event.target.value)}
                  maxLength={30}
                  required
                  placeholder="Ex. 77 000 00 00"
                  disabled={isSavingPaymentAccounts}
                />
              </label>
              <div className="admin-form-actions">
                <button
                  className="button button-gold"
                  type="submit"
                  disabled={isSavingPaymentAccounts}
                >
                  <Plus size={16} />
                  {isSavingPaymentAccounts
                    ? "Enregistrement…"
                    : editingPaymentAccount
                      ? "Enregistrer les modifications"
                      : "Ajouter le numéro"}
                </button>
                {editingPaymentAccount && (
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={isSavingPaymentAccounts}
                    onClick={() => {
                      setEditingPaymentAccount(null);
                      setPaymentNumber("");
                      setPaymentOperator("wave");
                      setPaymentError("");
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
            {paymentError && <p className="admin-error" role="alert">{paymentError}</p>}
            {content.site.paymentAccounts.length ? (
              <div className="admin-payment-list">
                {content.site.paymentAccounts.map((account) => (
                  <article className="admin-payment-item" key={account.id}>
                    <div>
                      <strong>{paymentOperatorLabels[account.operator]}</strong>
                      <span>{account.number}</span>
                    </div>
                    <div className="admin-row-actions">
                      <button
                        className="admin-payment-edit"
                        type="button"
                        aria-label={`Modifier le numéro ${account.number}`}
                        disabled={isSavingPaymentAccounts}
                        onClick={() => {
                          setEditingPaymentAccount(account);
                          setPaymentOperator(account.operator);
                          setPaymentNumber(account.number);
                          setPaymentError("");
                        }}
                      >
                        <Pencil size={15} /> Modifier
                      </button>
                      <button
                        className="admin-delete-button"
                        type="button"
                        aria-label={`Supprimer le numéro ${account.number}`}
                        disabled={isSavingPaymentAccounts}
                        onClick={() => void deletePaymentAccount(account)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState>Aucun numéro de paiement configuré.</EmptyState>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_calendar" && (
          <section className="admin-panel">
            <AdminAccommodationCalendar
              rooms={content.accommodations}
              reservations={reservations}
              blocks={maintenanceBlocks}
              isLoading={isLoadingInbox}
              syncError={calendarSyncError || maintenanceError || inboxError}
              onStatusChange={(id, status) =>
                updateStatus("reservation_requests", id, status)
              }
              onDeleteBlock={deleteMaintenanceBlock}
            />
          </section>
        )}

        {activePage === "accommodation_reservations" && (
          <AdminSection
            hideHeading
            title="Demandes de réservation"
            description="Consultez les demandes, vérifiez les informations et le reçu de paiement, puis mettez à jour leur suivi."
            action={
              <button
                className="button button-outline"
                type="button"
                onClick={() => void openCompletedReservationHistory()}
              >
                <History size={16} aria-hidden="true" />
                Historique
              </button>
            }
          >
            <div className="admin-reservation-summary">
              <span><strong>{reservations.length}</strong> demande(s)</span>
              <span><strong>{newReservationCount}</strong> en attente</span>
              <span>
                <strong>
                  {reservations.filter((item) => item.status === "confirmed").length}
                </strong>{" "}
                confirmée(s)
              </span>
              <span>
                <strong>
                  {reservations.filter((item) => item.status === "in_progress").length}
                </strong>{" "}
                en cours
              </span>
              <span>
                <strong>
                  {reservations.filter((item) => item.status === "completed").length}
                </strong>{" "}
                terminée(s)
              </span>
              <span>
                <strong>
                  {reservations.filter((item) => item.status === "cancelled").length}
                </strong>{" "}
                annulée(s)
              </span>
            </div>
            <div className="admin-reservation-filters">
              <label className="admin-reservation-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={reservationSearch}
                  onChange={(event) => setReservationSearch(event.target.value)}
                  placeholder="Rechercher par référence, nom, téléphone, chambre…"
                  aria-label="Rechercher une réservation par référence ou coordonnées"
                />
              </label>
              <label>
                Filtrer par statut
                <select
                  value={reservationStatusFilter}
                  onChange={(event) =>
                    setReservationStatusFilter(
                      event.target.value as "all" | ReservationStatus,
                    )
                  }
                >
                  <option value="all">Tous les statuts</option>
                  {Object.entries(reservationStatusLabels)
                    .filter(([value]) => value !== "completed" && value !== "cancelled")
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </label>
            </div>
            {isLoadingInbox ? (
              <p role="status">Chargement des demandes…</p>
            ) : filteredReservations.length ? (
              <div className="admin-inbox">
                {filteredReservations.map((reservation) => (
                  <article className="admin-inbox-item admin-reservation-item" key={reservation.id}>
                    <div className="admin-inbox-heading">
                      <div>
                        <h3>{reservation.name}</h3>
                        <p>
                          Reçue le {formatDate(reservation.created_at)} ·{" "}
                          <a href={`tel:${reservation.phone}`}>{reservation.phone}</a>
                        </p>
                        <p>Référence : {getReservationReference(reservation.id)}</p>
                      </div>
                      <div
                        className="admin-reservation-status-actions"
                        role="group"
                        aria-label={`Statut de la demande de ${reservation.name}`}
                      >
                        {reservationStatusSequence.map((status) => {
                          const currentOrder = reservationStatusOrder[reservation.status];
                          const statusOrder = reservationStatusOrder[status];
                          const isPassed =
                            (currentOrder !== undefined &&
                              statusOrder !== undefined &&
                              statusOrder < currentOrder) ||
                            ((reservation.status === "rejected" ||
                              reservation.status === "cancelled") &&
                              status === "pending");
                          const isCurrent = status === reservation.status;
                          const isAvailable =
                            isCurrent ||
                            reservationStatusActions[reservation.status].includes(status);

                          return (
                            <button
                              className={`admin-reservation-status-button${isCurrent ? " is-current" : ""}${isPassed ? " is-passed" : ""}`}
                              type="button"
                              key={status}
                              aria-pressed={isCurrent}
                              aria-disabled={!isAvailable || isPassed}
                              disabled={
                                isCurrent ||
                                !isAvailable ||
                                isPassed ||
                                savingReservationStatuses.has(reservation.id)
                              }
                              onClick={() =>
                                void updateStatus("reservation_requests", reservation.id, status)
                              }
                            >
                              {reservationStatusLabels[status]}
                            </button>
                          );
                        })}
                        {reservation.status === "rejected" && (
                          <span className="admin-reservation-legacy-status">
                            Refusée
                          </span>
                        )}
                      </div>
                    </div>
                    <dl className="admin-reservation-details">
                      <div>
                        <dt>Chambre</dt>
                        <dd>{reservation.room || "À préciser"}</dd>
                      </div>
                      <div>
                        <dt>Séjour</dt>
                        <dd>{reservation.arrival} → {reservation.departure}</dd>
                      </div>
                      <div>
                        <dt>Voyageurs</dt>
                        <dd>
                          {reservation.adults ?? reservation.guests} adulte(s),{" "}
                          {reservation.children ?? 0} enfant(s)
                        </dd>
                      </div>
                      <div>
                        <dt>Arrivée estimée</dt>
                        <dd>
                          {reservation.approved_checkin_time
                            ? `${reservation.approved_checkin_time.slice(0, 5)} (autorisée)`
                            : "14:00 (normale)"}
                        </dd>
                      </div>
                      <div>
                        <dt>Départ</dt>
                        <dd>
                          {reservation.approved_checkout_time
                            ? `${reservation.approved_checkout_time.slice(0, 5)} (autorisé)`
                            : "12:00 (normal)"}
                        </dd>
                      </div>
                      <div>
                        <dt>Prix par nuit</dt>
                        <dd>
                          {reservation.price_per_night_snapshot == null
                            ? "Non enregistré"
                            : formatPrice(reservation.price_per_night_snapshot)}
                        </dd>
                      </div>
                      <div>
                        <dt>Total estimé</dt>
                        <dd>
                          {reservation.total_amount_snapshot == null
                            ? "Non enregistré"
                            : formatPrice(reservation.total_amount_snapshot)}
                        </dd>
                      </div>
                    </dl>
                    {reservation.message && (
                      <p className="admin-inbox-message">
                        <strong>Demandes particulières :</strong> {reservation.message}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState>
                Aucune demande active ne correspond aux filtres sélectionnés. Les séjours terminés sont disponibles dans l’historique.
              </EmptyState>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_reservations" &&
          showCompletedReservationHistory && (
            <div
              className="admin-checkin-history-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowCompletedReservationHistory(false);
                }
              }}
            >
              <section
                className="admin-checkin-history-dialog admin-completed-reservation-history"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-completed-reservation-history-title"
              >
                <header>
                  <div>
                    <span className="eyebrow">Séjours terminés ou annulés</span>
                    <h3 id="admin-completed-reservation-history-title">
                      Historique des réservations
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Fermer l’historique des réservations"
                    onClick={() => setShowCompletedReservationHistory(false)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </header>
                <label className="admin-reservation-search admin-history-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={reservationHistorySearch}
                    onChange={(event) => setReservationHistorySearch(event.target.value)}
                    placeholder="Rechercher par référence, nom, téléphone…"
                    aria-label="Rechercher dans l’historique des réservations"
                  />
                </label>
                {completedReservationHistoryError && (
                  <p className="admin-error" role="alert">
                    {completedReservationHistoryError}
                  </p>
                )}
                {isLoadingCompletedReservationHistory ? (
                  <p role="status">Chargement de l’historique…</p>
                ) : filteredCompletedReservationHistory.length ? (
                  <div className="admin-inbox admin-completed-reservation-list">
                    {filteredCompletedReservationHistory.map((reservation) => (
                      <article
                        className="admin-inbox-item admin-completed-reservation-item"
                        key={reservation.id}
                      >
                        <div className="admin-inbox-heading">
                          <div>
                            <h3>{reservation.name}</h3>
                            <p>
                              {reservation.room || "Chambre non précisée"} ·{" "}
                              {reservation.arrival} → {reservation.departure}
                            </p>
                            <p>Référence : {getReservationReference(reservation.id)}</p>
                          </div>
                          <span
                            className={`admin-completed-reservation-status is-${reservation.status}`}
                          >
                            {reservationStatusLabels[reservation.status]}
                          </span>
                        </div>
                        <small>
                          Demande reçue le {formatDate(reservation.created_at)}
                          {reservation.phone ? ` · ${reservation.phone}` : ""}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  !completedReservationHistoryError && (
                    <EmptyState>
                      {reservationHistorySearch.trim()
                        ? "Aucune réservation ne correspond à cette recherche."
                        : "Aucune réservation terminée ou annulée dans l’historique."}
                    </EmptyState>
                  )
                )}
              </section>
            </div>
          )}

        {activePage === "accommodation_checkin" && (
          <AdminSection
            hideHeading
            title="Arrivées et départs"
            description="Suivez les clients attendus, les chambres à libérer et les séjours terminés."
          >
            {inboxError && <p className="admin-error" role="alert">{inboxError}</p>}

            {isLoadingInbox ? (
              <p role="status">Chargement…</p>
            ) : (
              <>
                <label className="admin-reservation-search admin-checkin-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={checkinSearch}
                    onChange={(event) => setCheckinSearch(event.target.value)}
                    placeholder="Rechercher un client, une chambre ou une référence"
                    aria-label="Rechercher dans les arrivées et les départs"
                  />
                </label>
                <div className="admin-checkin-board admin-checkin-board-columns">
                  <section className="admin-checkin-section">
                    <header>
                      <div>
                        <h3>Arrivées</h3>
                      </div>
                      <span>{pendingArrivals.length}</span>
                    </header>
                    {pendingArrivals.length ? (
                      <div className="admin-checkin-list">
                        {pendingArrivals.map((reservation) =>
                          renderCheckinCard(reservation, "arrival"),
                        )}
                      </div>
                    ) : (
                      <EmptyState>Aucune arrivée à accueillir.</EmptyState>
                    )}
                  </section>

                  <section className="admin-checkin-section">
                    <header>
                      <div>
                        <h3>Départs</h3>
                      </div>
                      <span>{pendingDepartures.length}</span>
                    </header>
                    {pendingDepartures.length ? (
                      <div className="admin-checkin-list">
                        {pendingDepartures.map((reservation) =>
                          renderCheckinCard(reservation, "departure"),
                        )}
                      </div>
                    ) : (
                      <EmptyState>Aucun départ à enregistrer.</EmptyState>
                    )}
                  </section>
                </div>
              </>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_checkin" && showCheckinHistory && (
          <div
            className="admin-checkin-history-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowCheckinHistory(false);
              }
            }}
          >
            <section
              className="admin-checkin-history-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-checkin-history-title"
            >
              <header>
                <div>
                  <span className="eyebrow">Séjours réalisés</span>
                  <h3 id="admin-checkin-history-title">Historique des arrivées et départs</h3>
                </div>
                <button
                  type="button"
                  aria-label="Fermer l’historique"
                  onClick={() => setShowCheckinHistory(false)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>

              <div className="admin-checkin-history-dates">
                <label>
                  Du
                  <input
                    type="date"
                    value={historyStartDate}
                    max={historyEndDate || undefined}
                    onChange={(event) => setHistoryStartDate(event.target.value)}
                  />
                </label>
                <label>
                  Au
                  <input
                    type="date"
                    value={historyEndDate}
                    min={historyStartDate || undefined}
                    max={dakarDateKey()}
                    onChange={(event) => setHistoryEndDate(event.target.value)}
                  />
                </label>
              </div>

              {!isHistoryRangeValid ? (
                <p className="admin-error" role="alert">
                  La date de début doit être antérieure ou égale à la date de fin.
                </p>
              ) : (
                <div>
                  <div className="admin-checkin-history-tabs" role="group" aria-label="Type d’historique">
                    <button
                      type="button"
                      className={historyType === "arrival" ? "is-active" : ""}
                      aria-pressed={historyType === "arrival"}
                      onClick={() => setHistoryType("arrival")}
                    >
                      Arrivées ({arrivalHistory.length})
                    </button>
                    <button
                      type="button"
                      className={historyType === "departure" ? "is-active" : ""}
                      aria-pressed={historyType === "departure"}
                      onClick={() => setHistoryType("departure")}
                    >
                      Départs ({departureHistory.length})
                    </button>
                  </div>

                  <section className="admin-checkin-section admin-checkin-history-results">
                    <header>
                      <div>
                        <h3>{historyType === "arrival" ? "Arrivées" : "Départs"}</h3>
                        <p>
                          {historyType === "arrival"
                            ? "Clients ayant commencé leur séjour pendant cette période."
                            : "Clients ayant terminé leur séjour pendant cette période."}
                        </p>
                      </div>
                      <span>
                        {historyType === "arrival"
                          ? arrivalHistory.length
                          : departureHistory.length}
                      </span>
                    </header>
                    {historyType === "arrival" ? (
                      arrivalHistory.length ? (
                        <div className="admin-checkin-list">
                          {arrivalHistory.map((reservation) =>
                            renderHistoryCard(reservation, "arrival"),
                          )}
                        </div>
                      ) : (
                        <EmptyState>Aucune arrivée enregistrée sur cette période.</EmptyState>
                      )
                    ) : departureHistory.length ? (
                      <div className="admin-checkin-list">
                        {departureHistory.map((reservation) =>
                          renderHistoryCard(reservation, "departure"),
                        )}
                      </div>
                    ) : (
                      <EmptyState>Aucun départ enregistré sur cette période.</EmptyState>
                    )}
                  </section>
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === "accommodation_statistics" && (
          <AdminSection hideHeading title="Statistiques de l’hébergement">
            {accommodationStatsError ? (
              <p className="admin-error" role="alert">{accommodationStatsError}</p>
            ) : isLoadingAccommodationStats ? (
              <p role="status">Chargement des statistiques…</p>
            ) : (
              <div className="admin-accommodation-statistics">
                <section
                  className="admin-accommodation-stats-period"
                  aria-label="Filtrer les statistiques par période"
                >
                  <div className="admin-accommodation-stats-period-title">
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <strong>Période</strong>
                      <span>Départ des séjours · début des nettoyages</span>
                    </div>
                  </div>
                  <div className="admin-accommodation-stats-period-fields">
                    <label>
                      <span>Du</span>
                      <input
                        type="date"
                        value={accommodationStatsStartDate}
                        aria-label="Début de la période des statistiques"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          setAccommodationStatsStartDate(value);
                          if (value > accommodationStatsEndDate) {
                            setAccommodationStatsEndDate(value);
                          }
                        }}
                      />
                    </label>
                    <label>
                      <span>Au</span>
                      <input
                        type="date"
                        value={accommodationStatsEndDate}
                        min={accommodationStatsStartDate}
                        aria-label="Fin de la période des statistiques"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          setAccommodationStatsEndDate(value);
                          if (value < accommodationStatsStartDate) {
                            setAccommodationStatsStartDate(value);
                          }
                        }}
                      />
                    </label>
                  </div>
                </section>
                <div className="admin-accommodation-finance-kpis">
                  <article className="admin-accommodation-finance-card is-realized">
                    <span>Montant des séjours terminés</span>
                    <strong>{formatPrice(completedStatsRevenue)}</strong>
                    <small>{completedStatsReservations.length} séjour(s)</small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Valeur confirmée / en cours</span>
                    <strong>{formatPrice(activeStatsRevenue)}</strong>
                    <small>
                      {periodStatsReservations.filter(
                        (item) => item.status === "confirmed" || item.status === "in_progress",
                      ).length} séjour(s)
                    </small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Valeur en attente</span>
                    <strong>{formatPrice(pendingStatsRevenue)}</strong>
                    <small>
                      {periodStatsReservations.filter(
                        (item) => item.status === "pending",
                      ).length}
                      {" "}demande(s)
                    </small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Montant annulé</span>
                    <strong>{formatPrice(cancelledStatsRevenue)}</strong>
                    <small>{cancelledStatsReservations.length} réservation(s) annulée(s)</small>
                  </article>
                  <article className="admin-accommodation-finance-card is-equipment">
                    <span>Équipements disponibles</span>
                    <strong>{content.amenityOptions.length}</strong>
                    <small>équipement(s) configuré(s)</small>
                  </article>
                </div>

                <div className="admin-accommodation-charts">
                  <section className="admin-accommodation-chart is-revenue-evolution">
                    <header>
                      <h3>Évolution des montants</h3>
                      <span>Montants quotidiens · 30 derniers jours</span>
                    </header>
                    <div className="admin-stats-line-legend" aria-label="Légende">
                      <span><i className="is-completed" />Séjours terminés</span>
                      <span><i className="is-cancelled" />Montants annulés</span>
                    </div>
                    <div className="admin-stats-line-chart-scroll">
                      <svg
                          className="admin-stats-line-chart"
                          viewBox={`0 0 ${monthlyChartWidth} ${monthlyChartHeight}`}
                          role="img"
                          aria-label="Montants quotidiens des séjours terminés et annulés sur les 30 derniers jours"
                        >
                          <title>Montants par jour · 30 derniers jours</title>
                          <defs>
                            <linearGradient id="completed-revenue-area" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#8bc69b" stopOpacity="0.34" />
                              <stop offset="100%" stopColor="#8bc69b" stopOpacity="0.015" />
                            </linearGradient>
                            <linearGradient id="cancelled-revenue-area" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#ee6578" stopOpacity="0.28" />
                              <stop offset="100%" stopColor="#ee6578" stopOpacity="0.015" />
                            </linearGradient>
                            <filter id="revenue-line-glow" x="-30%" y="-30%" width="160%" height="160%">
                              <feGaussianBlur stdDeviation="3" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                            const y =
                              monthlyChartPadding.top +
                              step * monthlyChartPlotHeight;
                            const amount = maxDailyAmount * (1 - step);
                            return (
                              <g key={step}>
                                <line
                                  className="admin-stats-chart-gridline"
                                  x1={monthlyChartPadding.left}
                                  x2={monthlyChartWidth - monthlyChartPadding.right}
                                  y1={y}
                                  y2={y}
                                />
                                <text
                                  className="admin-stats-chart-axis-label"
                                  x={monthlyChartPadding.left - 8}
                                  y={y + 4}
                                  textAnchor="end"
                                >
                                  {formatCompactAmount(amount)}
                                </text>
                              </g>
                            );
                          })}
                          {chartDateTicks.map((day) => {
                            const index = last30DaysRevenue.findIndex(
                              (item) => item.key === day.key,
                            );
                            const x =
                              monthlyChartPadding.left +
                              (index / (statsChartDays - 1)) * monthlyChartPlotWidth;
                            const date = new Date(`${day.key}T12:00:00Z`);
                            return (
                              <g key={day.key}>
                                <line
                                  className="admin-stats-chart-gridline is-date-tick"
                                  x1={x}
                                  x2={x}
                                  y1={monthlyChartPadding.top + monthlyChartPlotHeight}
                                  y2={monthlyChartPadding.top + monthlyChartPlotHeight + 5}
                                />
                                <text
                                  className="admin-stats-chart-axis-label is-date-label"
                                  x={x}
                                  y={monthlyChartHeight - 14}
                                  textAnchor={
                                    index === 0
                                      ? "start"
                                      : index === statsChartDays - 1
                                        ? "end"
                                        : "middle"
                                  }
                                >
                                  {chartDateFormatter.format(date)}
                                </text>
                              </g>
                            );
                          })}
                          {(completedRevenuePoints.length > 1 ||
                            cancelledRevenuePoints.length > 1) && (() => {
                            const baselineY =
                              monthlyChartPadding.top + monthlyChartPlotHeight;
                            const completedPath =
                              completedRevenuePoints.length > 1
                                ? smoothChartPath(completedRevenuePoints)
                                : "";
                            const cancelledPath =
                              cancelledRevenuePoints.length > 1
                                ? smoothChartPath(cancelledRevenuePoints)
                                : "";
                            return (
                              <>
                                {completedPath && (
                                  <>
                                    <path
                                      className="admin-stats-chart-area is-completed"
                                      d={`${completedPath} L ${completedRevenuePoints[completedRevenuePoints.length - 1].x} ${baselineY} L ${completedRevenuePoints[0].x} ${baselineY} Z`}
                                      fill="url(#completed-revenue-area)"
                                    />
                                    <path
                                      className="admin-stats-chart-line is-completed"
                                      d={completedPath}
                                      filter="url(#revenue-line-glow)"
                                    />
                                  </>
                                )}
                                {cancelledPath && (
                                  <>
                                    <path
                                      className="admin-stats-chart-area is-cancelled"
                                      d={`${cancelledPath} L ${cancelledRevenuePoints[cancelledRevenuePoints.length - 1].x} ${baselineY} L ${cancelledRevenuePoints[0].x} ${baselineY} Z`}
                                      fill="url(#cancelled-revenue-area)"
                                    />
                                    <path
                                      className="admin-stats-chart-line is-cancelled"
                                      d={cancelledPath}
                                      filter="url(#revenue-line-glow)"
                                    />
                                  </>
                                )}
                              </>
                            );
                          })()}
                          <circle
                            className="admin-stats-chart-point is-completed"
                            cx={completedRevenuePoints[completedRevenuePoints.length - 1].x}
                            cy={completedRevenuePoints[completedRevenuePoints.length - 1].y}
                            r="3"
                          >
                            <title>
                              {last30DaysRevenue[statsChartDays - 1].key} ·
                              {" "}Séjours terminés :{" "}
                              {formatPrice(last30DaysRevenue[statsChartDays - 1].completed)}
                            </title>
                          </circle>
                          <circle
                            className="admin-stats-chart-point is-cancelled"
                            cx={cancelledRevenuePoints[cancelledRevenuePoints.length - 1].x}
                            cy={cancelledRevenuePoints[cancelledRevenuePoints.length - 1].y}
                            r="3"
                          >
                            <title>
                              {last30DaysRevenue[statsChartDays - 1].key} ·
                              {" "}Montants annulés :{" "}
                              {formatPrice(last30DaysRevenue[statsChartDays - 1].cancelled)}
                            </title>
                          </circle>
                      </svg>
                    </div>
                  </section>

                  <section className="admin-accommodation-chart">
                    <header>
                      <h3>Nettoyage</h3>
                      <span>Statistiques par chambre</span>
                    </header>
                    {cleaningStatsByRoom.length ? (
                      <div className="admin-cleaning-stats-list">
                        {cleaningStatsByRoom.map((room) => (
                          <article className="admin-cleaning-stats-row" key={room.id}>
                            <strong className="admin-cleaning-stats-room">{room.name}</strong>
                            <span className="admin-cleaning-stats-count">
                              {room.total} nettoyage(s)
                            </span>
                            <span className="admin-cleaning-stats-detail">
                              {room.completed} terminé(s) · {room.scheduled} planifié(s) / en cours
                            </span>
                            <div
                              className="admin-cleaning-stats-track"
                              role="progressbar"
                              aria-label={`Nettoyages terminés pour ${room.name}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={
                                room.total
                                  ? Math.round((room.completed / room.total) * 100)
                                  : 0
                              }
                            >
                              <span
                                style={{
                                  width: `${room.total ? (room.completed / room.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState>Aucune chambre enregistrée.</EmptyState>
                    )}
                  </section>

                  <section className="admin-accommodation-chart admin-room-revenue-chart">
                    <header>
                      <h3>Montant par chambre</h3>
                      <span>Séjours terminés</span>
                    </header>
                    {roomRevenue.length ? (
                      <div className="admin-room-revenue-list">
                        {roomRevenue.map((room) => (
                          <div className="admin-room-revenue-row" key={room.name}>
                            <span title={room.name}>{room.name}</span>
                            <div className="admin-room-revenue-track">
                              <div
                                className="admin-room-revenue-bar"
                                style={{
                                  width: `${(room.amount / maxRoomRevenue) * 100}%`,
                                }}
                              />
                            </div>
                            <strong title={formatPrice(room.amount)}>
                              {formatCompactAmount(room.amount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState>Aucun montant de séjour terminé.</EmptyState>
                    )}
                  </section>
                </div>
                <p className="admin-accommodation-stats-note">
                  Les montants sont calculés à partir des totaux enregistrés ; les séjours terminés ne signifient pas nécessairement que le paiement a été encaissé.
                </p>
              </div>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_housekeeping" && (
          <AdminSection
            hideHeading
            title="Nettoyage"
            description="Consultez les chambres bloquées et leurs périodes de nettoyage ou de maintenance. Vous pouvez aussi ajouter, modifier ou supprimer un blocage."
            action={
              <div className="admin-maintenance-page-actions">
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setShowMaintenanceHistory(true)}
                >
                  <History size={16} aria-hidden="true" /> Historique
                </button>
                <button
                  className="button button-gold"
                  type="button"
                  onClick={() => {
                    setEditingMaintenance(null);
                    setMaintenanceError("");
                    setShowMaintenanceForm((current) => !current);
                  }}
                >
                  <Plus size={16} /> Bloquer une chambre
                </button>
              </div>
            }
          >
            {maintenanceError && (
              <p className="admin-error" role="alert">{maintenanceError}</p>
            )}
            {showMaintenanceForm && (
              <form
                className="admin-entry-form admin-maintenance-form"
                key={editingMaintenance?.id ?? "new-maintenance"}
                onSubmit={(event) => void saveMaintenanceBlock(event)}
              >
                <label>
                  Chambre
                  <select
                    name="room_id"
                    required
                    defaultValue={editingMaintenance?.room_id ?? ""}
                  >
                    <option value="" disabled>Choisir une chambre</option>
                    {content.accommodations.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Motif
                  <select
                    name="reason"
                    defaultValue={editingMaintenance?.reason ?? "maintenance"}
                    required
                  >
                    <option value="maintenance">Maintenance</option>
                    <option value="cleaning">Nettoyage</option>
                  </select>
                </label>
                <label>
                  Début *
                  <input
                    name="starts_at"
                    type="datetime-local"
                    required
                    defaultValue={
                      editingMaintenance
                        ? toDateTimeLocal(editingMaintenance.starts_at)
                        : ""
                    }
                  />
                </label>
                <label>
                  Fin *
                  <input
                    name="ends_at"
                    type="datetime-local"
                    required
                    defaultValue={
                      editingMaintenance
                        ? toDateTimeLocal(editingMaintenance.ends_at)
                        : ""
                    }
                  />
                </label>
                <label className="admin-maintenance-notes">
                  Détail (facultatif)
                  <textarea
                    name="notes"
                    rows={2}
                    maxLength={1000}
                    defaultValue={editingMaintenance?.notes ?? ""}
                  />
                </label>
                <div className="admin-form-actions">
                  <button
                    className="button button-gold"
                    type="submit"
                    disabled={isSavingMaintenance}
                  >
                    {isSavingMaintenance ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    disabled={isSavingMaintenance}
                    onClick={() => {
                      setShowMaintenanceForm(false);
                      setEditingMaintenance(null);
                      setMaintenanceError("");
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
            {activeMaintenanceBlocks.length ? (
              <div className="admin-maintenance-active-list">
                {activeMaintenanceBlocks.map((block) => {
                  const roomName =
                    content.accommodations.find((room) => room.id === block.room_id)?.name ??
                    "Chambre inconnue";
                  return (
                    <article className="admin-maintenance-block" key={block.id}>
                      <div className="admin-maintenance-block-info">
                        <div className="admin-maintenance-block-heading">
                          <h3>{roomName}</h3>
                          <span className={`admin-maintenance-reason is-${block.reason}`}>
                            {block.reason === "cleaning" ? "Nettoyage" : "Maintenance"}
                          </span>
                        </div>
                        <p className="admin-maintenance-block-period">
                          {formatDate(block.starts_at)} <span aria-hidden="true">→</span> {formatDate(block.ends_at)}
                        </p>
                      </div>
                      <div className="admin-maintenance-block-controls">
                        <div className="admin-maintenance-block-actions">
                          <button
                            className="button button-gold"
                            type="button"
                            disabled={
                              savingMaintenanceBlockIds.has(block.id) ||
                              new Date(block.starts_at).getTime() > now
                            }
                            title={
                              new Date(block.starts_at).getTime() > now
                                ? "Disponible à partir du début de la période"
                                : undefined
                            }
                            onClick={() => void finishMaintenanceBlock(block)}
                          >
                            {savingMaintenanceBlockIds.has(block.id)
                              ? "Enregistrement…"
                              : "Terminer"}
                          </button>
                          <button
                            className="button button-outline"
                            type="button"
                            disabled={savingMaintenanceBlockIds.has(block.id)}
                            onClick={() =>
                              void deleteMaintenanceBlock(
                                block,
                                "Annuler ce blocage ? Cette action supprimera la période prévue.",
                              )
                            }
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                      {block.notes && (
                        <p className="admin-inbox-message">{block.notes}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState>Aucune chambre n’est bloquée pour le moment.</EmptyState>
            )}
          </AdminSection>
        )}

        {activePage === "accommodation_housekeeping" && showMaintenanceHistory && (
          <div
            className="admin-checkin-history-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowMaintenanceHistory(false);
              }
            }}
          >
            <section
              className="admin-checkin-history-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-maintenance-history-title"
            >
              <header>
                <div>
                  <span className="eyebrow">Nettoyage</span>
                  <h3 id="admin-maintenance-history-title">Historique des blocages</h3>
                </div>
                <button
                  type="button"
                  aria-label="Fermer l’historique"
                  onClick={() => setShowMaintenanceHistory(false)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              {maintenanceHistoryBlocks.length ? (
                <div className="admin-maintenance-history-list">
                  {maintenanceHistoryBlocks.map((block) => {
                    const roomName =
                      content.accommodations.find((room) => room.id === block.room_id)?.name ??
                      "Chambre inconnue";
                    return (
                      <article className="admin-maintenance-history-card" key={block.id}>
                        <div className="admin-maintenance-history-card-heading">
                          <h4>{roomName}</h4>
                          <span className={`admin-maintenance-reason is-${block.reason}`}>
                            {block.reason === "cleaning" ? "Nettoyage" : "Maintenance"}
                          </span>
                          <span className="admin-maintenance-history-done">Terminé</span>
                        </div>
                        <p className="admin-maintenance-history-period">
                          <CalendarDays size={15} aria-hidden="true" />
                          <span>{formatDate(block.starts_at)}</span>
                          <span aria-hidden="true">→</span>
                          <span>{formatDate(block.ends_at)}</span>
                        </p>
                        {block.notes && (
                          <p className="admin-maintenance-history-notes">{block.notes}</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>Aucun blocage terminé dans l’historique.</EmptyState>
              )}
            </section>
          </div>
        )}

        {activePage.startsWith("accommodation_") &&
          activePage !== "accommodation_rooms" &&
          activePage !== "accommodation_amenities" &&
          activePage !== "accommodation_reservations" &&
          activePage !== "accommodation_calendar" &&
          activePage !== "accommodation_housekeeping" &&
          activePage !== "accommodation_statistics" && (
          <section
            className="admin-empty-subpage"
            aria-label={accommodationPages.find((item) => item.key === activePage)?.label}
          />
        )}

        {activePage === "restaurant" && (
          <>
            {ordersError && <p className="admin-error" role="alert">{ordersError}</p>}
            <AdminSection
              hideHeading
              title="Commandes reçues"
              description="Suivez les commandes et faites évoluer leur statut."
              action={
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setShowOrderHistory(true)}
                >
                  <History size={16} aria-hidden="true" /> Historique ({orderHistory.length})
                </button>
              }
            >
              <div className="admin-reservation-summary admin-restaurant-order-summary">
                <span><strong>{activeOrders.length}</strong> à traiter</span>
                <span>
                  <strong>{activeOrders.filter((order) => order.status === "new").length}</strong>
                  {" "}nouvelle(s)
                </span>
                <span>
                  <strong>{activeOrders.filter((order) => order.status === "preparing").length}</strong>
                  {" "}en préparation
                </span>
                <span>
                  <strong>{activeOrders.filter((order) => order.status === "ready").length}</strong>
                  {" "}prête(s)
                </span>
              </div>
              <div className="admin-reservation-filters admin-restaurant-order-filters">
                <label className="admin-reservation-search admin-order-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Rechercher par référence, nom, téléphone ou plat"
                    aria-label="Rechercher une commande par référence, nom, téléphone ou plat"
                  />
                </label>
                <label>
                  Filtrer par statut
                  <select
                    value={orderStatusFilter}
                    onChange={(event) =>
                      setOrderStatusFilter(event.target.value as "all" | OrderStatus)
                    }
                  >
                    <option value="all">Tous les statuts</option>
                    {orderStatuses
                      .filter(({ status }) => status !== "completed" && status !== "cancelled")
                      .map(({ status, label }) => (
                        <option key={status} value={status}>{label}</option>
                      ))}
                  </select>
                </label>
              </div>
              {displayedOrders.length ? (
                <div className="admin-inbox">
                  {displayedOrders.map((order) => (
                    <article className="admin-inbox-item admin-reservation-item admin-restaurant-order-item" key={order.id}>
                      <div className="admin-inbox-heading">
                        <div>
                          <h3>{order.name}</h3>
                          <p>Reçue le {formatDate(order.created_at)} · <a href={`tel:${order.phone}`}>{order.phone}</a></p>
                          <p>Référence : {order.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div
                          className="admin-reservation-status-actions"
                          role="group"
                          aria-label={`Statut de la commande de ${order.name}`}
                        >
                          {orderStatusSequence.map((status) => {
                            const currentOrder = orderStatusOrder[order.status];
                            const statusOrder = orderStatusOrder[status];
                            const isPassed =
                              currentOrder !== undefined &&
                              statusOrder !== undefined &&
                              statusOrder < currentOrder;
                            const isCurrent = status === order.status;
                            const isAvailable =
                              isCurrent || orderStatusActions[order.status].includes(status);

                            return (
                              <button
                                className={`admin-reservation-status-button${isCurrent ? " is-current" : ""}${isPassed ? " is-passed" : ""}${status === "cancelled" ? " is-cancelled" : ""}`}
                                type="button"
                                key={status}
                                aria-pressed={isCurrent}
                                aria-disabled={!isAvailable || isPassed}
                                disabled={
                                  isCurrent ||
                                  !isAvailable ||
                                  isPassed ||
                                  savingOrderStatuses.has(order.id)
                                }
                                onClick={() => void updateOrderStatus(order.id, status)}
                              >
                                {orderStatusLabels[status]}
                              </button>
                            );
                          })}
                          <button
                            className="admin-delete-button"
                            type="button"
                            aria-label="Supprimer la commande"
                            onClick={() => void deleteInboxItem("restaurant_orders", order.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <dl className="admin-reservation-details admin-restaurant-order-details">
                        <div>
                          <dt>Montant total</dt>
                          <dd>{formatPrice(order.total)}</dd>
                        </div>
                        <div>
                          <dt>Reçu</dt>
                          <dd>
                            {orderReceiptUrls[order.id] ? (
                              <button
                                className="admin-order-receipt-inline"
                                type="button"
                                onClick={() =>
                                  setOrderReceiptPreview({
                                    url: orderReceiptUrls[order.id],
                                    name: order.name,
                                  })
                                }
                              >
                                Voir le reçu
                              </button>
                            ) : order.receipt_path ? (
                              "Indisponible"
                            ) : (
                              "Non joint"
                            )}
                          </dd>
                        </div>
                      </dl>
                      <ul className="admin-order-history-lines">
                        {order.items.map((line, index) => (
                          <li key={`${line.id}-${index}`}>
                            <span className="admin-order-history-quantity">{line.quantity} ×</span>
                            <span className="admin-order-history-item-name">{line.name}</span>
                            <strong>{formatPrice(line.price * line.quantity)}</strong>
                          </li>
                        ))}
                      </ul>
                      {order.note && <p className="admin-inbox-message">{order.note}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  {searchTerm
                    || orderStatusFilter !== "all"
                    ? "Aucune commande ne correspond aux filtres sélectionnés."
                    : "Aucune commande en cours de traitement."}
                </EmptyState>
              )}
            </AdminSection>
          </>
        )}

        {activePage === "restaurant_statistics" && (
          <AdminSection hideHeading title="Statistiques du restaurant">
            {ordersError ? (
              <p className="admin-error" role="alert">{ordersError}</p>
            ) : isLoadingInbox ? (
              <p role="status">Chargement des statistiques…</p>
            ) : (
              <div className="admin-accommodation-statistics">
                <section
                  className="admin-restaurant-stats-period"
                  aria-label="Filtrer les statistiques du restaurant par période"
                >
                  <div className="admin-restaurant-stats-period-title">
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <strong>Période des statistiques</strong>
                      <span>
                        Les indicateurs et les ventes suivent ces dates. Le graphique mensuel reste fixe sur 6 mois.
                      </span>
                    </div>
                  </div>
                  <div className="admin-restaurant-stats-period-fields">
                    <label>
                      <span>Du</span>
                      <input
                        type="date"
                        value={restaurantStatsStartDate}
                        aria-label="Début de la période des statistiques du restaurant"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          setRestaurantStatsStartDate(value);
                          if (value > restaurantStatsEndDate) {
                            setRestaurantStatsEndDate(value);
                          }
                        }}
                      />
                    </label>
                    <label>
                      <span>Au</span>
                      <input
                        type="date"
                        value={restaurantStatsEndDate}
                        min={restaurantStatsStartDate}
                        aria-label="Fin de la période des statistiques du restaurant"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          setRestaurantStatsEndDate(value);
                          if (value < restaurantStatsStartDate) {
                            setRestaurantStatsStartDate(value);
                          }
                        }}
                      />
                    </label>
                  </div>
                </section>

                <div className="admin-accommodation-finance-kpis admin-restaurant-statistics-kpis">
                  <article className="admin-accommodation-finance-card">
                    <span>Total commandes reçues</span>
                    <strong>{restaurantStatsOrders.length}</strong>
                    <small>Dans la période</small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Commandes terminées</span>
                    <strong>{restaurantStatsCompletedOrders.length}</strong>
                    <small>Dans la période</small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Commandes annulées</span>
                    <strong>{cancelledOrders.length}</strong>
                    <small>Dans la période</small>
                  </article>
                  <article className="admin-accommodation-finance-card">
                    <span>Commandes à traiter</span>
                    <strong>{activeRestaurantOrders.length}</strong>
                    <small>Nouvelle · préparation · prête</small>
                  </article>
                  <article className="admin-accommodation-finance-card is-realized">
                    <span>Montant des commandes terminées</span>
                    <strong>{formatPrice(completedOrderRevenue)}</strong>
                    <small>{restaurantStatsCompletedOrders.length} commande(s)</small>
                  </article>
                  <article className="admin-accommodation-finance-card is-cancelled">
                    <span>Montant des commandes annulées</span>
                    <strong>{formatPrice(cancelledOrderRevenue)}</strong>
                    <small>{cancelledOrders.length} commande(s)</small>
                  </article>
                </div>

                <div className="admin-accommodation-charts admin-restaurant-statistics-charts">
                  <section className="admin-accommodation-chart">
                    <header>
                      <h3>Ventes par catégorie</h3>
                      <span>Commandes terminées · période sélectionnée</span>
                    </header>
                    <div className="admin-restaurant-category-chart">
                      <svg
                        viewBox="0 0 140 140"
                        role="img"
                        aria-label={`Répartition de ${formatPrice(restaurantCategoryRevenueTotal)} de ventes par catégorie`}
                      >
                        <circle
                          className="admin-restaurant-category-chart-track"
                          cx="70"
                          cy="70"
                          r="50"
                        />
                        {restaurantCategoryRevenueTotal > 0 &&
                          (() => {
                            let offset = 0;
                            const circumference = 2 * Math.PI * 50;
                            return restaurantCategorySales
                              .filter((entry) => entry.revenue > 0)
                              .map((entry) => {
                              const length =
                                (entry.revenue / restaurantCategoryRevenueTotal) *
                                circumference;
                              const currentOffset = offset;
                              offset += length;
                              return (
                                <circle
                                  key={entry.category}
                                  cx="70"
                                  cy="70"
                                  r="50"
                                  fill="none"
                                  stroke={entry.color}
                                  strokeWidth="22"
                                  strokeDasharray={`${length} ${circumference - length}`}
                                  strokeDashoffset={-currentOffset}
                                  transform="rotate(-90 70 70)"
                                />
                              );
                              });
                          })()}
                      </svg>
                      {restaurantCategorySales.length ? (
                        <div className="admin-restaurant-category-legend">
                          {restaurantCategorySales.map((entry) => (
                            <div key={entry.category}>
                              <span
                                className="admin-restaurant-category-swatch"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span>{entry.category}</span>
                              <strong>{formatPrice(entry.revenue)}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState>Aucune vente terminée.</EmptyState>
                      )}
                    </div>
                  </section>

                  <section className="admin-accommodation-chart">
                    <header>
                      <h3>Commandes terminées par mois</h3>
                      <span>6 derniers mois · date de commande · indépendant du filtre</span>
                    </header>
                    <div className="admin-revenue-chart admin-restaurant-monthly-orders">
                      {monthlyOrderRevenue.map((month) => (
                        <div className="admin-revenue-month" key={month.key}>
                          <strong title={`${month.count} commande(s) terminée(s)`}>
                            {month.count}
                          </strong>
                          <div className="admin-revenue-bar-track">
                            <div
                              className="admin-revenue-bar"
                              style={{
                                height: `${Math.max((month.count / maxMonthlyCompletedOrderCount) * 100, 2)}%`,
                              }}
                            />
                          </div>
                          <span>{month.label}</span>
                          <small>{month.count === 1 ? "commande" : "commandes"}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <p className="admin-accommodation-stats-note">
                  Les montants sont calculés à partir des totaux enregistrés sur les commandes terminées de la période ; ils ne confirment pas l’encaissement du paiement.
                </p>

                <section className="admin-accommodation-chart admin-restaurant-top-sellers">
                  <header>
                    <h3>Les cinq plats les plus vendus</h3>
                    <span>Quantité et montant · commandes terminées sur la période</span>
                  </header>
                  {popularRestaurantItems.length ? (
                    <div className="admin-restaurant-ranking-list">
                      {popularRestaurantItems.map((item, index) => (
                        <article className="admin-restaurant-ranking-row" key={`${item.category}-${item.name}`}>
                          <span className="admin-restaurant-ranking-position">{index + 1}</span>
                          <div className="admin-restaurant-ranking-name">
                            <strong>{item.name}</strong>
                            <small>{item.category}</small>
                          </div>
                          <div className="admin-restaurant-ranking-track">
                            <span
                              style={{
                                width: `${(item.quantity / maxPopularRestaurantQuantity) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="admin-restaurant-ranking-value">
                            <strong>{item.quantity} vendu(s)</strong>
                            <small>{formatPrice(item.revenue)}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>Aucun plat dans les commandes terminées.</EmptyState>
                  )}
                </section>

                <section className="admin-accommodation-chart admin-restaurant-category-rankings">
                  <header>
                    <h3>Classement des ventes par catégorie</h3>
                    <span>Plats triés par quantité vendue · période sélectionnée</span>
                  </header>
                  {restaurantDishRankings.length ? (
                    <div className="admin-restaurant-category-rankings-grid">
                      {restaurantDishRankings.map((category) => {
                        const maxCategoryQuantity = Math.max(
                          ...category.dishes.map((dish) => dish.quantity),
                          1,
                        );
                        return (
                          <section
                            className="admin-restaurant-category-ranking"
                            key={category.category}
                          >
                            <header>
                              <span
                                className="admin-restaurant-category-swatch"
                                style={{ backgroundColor: category.color }}
                              />
                              <h4>{category.category}</h4>
                              <span>{category.dishes.length} plat(s)</span>
                            </header>
                            <ol>
                              {category.dishes.map((dish, index) => (
                                <li key={dish.name}>
                                  <span className="admin-restaurant-category-rank">
                                    {index + 1}
                                  </span>
                                  <span className="admin-restaurant-category-dish">
                                    {dish.name}
                                  </span>
                                  <span
                                    className="admin-restaurant-category-bar"
                                    aria-hidden="true"
                                  >
                                    <i
                                      style={{
                                        width: `${(dish.quantity / maxCategoryQuantity) * 100}%`,
                                        backgroundColor: category.color,
                                      }}
                                    />
                                  </span>
                                  <strong>{dish.quantity} · {formatPrice(dish.revenue)}</strong>
                                </li>
                              ))}
                            </ol>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState>Aucune vente terminée à classer.</EmptyState>
                  )}
                </section>
              </div>
            )}
          </AdminSection>
        )}

        {activePage === "restaurant" && showOrderHistory && (
          <div
            className="admin-checkin-history-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowOrderHistory(false);
              }
            }}
          >
            <section
              className="admin-checkin-history-dialog admin-order-history-dialog admin-completed-reservation-history"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-order-history-title"
            >
              <header>
                <div>
                  <span className="eyebrow">Commandes clôturées</span>
                  <h3 id="admin-order-history-title">Historique des commandes</h3>
                </div>
                <button
                  type="button"
                  aria-label="Fermer l’historique"
                  onClick={() => setShowOrderHistory(false)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              <label className="admin-reservation-search admin-history-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={orderHistorySearch}
                  onChange={(event) => setOrderHistorySearch(event.target.value)}
                  placeholder="Rechercher par référence, nom, téléphone…"
                  aria-label="Rechercher dans l’historique des commandes"
                />
              </label>
              {filteredOrderHistory.length ? (
                <div className="admin-inbox admin-order-history-list admin-completed-reservation-list">
                  {filteredOrderHistory.map((order) => (
                    <article
                      className="admin-inbox-item admin-completed-reservation-item"
                      key={order.id}
                    >
                      <div className="admin-inbox-heading">
                        <div>
                          <h3>{order.name} · {formatPrice(order.total)}</h3>
                          <p>{formatDate(order.created_at)} · <a href={`tel:${order.phone}`}>{order.phone}</a></p>
                          <p>Référence : {order.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <span
                          className={`admin-completed-reservation-status is-${order.status}`}
                        >
                          {orderStatusLabels[order.status]}
                        </span>
                      </div>
                      <ul className="admin-order-history-lines">
                        {order.items.map((line, index) => (
                          <li key={`${line.id}-${index}`}>
                            <span className="admin-order-history-quantity">
                              {line.quantity} ×
                            </span>
                            <span className="admin-order-history-item-name">{line.name}</span>
                            <strong>{formatPrice(line.price * line.quantity)}</strong>
                          </li>
                        ))}
                      </ul>
                      {order.note && <p className="admin-inbox-message">{order.note}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  {orderHistorySearchTerm
                    ? "Aucune commande ne correspond à cette recherche."
                    : "Aucune commande terminée ou annulée."}
                </EmptyState>
              )}
            </section>
          </div>
        )}

        {activePage === "restaurant" && orderReceiptPreview && (
          <div
            className="admin-checkin-history-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOrderReceiptPreview(null);
              }
            }}
          >
            <section
              className="admin-checkin-history-dialog admin-reservation-receipt-dialog admin-order-receipt-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-order-receipt-title"
            >
              <header>
                <div>
                  <span className="eyebrow">Justificatif de paiement</span>
                  <h3 id="admin-order-receipt-title">
                    Reçu de {orderReceiptPreview.name}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Fermer le reçu"
                  onClick={() => setOrderReceiptPreview(null)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              <iframe
                className="admin-reservation-receipt-preview"
                src={orderReceiptPreview.url}
                title={`Reçu de paiement de la commande de ${orderReceiptPreview.name}`}
              />
            </section>
          </div>
        )}

        {activeRestaurantPage && (
          <AdminSection
            hideHeading
            title={activeRestaurantPage.label}
            action={
              <button
                className="button button-gold"
                type="button"
                onClick={() => {
                  setEditingDish(null);
                  setShowDishForm(true);
                }}
              >
                <Plus size={16} /> Ajouter
              </button>
            }
          >
                {showDishForm && (
                  <form
                    className="admin-entry-form"
                    key={`${activePage}-${editingDish?.id ?? "new"}`}
                    onSubmit={(event) => void saveDish(event)}
                  >
                    <label>
                      Nom du plat
                      <input name="name" required defaultValue={editingDish?.name ?? ""} />
                    </label>
                    <label>
                      Description
                      <textarea name="description" rows={3} defaultValue={editingDish?.description ?? ""} />
                    </label>
                    <label className="admin-photo-input">
                      Ajouter une image (JPG, PNG, WEBP ou GIF, 10 Mo maximum)
                      <input
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                      />
                    </label>
                    <label>
                      Prix (FCFA)
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="1"
                        required
                        defaultValue={editingDish?.price ?? ""}
                      />
                    </label>
                    <div className="admin-form-actions">
                      <button
                        className="button button-gold"
                        type="submit"
                        disabled={isSavingContent || isSavingDish}
                      >
                        {isSavingContent || isSavingDish ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button
                        className="button button-outline"
                        type="button"
                        disabled={isSavingContent || isSavingDish}
                        onClick={() => {
                          setShowDishForm(false);
                          setEditingDish(null);
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
                {activeRestaurantDishes.length ? (
                  <div className="admin-item-list">
                    {activeRestaurantDishes.map((dish) => (
                      <article
                        className={`admin-managed-item${dish.suspended ? " is-suspended" : ""}`}
                        key={dish.id}
                      >
                        <div>
                          {dish.image && <img src={dish.image} alt="" />}
                          <span>
                            <strong>{dish.name}</strong>
                            <small>
                              {dish.category} · {dish.description}
                              {dish.suspended ? " · Suspendu" : ""}
                            </small>
                          </span>
                        </div>
                        <strong>
                          {dish.price === undefined ? "Prix à préciser" : formatPrice(dish.price)}
                        </strong>
                        <div className="admin-inline-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDish(dish);
                              setShowDishForm(true);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            className={dish.suspended ? "admin-dish-reactivate" : "admin-dish-suspend"}
                            type="button"
                            disabled={isSavingContent}
                            onClick={() => void toggleDishSuspension(dish)}
                          >
                            {dish.suspended ? "Réactiver" : "Suspendre"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState>Aucun plat dans cette catégorie.</EmptyState>
                )}
          </AdminSection>
        )}

        {activePage === "gallery" && (
          <AdminSection
            title="Images de la galerie"
            action={
              <button
                className="button button-gold"
                type="button"
                onClick={() => {
                  setContentError("");
                  setShowPhotoForm(true);
                }}
              >
                <Plus size={16} aria-hidden="true" /> Ajouter une image
              </button>
            }
          >
            {showPhotoForm && (
              <form className="admin-entry-form" onSubmit={(event) => void savePhoto(event)}>
                <label>
                  Image
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                  />
                </label>
                <div className="admin-form-actions">
                  <button
                    className="button button-gold"
                    type="submit"
                    disabled={isSavingContent || isUploadingPhoto}
                  >
                    {isSavingContent || isUploadingPhoto ? "Ajout…" : "Ajouter l’image"}
                  </button>
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => setShowPhotoForm(false)}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
            <section className="admin-gallery-section">
              <header className="admin-gallery-section-heading">
                <h3>Images utilisées sur la page client</h3>
                <p>Chaque image affichée sur le site n’apparaît qu’une seule fois. Remplacez-la en choisissant un fichier sur votre appareil.</p>
              </header>
              {clientGalleryUsage.length ? (
                <div className="admin-gallery-grid">
                  {clientGalleryUsage.map(({ slot, photo }) => (
                    <AdminGalleryPhotoCard
                      key={slot}
                      photo={photo}
                      slot={slot}
                      slotLabel={adminGallerySlotLabels[slot]}
                      isUploadingReplacement={replacingGalleryPhotoId === photo.id}
                      isSaving={isSavingContent}
                      onReplace={(imageFile) =>
                        void replaceClientGalleryPhoto(slot, imageFile)
                      }
                      onTogglePublication={() => void togglePhotoPublication(photo)}
                      onDelete={() => void deletePhoto(photo.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>Aucune image n’est actuellement affichée sur la page client.</EmptyState>
              )}
            </section>
            <section className="admin-gallery-section">
              <header className="admin-gallery-section-heading">
                <h3>Autres images de la galerie</h3>
                <p>Les images non utilisées par les sections présentées ci-dessus, avec les ajouts les plus récents en premier.</p>
              </header>
              {otherGalleryPhotos.length ? (
                <div className="admin-gallery-grid">
                  {otherGalleryPhotos.map((photo) => (
                    <AdminGalleryPhotoCard
                      key={photo.id}
                      photo={photo}
                      slot={null}
                      isUploadingReplacement={false}
                      isSaving={isSavingContent}
                      onReplace={() => undefined}
                      onTogglePublication={() => void togglePhotoPublication(photo)}
                      onDelete={() => void deletePhoto(photo.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState>Aucune autre image dans la galerie.</EmptyState>
              )}
            </section>
          </AdminSection>
        )}

        {activePage === "events" && (
          <AdminSection
            title="Événements"
            description="Créez et mettez à jour les événements affichés sur le site."
            action={<button className="button button-gold" type="button" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}><Plus size={16} /> Ajouter un événement</button>}
          >
            {showEventForm && (
              <form className="admin-entry-form" onSubmit={(event) => void saveEvent(event)}>
                <label>Titre<input name="title" required defaultValue={editingEvent?.title ?? ""} /></label>
                <label>Description<textarea name="description" rows={4} required defaultValue={editingEvent?.description ?? ""} /></label>
                <label>Participation<input name="participation" placeholder="Ex. Gratuit ou 5 000 FCFA" defaultValue={editingEvent?.participation ?? ""} /></label>
                <label>Date<input name="date" type="date" required defaultValue={editingEvent?.date ?? ""} /></label>
                <label>Heure<input name="time" type="time" defaultValue={editingEvent?.time ?? ""} /></label>
                <label>Lieu<input name="location" defaultValue={editingEvent?.location ?? ""} /></label>
                <label>
                  Affiche de l’événement
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                  />
                </label>
                <div className="admin-form-actions">
                  <button className="button button-gold" type="submit" disabled={isSavingContent || isSavingEvent}>{isSavingContent || isSavingEvent ? "Enregistrement…" : "Enregistrer l’événement"}</button>
                  <button className="button button-outline" type="button" onClick={() => { setShowEventForm(false); setEditingEvent(null); }}>Annuler</button>
                </div>
              </form>
            )}
            {content.events.length ? (
              <div className="admin-item-list admin-event-list">
                {content.events.map((event, index) => (
                  <article className="admin-event-item" key={event.id ?? `${event.date}-${event.title}`}>
                    <div className="admin-event-visual">
                      {event.image ? (
                        <img src={event.image} alt="" loading="lazy" />
                      ) : (
                        <CalendarDays size={30} aria-hidden="true" />
                      )}
                    </div>
                    <div className="admin-event-content">
                      <div className="admin-event-heading">
                        <h3>{event.title}</h3>
                        {event.participation && (
                          <span className="admin-event-participation">
                            Participation : {event.participation}
                          </span>
                        )}
                      </div>
                      <div className="admin-event-meta">
                        <span>
                          <CalendarDays size={14} aria-hidden="true" />
                          {formatDakarDate(event.date)}
                        </span>
                        {event.time && (
                          <span>
                            <Clock3 size={14} aria-hidden="true" />
                            {event.time}
                          </span>
                        )}
                        <span>
                          <MapPin size={14} aria-hidden="true" />
                          {event.location || "Lieu à préciser"}
                        </span>
                      </div>
                      <p>{event.description}</p>
                    </div>
                    <div className="admin-inline-actions admin-event-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEvent({
                            ...event,
                            id: event.id ?? `${event.date}-${event.title}`,
                          });
                          setShowEventForm(true);
                        }}
                      >
                        Modifier
                      </button>
                      <button type="button" onClick={() => void deleteEvent(index)}>
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState>Aucun événement enregistré.</EmptyState>}
          </AdminSection>
        )}

        {activePage === "contact" && (
          <AdminSection
            title="Messages de contact"
            description="Les messages envoyés depuis le formulaire de contact sont affichés ici."
            action={
              <button
                className="button button-outline"
                type="button"
                onClick={() => setShowContactHistory(true)}
              >
                <History size={16} aria-hidden="true" /> Historique ({handledContactMessages.length})
              </button>
            }
          >
            {contactSyncError && (
              <p className="admin-error" role="status">{contactSyncError}</p>
            )}
            <div className="admin-contact-overview" aria-label="Résumé des messages">
              <article>
                <span>Messages à traiter</span>
                <strong>{newContactMessages.length}</strong>
              </article>
              <article>
                <span>Messages traités</span>
                <strong>{handledContactMessages.length}</strong>
              </article>
            </div>
            {newContactMessages.length ? (
              <div className="admin-inbox admin-contact-list">
                {newContactMessages.map((item) => (
                  <article className="admin-inbox-item admin-contact-card" key={item.id}>
                    <div className="admin-contact-card-heading">
                      <h3>{item.full_name}</h3>
                      <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                    </div>
                    <div className="admin-contact-card-tools">
                      <div className="admin-contact-links">
                        <a href={`tel:${item.phone}`}>
                          <Phone size={14} aria-hidden="true" />
                          {item.phone}
                        </a>
                        {item.email && (
                          <a href={`mailto:${item.email}`}>
                            <Mail size={14} aria-hidden="true" />
                            {item.email}
                          </a>
                        )}
                      </div>
                      <div className="admin-row-actions admin-contact-actions">
                        <button
                          className="admin-contact-replied-button"
                          type="button"
                          onClick={() => void updateContactStatus(item.id, "handled")}
                        >
                          <Check size={15} aria-hidden="true" />
                          Marquer comme répondu
                        </button>
                        <button
                          className="admin-delete-button"
                          type="button"
                          aria-label={`Supprimer le message de ${item.full_name}`}
                          onClick={() => void deleteInboxItem("contact_messages", item.id)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                    <p className="admin-inbox-message">{item.message}</p>
                  </article>
                ))}
              </div>
            ) : <EmptyState>Aucun nouveau message.</EmptyState>}
          </AdminSection>
        )}

        {activePage === "admins" && isSuperAdmin && (
          <AdminSection title="" hideHeading>
            {adminUsersError && !editingAdmin && (
              <p className="admin-error" role="alert">{adminUsersError}</p>
            )}
            {adminUsersMessage && (
              <p className="admin-success" role="status">{adminUsersMessage}</p>
            )}

            <section className="admin-admin-create">
              <header className="admin-admin-create-heading">
                <div>
                  <h3>Nouveau compte</h3>
                </div>
              </header>
              <form
                className="admin-admin-users-form"
                onSubmit={(event) => void addAdminUser(event)}
              >
                <label>
                  Adresse e-mail
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={adminUserEmail}
                    onChange={(event) => setAdminUserEmail(event.target.value)}
                    placeholder="nom@exemple.com"
                  />
                </label>
                <label>
                  Mot de passe initial
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={adminUserPassword}
                    onChange={(event) => setAdminUserPassword(event.target.value)}
                  />
                </label>
                <label>
                  Type de compte
                  <select
                    value={adminUserRole}
                    onChange={(event) =>
                      setAdminUserRole(
                        event.target.value === "super_admin" ? "super_admin" : "employee",
                      )
                    }
                  >
                    <option value="employee">Employé</option>
                    <option value="super_admin">Administrateur suprême</option>
                  </select>
                </label>
                <button
                  className="button button-gold"
                  type="submit"
                  disabled={isSavingAdminUsers}
                >
                  <Plus size={16} aria-hidden="true" />
                  {isSavingAdminUsers ? "Création en cours…" : "Créer le compte"}
                </button>
              </form>
            </section>

            {isLoadingAdminUsers ? (
              <p className="admin-admin-loading" role="status">Chargement des comptes…</p>
            ) : (
              <div className="admin-admin-users-grid">
                {[
                  { role: "super_admin" as AdminUserRole, title: "Administrateurs" },
                  { role: "employee" as AdminUserRole, title: "Employés" },
                ].map(({ role, title }) => {
                  const users = adminUsers.filter((admin) => admin.role === role);
                  return (
                    <section className="admin-admin-user-column" key={role}>
                      <header className="admin-admin-user-column-heading">
                        <h3>{title}</h3>
                        <span>{users.length}</span>
                      </header>
                      {users.length ? (
                        <div className="admin-admin-user-list">
                          {users.map((admin) => (
                            <article className="admin-admin-user-row" key={admin.user_id}>
                              <div className="admin-admin-user-info">
                                <strong>{admin.email ?? "Adresse e-mail indisponible"}</strong>
                                <time dateTime={admin.created_at}>
                                  Créé le {formatDate(admin.created_at)}
                                </time>
                              </div>
                              <span
                                className={`admin-admin-status-badge${admin.is_suspended ? " is-suspended" : ""}`}
                              >
                                {admin.is_suspended ? "Suspendu" : "Actif"}
                              </span>
                              <div className="admin-admin-user-actions">
                                <button
                                  className="admin-admin-icon-button"
                                  type="button"
                                  aria-label={`Modifier ${admin.email ?? "ce compte"}`}
                                  title="Modifier"
                                  disabled={isSavingAdminUsers}
                                  onClick={() => openAdminEditor(admin)}
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                </button>
                                <button
                                  className={`admin-admin-icon-button admin-admin-suspend-button${admin.is_suspended ? " is-reactivate" : ""}`}
                                  type="button"
                                  aria-label={`${admin.is_suspended ? "Réactiver" : "Suspendre"} ${admin.email ?? "ce compte"}`}
                                  title={
                                    admin.user_id === currentAdminUserId
                                      ? "Vous ne pouvez pas suspendre votre propre compte."
                                      : admin.is_suspended
                                        ? "Réactiver le compte"
                                        : "Suspendre le compte"
                                  }
                                  disabled={
                                    isSavingAdminUsers ||
                                    admin.user_id === currentAdminUserId ||
                                    (!admin.is_suspended &&
                                      admin.role === "super_admin" &&
                                      adminUsers.filter(
                                        (user) =>
                                          user.role === "super_admin" && !user.is_suspended,
                                      ).length <= 1)
                                  }
                                  onClick={() => void toggleAdminSuspension(admin)}
                                >
                                  {admin.is_suspended ? (
                                    <Check size={15} aria-hidden="true" />
                                  ) : (
                                    <Ban size={15} aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="admin-admin-user-empty">Aucun compte</p>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {editingAdmin && (
              <div
                className="admin-admin-edit-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeAdminEditor();
                }}
              >
                <section
                  className="admin-admin-edit-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="admin-account-edit-title"
                >
                  <header>
                    <div>
                      <span className="eyebrow">Compte administrateur</span>
                      <h3 id="admin-account-edit-title">Modifier les informations</h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Fermer"
                      disabled={isSavingAdminUsers}
                      onClick={closeAdminEditor}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </header>
                  <form onSubmit={(event) => void updateAdminUser(event)}>
                    <label>
                      Adresse e-mail
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={editingAdminEmail}
                        onChange={(event) => setEditingAdminEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      Nouveau mot de passe
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={editingAdminPassword}
                        onChange={(event) => setEditingAdminPassword(event.target.value)}
                        placeholder="Laisser vide pour ne pas le modifier"
                      />
                    </label>
                    <label>
                      Type de compte
                      <select
                        value={editingAdminRole}
                        disabled={
                          editingAdmin.user_id === currentAdminUserId ||
                          (editingAdmin.role === "super_admin" &&
                            !editingAdmin.is_suspended &&
                            adminUsers.filter(
                              (user) => user.role === "super_admin" && !user.is_suspended,
                            ).length <= 1)
                        }
                        onChange={(event) =>
                          setEditingAdminRole(
                            event.target.value === "super_admin" ? "super_admin" : "employee",
                          )
                        }
                      >
                        <option value="employee">Employé</option>
                        <option value="super_admin">Administrateur suprême</option>
                      </select>
                    </label>
                    {adminUsersError && (
                      <p className="admin-error" role="alert">{adminUsersError}</p>
                    )}
                    <footer>
                      <button
                        className="button button-outline"
                        type="button"
                        disabled={isSavingAdminUsers}
                        onClick={closeAdminEditor}
                      >
                        Annuler
                      </button>
                      <button
                        className="button button-gold"
                        type="submit"
                        disabled={isSavingAdminUsers}
                      >
                        {isSavingAdminUsers ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </footer>
                  </form>
                </section>
              </div>
            )}
          </AdminSection>
        )}

        {activePage === "contact" && showContactHistory && (
          <div
            className="admin-checkin-history-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowContactHistory(false);
              }
            }}
          >
            <section
              className="admin-checkin-history-dialog admin-contact-history-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-contact-history-title"
            >
              <header>
                <div>
                  <span className="eyebrow">Messages traités</span>
                  <h3 id="admin-contact-history-title">Historique des messages</h3>
                </div>
                <button
                  type="button"
                  aria-label="Fermer l’historique"
                  onClick={() => setShowContactHistory(false)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </header>
              {handledContactMessages.length ? (
                <div className="admin-inbox admin-contact-history-list">
                  {handledContactMessages.map((item) => (
                    <article className="admin-inbox-item admin-contact-card" key={item.id}>
                      <div className="admin-contact-card-heading">
                        <h3>{item.full_name}</h3>
                        <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                      </div>
                      <div className="admin-contact-links">
                        <a href={`tel:${item.phone}`}>
                          <Phone size={14} aria-hidden="true" />
                          {item.phone}
                        </a>
                        {item.email && (
                          <a href={`mailto:${item.email}`}>
                            <Mail size={14} aria-hidden="true" />
                            {item.email}
                          </a>
                        )}
                      </div>
                      <p className="admin-inbox-message">{item.message}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>Aucun message répondu pour le moment.</EmptyState>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
