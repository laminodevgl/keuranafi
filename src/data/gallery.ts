export type GalleryCategory =
  | "L’établissement"
  | "Restaurant & Bar"
  | "Activités et événements"
  | "Souvenirs et archives"
  | "Nature et paysages"
  | "Coulisses et vie quotidienne";

export type GalleryPublicationStatus = "published" | "draft";

export type GalleryPhoto = {
  id: string;
  url: string;
  alt: string;
  caption: string;
  category: GalleryCategory;
  date?: string;
  order: number;
  status: GalleryPublicationStatus;
  provisional: boolean;
  width: number;
  height: number;
};

export const clientGallerySlots = [
  "home-gallery-1",
  "home-gallery-2",
  "home-gallery-3",
  "home-gallery-4",
  "home-hero",
  "home-welcome",
  "home-experience-stay",
  "home-experience-restaurant",
  "home-experience-saloum",
  "home-stay-feature",
  "home-restaurant-feature",
  "restaurant-hero",
  "restaurant-experience-1",
  "restaurant-experience-2",
  "restaurant-experience-3",
  "restaurant-proof",
  "accommodation-hero",
  "events-hero",
  "gallery-hero",
  "gallery-art-front",
  "gallery-art-back",
  "contact-hero",
  "reservation-hero",
] as const;

export type ClientGallerySlot = (typeof clientGallerySlots)[number];
export type ClientGallerySelection = Partial<
  Record<ClientGallerySlot, string>
>;

function isGeneratedPhotoLabel(value: string) {
  return /^(?:(?:extension)?photoshop[\s_-]*)?(?:images?|photos?)(?:[\s_-]*\(?\d+\)?)?$/i.test(
    value.trim(),
  );
}

export function getGalleryPhotoAlt(photo: Pick<GalleryPhoto, "alt" | "category">) {
  const alt = photo.alt.trim();
  return alt && !isGeneratedPhotoLabel(alt)
    ? alt
    : `Photographie de la catégorie ${photo.category.toLowerCase()}.`;
}

export function getGalleryPhotoLabel(
  photo: Pick<GalleryPhoto, "caption" | "category">,
) {
  const caption = photo.caption.trim();
  return caption && !isGeneratedPhotoLabel(caption)
    ? caption
    : photo.category;
}

export function getPublishedGalleryPhotos(photos: GalleryPhoto[]) {
  return photos
    .filter(
      (photo) =>
        photo.status === "published" &&
        !photo.provisional &&
        photo.url.trim(),
    )
    .sort((first, second) => first.order - second.order);
}

export function compareGalleryPhotosNewestFirst(
  first: GalleryPhoto,
  second: GalleryPhoto,
) {
  const firstDate = first.date ? Date.parse(first.date) : Number.NEGATIVE_INFINITY;
  const secondDate = second.date ? Date.parse(second.date) : Number.NEGATIVE_INFINITY;
  if (Number.isFinite(firstDate) && Number.isFinite(secondDate) && firstDate !== secondDate) {
    return secondDate - firstDate;
  }
  if (Number.isFinite(firstDate) !== Number.isFinite(secondDate)) {
    return Number.isFinite(secondDate) ? 1 : -1;
  }
  return first.order - second.order;
}

export function getHomeGalleryPhotos(
  photos: GalleryPhoto[],
  selectedPhotoIds: string[] | null = null,
) {
  const publishedPhotos = getPublishedGalleryPhotos(photos);
  if (selectedPhotoIds !== null) {
    const photosById = new Map(
      publishedPhotos.map((photo) => [photo.id, photo]),
    );
    const homePhotos: GalleryPhoto[] = [];
    const selectedIds = new Set<string>();
    for (const id of selectedPhotoIds) {
      const photo = photosById.get(id);
      if (!photo || selectedIds.has(id)) continue;
      homePhotos.push(photo);
      selectedIds.add(id);
    }

    for (const photo of publishedPhotos) {
      if (homePhotos.length >= Math.min(selectedPhotoIds.length, 4)) break;
      if (selectedIds.has(photo.id)) continue;
      homePhotos.push(photo);
      selectedIds.add(photo.id);
    }

    return homePhotos;
  }

  return publishedPhotos.slice(0, 4);
}

