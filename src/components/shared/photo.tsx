import Image, { type StaticImageData } from "next/image";
import { PHOTOS, SHIFT_KIND_PHOTO, photoPosition, type PhotoKey } from "@satisfy/core/photos";
import type { ShiftKind } from "@satisfy/core/domain";
import { cn } from "@/lib/utils";
import driver from "@/assets/photos/driver.webp";
import driverHelp from "@/assets/photos/driver-help.webp";
import harvest from "@/assets/photos/harvest.webp";
import team from "@/assets/photos/team.webp";
import warehouse from "@/assets/photos/warehouse.webp";

const SRC: Record<PhotoKey, StaticImageData> = { warehouse, driverHelp, driver, harvest, team };

/**
 * A volunteer photo cropped to fill its box. Size the box with className
 * (an aspect ratio or height) and tell the browser how wide it renders with
 * `sizes`. Inside a link or button the photo is decorative, so pass
 * `decorative` to keep its description out of the accessible name.
 */
export function Photo({
  photo,
  sizes,
  decorative,
  preload,
  className,
}: {
  photo: PhotoKey;
  sizes: string;
  decorative?: boolean;
  preload?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-muted", className)}>
      <Image
        src={SRC[photo]}
        alt={decorative ? "" : PHOTOS[photo].alt}
        fill
        sizes={sizes}
        placeholder="blur"
        preload={preload}
        className="object-cover"
        style={{ objectPosition: photoPosition(photo) }}
      />
    </span>
  );
}

export function shiftPhoto(kind: string): PhotoKey {
  return SHIFT_KIND_PHOTO[kind as ShiftKind] ?? "team";
}

/** `sizes` for a photo spanning the volunteer app's column (30rem, 1.25rem gutters). */
export const APP_COLUMN_SIZES = "(min-width: 30rem) 27.5rem, calc(100vw - 2.5rem)";
