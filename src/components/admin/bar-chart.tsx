// Small dependency-free bar charts. One hue for magnitude, rounded marks
// anchored to the baseline, direct value labels and a recessive grid. Drawn
// with HTML rather than a scaled SVG so the text stays at body size however
// wide the card is, and long labels wrap instead of running into each other.
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number; sublabel?: string; muted?: boolean };

const FILL = { teal: "bg-teal", green: "bg-green", orange: "bg-orange" } as const;

/** Vertical bars for a short series such as six months, with a table
 *  alternative below for screen readers and print. */
export function BarChart({
  data,
  unit = "",
  format = (n: number) => String(n),
  max,
  title,
  labelHeader,
  valueHeader = "Value",
  className,
  tone = "teal",
}: {
  data: BarDatum[];
  unit?: string;
  format?: (n: number) => string;
  max?: number;
  title: string;
  /** Heading for the label column of the table alternative, such as "Month" or "Module". */
  labelHeader: string;
  valueHeader?: string;
  className?: string;
  tone?: keyof typeof FILL;
}) {
  const nice = niceCeil(Math.max(max ?? 0, ...data.map((d) => d.value), 1));
  const pct = (n: number) => `${(n / nice) * 100}%`;
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div role="img" aria-label={`${title}: ${data.map((d) => `${d.sublabel ?? d.label} ${format(d.value)}${unit}`).join(", ")}`}>
        {/* The top 1.75rem is headroom, so a full-height bar's value label still fits. */}
        <div className="relative h-52 border-b border-muted-foreground/70">
          <div className="absolute inset-x-0 bottom-0 top-7">
            {[0.25, 0.5, 0.75, 1].map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: pct(t * nice) }} />
            ))}
            <div className="absolute inset-0 flex gap-3 px-3">
              {data.map((d) => (
                <div key={d.label} className="relative flex-1">
                  <div className={cn("absolute inset-x-0 bottom-0 rounded-t-md", FILL[tone], d.muted && "opacity-35")} style={{ height: pct(d.value) }} title={`${d.sublabel ?? d.label}: ${format(d.value)}${unit}`} />
                  <span className="absolute inset-x-0 mb-1 text-center font-display text-sm font-bold text-ink tabular" style={{ bottom: pct(d.value) }}>
                    {format(d.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-3 px-3" aria-hidden>
          {data.map((d) => (
            <span key={d.label} className="min-w-0 flex-1 text-center text-sm leading-tight text-muted-foreground">{d.label}</span>
          ))}
        </div>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold hover:text-ink">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th scope="col" className="py-1 font-semibold">{labelHeader}</th><th scope="col" className="py-1 text-right font-semibold">{valueHeader}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label} className="border-t border-border"><td className="py-1">{d.sublabel ?? d.label}</td><td className="py-1 text-right tabular">{format(d.value)}{unit}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

/** Horizontal bars for named categories, such as training modules: the full
 *  name on the left, the value on the right. It is a plain list, so it needs
 *  no separate table alternative. */
export function HorizontalBarChart({
  data,
  unit = "",
  format = (n: number) => String(n),
  max,
  title,
  className,
  tone = "teal",
}: {
  data: BarDatum[];
  unit?: string;
  format?: (n: number) => string;
  max?: number;
  title: string;
  className?: string;
  tone?: keyof typeof FILL;
}) {
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  return (
    <ul aria-label={title} className={cn("flex flex-col gap-3", className)}>
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3">
          <span className="text-sm leading-tight text-ink">{d.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className={cn("block h-full rounded-full", FILL[tone], d.muted && "opacity-35")} style={{ width: `${(d.value / top) * 100}%` }} />
          </span>
          <span className="text-right font-display text-sm font-bold text-ink tabular">{format(d.value)}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

/** The next round number up, so the tallest bar fills most of the height
 *  and the quarter grid lines land on readable values. */
function niceCeil(n: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((s) => n <= s * pow + 1e-9)!;
  return step * pow;
}