export function getClientGallerySelection(
  photos: GalleryPhoto[],
  savedSelection: ClientGallerySelection | null,
  selectedHomePhotoIds: string[] | null,
) {
  const publishedPhotos = getPublishedGalleryPhotos(photos);
  const photosById = new Map(
    publishedPhotos.map((photo) => [photo.id, photo]),
  );
  const assignments: ClientGallerySelection = {};
  const usedIds = new Set<string>();

  function assign(slot: ClientGallerySlot, photo?: GalleryPhoto) {
    if (!photo || usedIds.has(photo.id)) return false;
    assignments[slot] = photo.id;
    usedIds.add(photo.id);
    return true;
  }

  const preferredCategories: Partial<
    Record<ClientGallerySlot, GalleryCategory>
  > = {
    "home-hero": "Nature et paysages",
    "home-experience-restaurant": "Restaurant & Bar",
    "home-restaurant-feature": "Restaurant & Bar",
    "home-stay-feature": "L’établissement",
    "restaurant-hero": "Restaurant & Bar",
    "restaurant-experience-1": "Restaurant & Bar",
    "restaurant-experience-2": "Restaurant & Bar",
    "restaurant-experience-3": "Restaurant & Bar",
    "restaurant-proof": "Restaurant & Bar",
    "accommodation-hero": "L’établissement",
    "events-hero": "Activités et événements",
    "gallery-hero": "Nature et paysages",
    "gallery-art-front": "L’établissement",
    "gallery-art-back": "Activités et événements",
    "contact-hero": "L’établissement",
    "reservation-hero": "L’établissement",
  };

  function assignUnusedPhoto(slot: ClientGallerySlot) {
    const preferredCategory = preferredCategories[slot];
    const preferredPhoto = preferredCategory
      ? publishedPhotos.find(
          (photo) =>
            photo.category === preferredCategory && !usedIds.has(photo.id),
        )
      : undefined;
    const photo =
      preferredPhoto ?? publishedPhotos.find((item) => !usedIds.has(item.id));
    assign(slot, photo);
  }

  for (const slot of clientGallerySlots) {
    const savedPhotoId = savedSelection?.[slot];
    if (savedPhotoId) assign(slot, photosById.get(savedPhotoId));
  }

  if (savedSelection === null) {
    for (const [index, photoId] of (selectedHomePhotoIds ?? []).entries()) {
      if (index >= 4) break;
      const slot = `home-gallery-${index + 1}` as ClientGallerySlot;
      assign(slot, photosById.get(photoId));
    }

    for (const slot of clientGallerySlots) {
      if (assignments[slot]) continue;
      assignUnusedPhoto(slot);
    }
  } else {
    const newHeroSlots: ClientGallerySlot[] = [
      "accommodation-hero",
      "events-hero",
      "gallery-hero",
      "contact-hero",
      "reservation-hero",
    ];
    const slotsToFill: ClientGallerySlot[] = [
      "home-stay-feature",
      "restaurant-proof",
      "gallery-art-front",
      "gallery-art-back",
      ...newHeroSlots,
    ];
    for (const slot of slotsToFill) {
      if (!assignments[slot]) assignUnusedPhoto(slot);
    }
  }

  return assignments;
}

export function getClientGalleryPhotos(
  photos: GalleryPhoto[],
  savedSelection: ClientGallerySelection | null,
  selectedHomePhotoIds: string[] | null,
) {
  const selection = getClientGallerySelection(
    photos,
    savedSelection,
    selectedHomePhotoIds,
  );
  const photosById = new Map(
    getPublishedGalleryPhotos(photos).map((photo) => [photo.id, photo]),
  );
  const resolvedPhotos: Partial<Record<ClientGallerySlot, GalleryPhoto>> = {};
  for (const slot of clientGallerySlots) {
    const photoId = selection[slot];
    const photo = photoId ? photosById.get(photoId) : undefined;
    if (photo) resolvedPhotos[slot] = photo;
  }
  return resolvedPhotos;
}

export function getClientGalleryPhotoUsage(
  photos: GalleryPhoto[],
  savedSelection: ClientGallerySelection | null,
  selectedHomePhotoIds: string[] | null,
) {
  const resolvedPhotos = getClientGalleryPhotos(
    photos,
    savedSelection,
    selectedHomePhotoIds,
  );
  return clientGallerySlots.flatMap((slot) => {
    const photo = resolvedPhotos[slot];
    return photo ? [{ slot, photo }] : [];
  });
}

export const galleryCategories: GalleryCategory[] = [
  "L’établissement",
  "Restaurant & Bar",
  "Activités et événements",
  "Souvenirs et archives",
  "Nature et paysages",
  "Coulisses et vie quotidienne",
];

export const galleryPhotos: GalleryPhoto[] = [];
