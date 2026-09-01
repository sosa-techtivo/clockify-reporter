/** Plain calendar-date value (no time, no timezone) so range/coverage math never drifts
 * with the browser's local timezone or DST. All arithmetic goes through Date.UTC. */
export interface DateOnly {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Parses a strict "YYYY-MM-DD" string into a DateOnly, rejecting anything that isn't a
 * real calendar date (e.g. 2026-02-30). Returns null on any malformed/invalid input. */
export function parseIsoDate(value: string): DateOnly | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const utc = Date.UTC(year, month - 1, day);
  const d = new Date(utc);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function formatIsoDate(d: DateOnly): string {
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Negative for a < b, 0 for equal, positive for a > b. */
export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return toOrdinal(a) - toOrdinal(b);
}

export function isSameDay(a: DateOnly, b: DateOnly): boolean {
  return compareDateOnly(a, b) === 0;
}

export function isSameMonth(a: DateOnly, b: DateOnly): boolean {
  return a.year === b.year && a.month === b.month;
}

export function addDays(d: DateOnly, days: number): DateOnly {
  const next = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function firstDayOfMonth(year: number, month: number): DateOnly {
  return { year, month, day: 1 };
}

export function lastDayOfMonth(year: number, month: number): DateOnly {
  return { year, month, day: daysInMonth(year, month) };
}

/** Sortable/comparable integer form, e.g. 2026-07-04 -> 20260704. Internal use only. */
function toOrdinal(d: DateOnly): number {
  return d.year * 10000 + d.month * 100 + d.day;
}
