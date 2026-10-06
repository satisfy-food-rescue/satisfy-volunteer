"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDay } from "@/lib/dates"

// The app passes dates around as "YYYY-MM-DD" strings. DayPicker works with
// local-time Date objects, so convert at the edge without going through UTC.
function isoToLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// "Fri 2 Oct", with the year only when it is not this year, so it fits a
// half-width field on a phone.
function label(iso: string): string {
  const year = iso.slice(0, 4)
  return year === String(new Date().getFullYear()) ? formatDay(iso) : `${formatDay(iso)} ${year}`
}

function localToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string
  /** "YYYY-MM-DD" or "" for no date. */
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
  "aria-label"?: string
}) {
  const [open, setOpen] = React.useState(false)
  // A <label> overrides the button text as its name, so expose the chosen
  // date as the description for screen readers.
  const valueId = React.useId()
  const selected = value ? isoToLocal(value) : undefined
  const disabled = [
    ...(min ? [{ before: isoToLocal(min) }] : []),
    ...(max ? [{ after: isoToLocal(max) }] : []),
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={valueId}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-base text-ink transition-colors outline-none hover:border-green/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring",
          className
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-green-text" aria-hidden />
        <span id={valueId} className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
          {value ? label(value) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected ?? (min ? isoToLocal(min) : undefined)}
          disabled={disabled}
          onSelect={(d) => {
            if (!d) return
            onChange(localToISO(d))
            setOpen(false)
          }}
          className="[--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  )
}
