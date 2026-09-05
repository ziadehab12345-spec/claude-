/**
 * Calendar-date helpers.
 *
 * Every date in this system is a plain calendar date ('YYYY-MM-DD'), never a
 * timestamp. A booking for 3 October is 3 October in Cairo regardless of what
 * timezone the server or the customer's browser is in. Using `Date` objects for
 * these invites off-by-one-day bugs when the runtime is UTC and the customer is
 * at UTC+3, so dates are strings from the database to the UI and back.
 *
 * Ranges are half-open: [start_date, end_date). See db/migrations/0001_init.sql.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Number of billable units in [start, end): nights for stays, days for cars. */
export function countDays(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Half-open overlap test, mirroring the Postgres `&&` operator on daterange. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Every date in [start, end), inclusive of start, exclusive of end. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let cur = start; cur < end; cur = addDays(cur, 1)) out.push(cur);
  return out;
}

/** Today in Africa/Cairo, as a calendar date. */
export function todayInCairo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
