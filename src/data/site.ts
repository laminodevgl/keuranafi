export type SiteSettings = {
  name: string;
  subtitle: string;
  location: string;
  whatsappNumber: string;
  whatsappConfirmed: boolean;
  phoneNumber: string;
  email: string;
  address: string;
  paymentAccounts: PaymentAccount[];
  coordinates: { latitude: number; longitude: number } | null;
  openingHours: { service: string; hours: string }[];
  socialLinks: { label: string; url: string }[];
};

export type PaymentOperator = "wave" | "orange_money" | "free_money";

export type PaymentAccount = {
  id: string;
  operator: PaymentOperator;
  number: string;
};

export const site: SiteSettings = {
  name: "Keur Ana-Fi",
  subtitle: "Maison des Bolongs",
  location: "Sokone · Sine-Saloum · Sénégal",
  whatsappNumber: "",
  whatsappConfirmed: false,
  phoneNumber: "",
  email: "",
  address: "",
  paymentAccounts: [],
  coordinates: null,
  openingHours: [],
  socialLinks: [],
};

export const navigation = [
  { label: "Accueil", href: "/" },
  { label: "Hébergement", href: "/hebergement" },
  { label: "Restaurant & Bar", href: "/restaurant" },
  { label: "Galerie", href: "/galerie" },
  { label: "Événements", href: "/evenements" },
  { label: "Contact", href: "/contact" },
];

