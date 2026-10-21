"use client";

import { useRouter } from "next/navigation";
import { OptionSelect, type Option } from "@/components/shared/option-select";

/** Which messages the Outbox shows. "all" is dropped from the URL. */
export function OutboxFilter({ value, options }: { value: string; options: Option[] }) {
  const router = useRouter();
  return (
    <OptionSelect
      aria-label="Show messages"
      value={value}
      options={options}
      onValueChange={(v) => router.replace(v === "all" ? "/admin/outbox" : `/admin/outbox?kind=${v}`)}
      className="w-auto min-w-64"
    />
  );
}
