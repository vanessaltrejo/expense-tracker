import { getCutForDate, getDueDateForCut } from "./billing.ts";
import { addDays, dateInMonth, formatShortDate, getYearMonth, shiftMonth } from "./dates.ts";
import type { IsoDate, Movement, Settings } from "./types.ts";

/**
 * A card period runs from one cut to the day before the next one (the 22nd to the 21st)
 * and is paid by the due date that follows. The whole app reads the world in these periods.
 */
export interface Period {
  /** First day of the period: the previous cut. */
  start: IsoDate;
  /** Last day of the period: the day before the cut that closes it. */
  end: IsoDate;
  /** The cut that closes the period. */
  cutDate: IsoDate;
  /** Last day to pay what was bought in the period. */
  dueDate: IsoDate;
}

type BillingDays = Pick<Settings, "cutDay" | "dueDay">;

export function getPeriodForDate(date: IsoDate, days: BillingDays): Period {
  const cutDate = getCutForDate(date, days);
  const { year, month } = getYearMonth(cutDate);
  const previous = shiftMonth(year, month, -1);

  return {
    start: dateInMonth(previous.year, previous.month, days.cutDay),
    end: addDays(cutDate, -1),
    cutDate,
    dueDate: getDueDateForCut(cutDate, days),
  };
}

export function isInPeriod(date: IsoDate, period: Period): boolean {
  return date >= period.start && date <= period.end;
}

/** "22 oct – 21 nov" */
export function formatPeriodRange(period: Period): string {
  return `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`;
}

/**
 * The periods that have something to look at, newest first: the current one, and every
 * earlier one with at least one real movement. An opening balance alone doesn't count,
 * because that row only sets a starting point.
 */
export function getPeriodsWithData(
  movements: Movement[],
  settings: BillingDays,
  today: IsoDate,
): Period[] {
  const current = getPeriodForDate(today, settings);
  const periods = new Map<IsoDate, Period>([[current.start, current]]);

  for (const movement of movements) {
    if (movement.dataKind === "dummy" || movement.type === "adjustment") continue;
    if (movement.date > today) continue;
    const period = getPeriodForDate(movement.date, settings);
    if (!periods.has(period.start)) periods.set(period.start, period);
  }

  return [...periods.values()].sort((a, b) => b.start.localeCompare(a.start));
}
