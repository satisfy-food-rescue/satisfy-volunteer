// Calendar-date helpers, shared by the web app and the native app so both show
// dates the same way. Pure TypeScript with no imports. Dates are handled as
// "YYYY-MM-DD" strings or as Date objects at UTC midnight (what the DB stores).
// "Today" is read in Pacific/Auckland so the demo behaves the same wherever
// the server runs.

export const NZ_TZ = "Pacific/Auckland";
const DAY_MS = 86_400_000;

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NZ_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return dateToISO(new Date(isoToDate(iso).getTime() + days * DAY_MS));
}

export function addMonths(iso: string, months: number): string {
  const d = isoToDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return dateToISO(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (isoToDate(toISO).getTime() - isoToDate(fromISO).getTime()) / DAY_MS,
  );
}

/** ISO weekday: 1 = Monday .. 7 = Sunday. */
export function weekdayOf(iso: string): number {
  const d = isoToDate(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function isWeekday(iso: string): boolean {
  return weekdayOf(iso) <= 5;
}

/** Monday of the week containing `iso`. */
export function weekMonday(iso: string): string {
  return addDays(iso, 1 - weekdayOf(iso));
}

/** Monday..Friday for the week containing `iso`. */
export function workWeek(iso: string): string[] {
  const mon = weekMonday(iso);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return dateToISO(new Date(Date.UTC(y, m, 0)));
}

export const WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Tue 6 Oct" */
export function formatDay(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_SHORT[weekdayOf(iso)]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "Mon 5 Oct to Fri 9 Oct", or just "Mon 5 Oct" for a single day. */
export function formatDayRange(startISO: string, endISO: string): string {
  return startISO === endISO ? formatDay(startISO) : `${formatDay(startISO)} to ${formatDay(endISO)}`;
}

/** "6 Oct" */
export function formatDayShort(iso: string): string {
  const d = isoToDate(iso);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** "Tuesday 6 October 2026" */
export function formatDayLong(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAY_LONG[weekdayOf(iso)]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "6 October 2026" */
export function formatDate(iso: string): string {
  const d = isoToDate(iso);
  return `${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "October 2026" */
export function formatMonth(iso: string): string {
  const d = isoToDate(iso);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Oct" */
export function formatMonthShort(iso: string): string {
  return MONTH_SHORT[isoToDate(iso).getUTCMonth()];
}

/** "9:00am" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/** "9am - 12pm" */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function durationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

/** Relative day label: "Today", "Tomorrow", else "Tue 6 Oct". */
export function relativeDay(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDay(iso);
}

/** "in 12 days", "3 days ago", "today" */
export function relativeDays(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${-diff} days ago`;
}

/** Instant formatting in NZ time: "Tue 6 Oct, 10:30am" */
export function formatInstant(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: NZ_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const time = `${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase().replace(/\./g, "")}`;
  return `${get("weekday")} ${get("day")} ${get("month")}, ${time}`;
}

/** Time only in NZ time: "10:30am" */
export function formatInstantTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: NZ_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase().replace(/\./g, "")}`;
}

/** Calendar date (NZ) of an instant. */
export function instantToISO(d: Date): string {
  return todayISO(d);
}

/** Build an instant from an NZ calendar date and wall-clock time (DST-aware). */
export function nzInstant(iso: string, hhmm: string): Date {
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = isoToDate(iso).getTime() + (h * 60 + mi) * 60_000;
  const offset = (at: Date) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: NZ_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return (
      Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) -
      at.getTime()
    );
  };
  const o1 = offset(new Date(guess));
  let result = new Date(guess - o1);
  const o2 = offset(result);
  if (o2 !== o1) result = new Date(guess - o2);
  return result;
}
