export type MenuCategory =
  | "Entrées"
  | "Plats principaux"
  | "Accompagnements"
  | "Desserts"
  | "Boissons"
  | "Cocktails";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price?: number;
  category: MenuCategory;
  image?: string;
  suspended?: boolean;
};

export const menuCategories: MenuCategory[] = [
  "Entrées",
  "Plats principaux",
  "Accompagnements",
  "Desserts",
  "Boissons",
];

export const restaurantMenu: MenuItem[] = [];
