/** Dates are plain "YYYY-MM-DD" strings in the user's own time zone. No Date objects cross the data layer. */
export type ISODate = string;

export function todayIn(timeZone: string, now = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUTC(d: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = toUTC(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function isValidDate(d: unknown): d is ISODate {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(toUTC(d).getTime()) && toUTC(d).toISOString().slice(0, 10) === d;
}

/** Monday of the week containing d. */
export function weekStart(d: ISODate): ISODate {
  const dow = (toUTC(d).getUTCDay() + 6) % 7;
  return addDays(d, -dow);
}

export function formatDay(d: ISODate, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(toUTC(d));
}

export function relativeLabel(d: ISODate, today: ISODate) {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return formatDay(d, { weekday: "long" });
}
