// Organisation facts used across the demo. Impact stats are the public
// figures from satisfyfoodrescue.org.nz at the time of building.

export const ORG = {
  name: "Satisfy Food Rescue",
  shortName: "Satisfy",
  base: "Rangiora, North Canterbury",
  website: "https://www.satisfyfoodrescue.org.nz",
  coverage: "Waimakariri, Hurunui and Christchurch City",
  coordinatorEmail: "volunteers@satisfyfoodrescue.org.nz",
};

export const IMPACT = {
  kgRescued: 2_493_428,
  meals: 6_477_079,
  co2Tonnes: 1_160,
  co2Period: "2025/26",
  yearsRunning: 10,
};

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-NZ").format(n);
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
