import type { IsoDate } from "./types.ts";

const MS_PER_DAY = 86_400_000;
const USER_TIME_ZONE = "America/Mexico_City";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parts(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toUtcMs(date: IsoDate): number {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Today on the user's calendar, even when the code runs on a server in another timezone. */
export function getTodayInMexico(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

export function daysBetween(start: IsoDate, end: IsoDate): number {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Builds a date, moving day 29-31 to the last day of shorter months. */
export function dateInMonth(year: number, month: number, day: number): IsoDate {
  const clampedDay = Math.min(day, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(clampedDay)}`;
}

export function getYearMonth(date: IsoDate): { year: number; month: number } {
  const { year, month } = parts(date);
  return { year, month };
}

export function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + offset;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function formatShortDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(toUtcMs(date))
    .replace(".", "");
}

/** Header for a day in a list, like "Jueves 5 nov". */
export function formatDayHeader(date: IsoDate): string {
  const text = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(toUtcMs(date))
    .replace(/[.,]/g, "")
    .replace(" de ", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(toUtcMs(date));
}

/** Wording for an upcoming charge: "Hoy", "Mañana", "En 3 días", "Hace 2 días". */
export function formatRelativeDay(date: IsoDate, today: IsoDate): string {
  const days = daysBetween(today, date);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}
