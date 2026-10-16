import type { ShiftKind } from "./domain";

// Photos of Satisfy volunteers at work, supplied by Satisfy Food Rescue. The
// image files live in each app (src/assets/photos on the web, assets/images/
// photos in the native app) because Next.js and Metro bundle them differently;
// what they show and how to crop them is shared here.

export const PHOTO_KEYS = ["warehouse", "driverHelp", "driver", "harvest", "team"] as const;
export type PhotoKey = (typeof PHOTO_KEYS)[number];

export type Photo = {
  /** Describes the photo for screen readers where it is not decorative. */
  alt: string;
  /** Where to anchor a crop, as percentages across and down (CSS object-position). */
  focus: { x: number; y: number };
};

export const PHOTOS: Record<PhotoKey, Photo> = {
  warehouse: {
    alt: "Volunteers in Satisfy hi-vis vests sorting boxes of bread on the warehouse rollers",
    focus: { x: 50, y: 55 },
  },
  driverHelp: {
    alt: "Two smiling volunteers loading boxes of rescued food into the back of a Satisfy van",
    focus: { x: 50, y: 40 },
  },
  driver: {
    alt: "A smiling volunteer in a beanie and hi-vis vest carrying a box of food from the Satisfy van",
    focus: { x: 50, y: 42 },
  },
  harvest: {
    alt: "A volunteer in a Satisfy vest picking fruit from a tree into a bucket",
    focus: { x: 50, y: 12 },
  },
  team: {
    alt: "Volunteers sorting and weighing rescued food at the warehouse door while a Satisfy van is loaded",
    focus: { x: 50, y: 50 },
  },
};

export const SHIFT_KIND_PHOTO: Record<ShiftKind, PhotoKey> = {
  WAREHOUSE: "warehouse",
  DRIVERS_ASSISTANT: "driverHelp",
  VOLUNTEER_DRIVER: "driver",
  HARVEST: "harvest",
};

/** The crop anchor as a CSS object-position value, such as "50% 40%". */
export function photoPosition(key: PhotoKey): string {
  const { x, y } = PHOTOS[key].focus;
  return `${x}% ${y}%`;
}
