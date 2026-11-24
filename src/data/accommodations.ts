export type Accommodation = {
  id: string;
  name: string;
  description: string;
  image: string;
  images: string[];
  imageAlt: string;
  capacity?: number;
  maxChildren?: number;
  amenities: string[];
  price?: number;
  beds: { quantity: number; type: string }[];
  published: boolean;
  provisional: boolean;
};

export const accommodations: Accommodation[] = [
  {
    id: "hebergement-a-confirmer",
    name: "Hébergement à préciser",
    description:
      "Les informations sur les catégories de chambres et les disponibilités sont à confirmer auprès de l’établissement.",
    image:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1000&q=80",
    images: [
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1000&q=80",
    ],
    imageAlt: "Chambre d’illustration, ne représentant pas l’établissement",
    amenities: [],
    beds: [],
    published: false,
    provisional: true,
  },
];
