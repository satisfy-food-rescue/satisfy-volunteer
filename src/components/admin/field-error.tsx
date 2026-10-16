import { AlertCircle } from "lucide-react";

/** A server error about one field, shown under it. Point the field at it with
 *  aria-describedby and set aria-invalid. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-status-bad">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
