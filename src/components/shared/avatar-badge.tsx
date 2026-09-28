import { initials } from "@/lib/domain";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-green-tint text-green-deep",
  "bg-[#e6ecf7] text-[#1e3a8a]",
  "bg-[#fbe7d3] text-[#7c2d12]",
  "bg-[#ece6f7] text-[#4c1d95]",
  "bg-[#fde4ee] text-[#8a0c3c]",
  "bg-[#e3f2f4] text-[#134e4a]",
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
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
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
