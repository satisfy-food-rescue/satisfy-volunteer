// Small dependency-free bar chart. One hue for magnitude, thin rounded marks
// anchored to the baseline, direct value labels, recessive grid, and a table
// alternative rendered below for screen readers and print.
import { cn } from "@/lib/utils";

export type BarDatum = { label: string; value: number; sublabel?: string; muted?: boolean };

export function BarChart({
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
  tone?: "teal" | "green" | "orange";
}) {
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  const nice = niceCeil(top);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice);
  const W = 100;
  const H = 56;
  const padB = 10;
  const gap = 3.2;
  const bw = (W - gap * (data.length + 1)) / data.length;
  const fill = { teal: "var(--brand-teal)", green: "var(--brand-green)", orange: "var(--brand-orange)" }[tone];
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg viewBox={`0 0 ${W} ${H + padB}`} className="h-auto w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${format(d.value)}${unit}`).join(", ")}`}>
        {ticks.map((t) => {
          const y = H - (t / nice) * H;
          return <line key={t} x1={0} x2={W} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.3} />;
        })}
        {data.map((d, i) => {
          const h = (d.value / nice) * H;
          const x = gap + i * (bw + gap);
          const y = H - h;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={bw} height={h} rx={0.8} fill={fill} opacity={d.muted ? 0.35 : 1}>
                <title>{`${d.label}: ${format(d.value)}${unit}`}</title>
              </rect>
              {h > 0 && (
                <text x={x + bw / 2} y={Math.max(y - 1.5, 3)} textAnchor="middle" fontSize={3.2} fontWeight={700} fill="var(--ink)" className="tabular">
                  {format(d.value)}
                </text>
              )}
              <text x={x + bw / 2} y={H + 6} textAnchor="middle" fontSize={3} fill="var(--muted-foreground)">
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--muted-foreground)" strokeWidth={0.4} />
      </svg>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold hover:text-ink">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th className="py-1 font-semibold">Period</th><th className="py-1 text-right font-semibold">Value</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label} className="border-t border-border"><td className="py-1">{d.sublabel ?? d.label}</td><td className="py-1 text-right tabular">{format(d.value)}{unit}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

function niceCeil(n: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * pow;
}
