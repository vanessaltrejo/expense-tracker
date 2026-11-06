import { addDays, daysBetween, dateInMonth, getYearMonth, shiftMonth } from "./dates.ts";
import { getCardDebt, getOpeningDates } from "./ledger.ts";
import type {
  Cents,
  IsoDate,
  Movement,
  Settings,
  StatementRecord,
} from "./types.ts";

type BillingDays = Pick<Settings, "cutDay" | "dueDay">;

export function getDueDateForCut(cutDate: IsoDate, days: BillingDays): IsoDate {
  const { year, month } = getYearMonth(cutDate);
  const dueMonth =
    days.dueDay > days.cutDay
      ? { year, month }
      : shiftMonth(year, month, 1);
  return dateInMonth(dueMonth.year, dueMonth.month, days.dueDay);
}

/**
 * The cut a purchase belongs to. Nu closes the statement as the cut day starts,
 * so a purchase made on the cut day already belongs to the next one.
 */
export function getCutForDate(date: IsoDate, days: BillingDays): IsoDate {
  const { year, month } = getYearMonth(date);
  const cutThisMonth = dateInMonth(year, month, days.cutDay);
  if (date < cutThisMonth) return cutThisMonth;

  const next = shiftMonth(year, month, 1);
  return dateInMonth(next.year, next.month, days.cutDay);
}

function getLastClosedCut(today: IsoDate, days: BillingDays): IsoDate {
  const { year, month } = getYearMonth(today);
  const cutThisMonth = dateInMonth(year, month, days.cutDay);
  if (cutThisMonth <= today) return cutThisMonth;

  const previous = shiftMonth(year, month, -1);
  return dateInMonth(previous.year, previous.month, days.cutDay);
}

export interface CardStatus {
  /** "closed": the cut already happened and its bill is being paid. "open": still accumulating. */
  phase: "open" | "closed";
  cutDate: IsoDate;
  dueDate: IsoDate;
  statementAmount: Cents;
  paidSoFar: Cents;
  remaining: Cents;
  /** Debt that belongs to the following period. */
  nextPeriod: Cents;
  daysLeft: number;
  isFullyPaid: boolean;
}

function getPaymentsBetween(
  movements: Movement[],
  fromDate: IsoDate,
  upToDate: IsoDate,
): Cents {
  return movements
    .filter(
      (movement) =>
        movement.dataKind === "real" &&
        movement.to === "tarjetaNu" &&
        movement.type !== "adjustment" &&
        movement.date >= fromDate &&
        movement.date <= upToDate,
    )
    .reduce((total, movement) => total + movement.amount, 0);
}

function getDebtAtCut(
  movements: Movement[],
  cutDate: IsoDate,
  records: StatementRecord[],
): Cents | null {
  const record = records.find((item) => item.cutDate === cutDate);
  if (record) return record.statementAmount;

  const cardOpening = getOpeningDates(movements).tarjetaNu;
  if (cardOpening && cutDate < cardOpening) return null;

  // The statement holds everything up to the day before the cut.
  return Math.max(0, getCardDebt(movements, addDays(cutDate, -1)));
}

export function getCardStatus(
  movements: Movement[],
  records: StatementRecord[],
  days: BillingDays,
  today: IsoDate,
): CardStatus {
  const debt = getCardDebt(movements, today);
  const lastCut = getLastClosedCut(today, days);
  const lastDue = getDueDateForCut(lastCut, days);

  if (today <= lastDue) {
    const statement = getDebtAtCut(movements, lastCut, records);
    // Without a known statement, all current debt is treated as due: the safer assumption.
    const statementAmount = statement ?? Math.max(0, debt);
    const paidSoFar = getPaymentsBetween(movements, lastCut, today);
    const remaining = Math.max(0, statementAmount - paidSoFar);

    return {
      phase: "closed",
      cutDate: lastCut,
      dueDate: lastDue,
      statementAmount,
      paidSoFar,
      remaining,
      nextPeriod: Math.max(0, debt - remaining),
      daysLeft: daysBetween(today, lastDue),
      isFullyPaid: statementAmount > 0 && remaining === 0,
    };
  }

  const nextCut = getCutForDate(today, days);
  const nextDue = getDueDateForCut(nextCut, days);
  const owed = Math.max(0, debt);

  return {
    phase: "open",
    cutDate: nextCut,
    dueDate: nextDue,
    statementAmount: owed,
    paidSoFar: 0,
    remaining: owed,
    nextPeriod: 0,
    daysLeft: daysBetween(today, nextDue),
    isFullyPaid: false,
  };
}
