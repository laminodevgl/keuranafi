export type EventItem = {
  id?: string;
  title: string;
  date: string;
  time?: string;
  description: string;
  participation?: string;
  location?: string;
  image?: string;
};

export const events: EventItem[] = [];
