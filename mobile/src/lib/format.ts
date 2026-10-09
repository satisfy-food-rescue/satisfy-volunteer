/** "2,493,428" */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-NZ").format(n);
}

/** "2.5M", "38k": the same rounding as the web impact panel. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/** "Mōrena" before midday, "Kia ora" after, as on the web. */
export function greeting(now = new Date()): string {
  return now.getHours() < 12 ? "Mōrena" : "Kia ora";
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
