import { initials } from "@/lib/domain";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-green-tint text-green-deep",
  "bg-blue-tint text-blue-text",
  "bg-orange-tint text-orange-text",
  "bg-yellow-tint text-yellow-text",
  "bg-pink-tint text-pink-text",
  "bg-teal-tint text-teal-text",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function AvatarBadge({
  person,
  size = "md",
  className,
}: {
  person: { firstName: string; lastName?: string | null };
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cls = PALETTE[hash(person.firstName + (person.lastName ?? "")) % PALETTE.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-lg",
        cls,
        className,
      )}
    >
      {initials(person)}
    </span>
  );
}
