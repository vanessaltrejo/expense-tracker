import {
  dateInMonth,
  getYearMonth,
  shiftMonth,
} from "./dates.ts";
import type { ExpectedCharge, FixedExpense, IsoDate } from "./types.ts";

function getChargeDateInMonth(
  expense: FixedExpense,
  year: number,
  month: number,
): IsoDate | null {
  const { schedule } = expense;
  if (schedule.kind === "monthly") {
    return dateInMonth(year, month, schedule.dayOfMonth);
  }
  if (schedule.kind === "yearly" && schedule.month === month) {
    return dateInMonth(year, month, schedule.dayOfMonth);
  }
  return null;
}

/**
 * Creates this month's and next month's missing charges and keeps the existing ones,
 * so one-month amount changes, skips and confirmations are never overwritten.
 */
export function generateExpectedCharges(
  expenses: FixedExpense[],
  existing: ExpectedCharge[],
  today: IsoDate,
): ExpectedCharge[] {
  const knownIds = new Set(existing.map((charge) => charge.id));
  const { year, month } = getYearMonth(today);
  const created: ExpectedCharge[] = [];

  for (const expense of expenses) {
    if (!expense.active) continue;

    for (const offset of [0, 1]) {
      const target = shiftMonth(year, month, offset);
      const date = getChargeDateInMonth(expense, target.year, target.month);
      if (!date || date < expense.startDate) continue;
      if (expense.endDate && date > expense.endDate) continue;

      const id = `${expense.id}:${date}`;
      if (knownIds.has(id)) continue;

      created.push({
        id,
        fixedExpenseId: expense.id,
        name: expense.name,
        date,
        amount: expense.normalAmount,
        category: expense.category,
        status: "expected",
      });
    }
  }

  return [...existing, ...created];
}

/**
 * Future charges the schedule no longer produces: an iCloud charge on the 27th that was
 * generated before its day became the 6th. They are removed, and the right ones are made.
 * A charge whose date was moved by hand (its ID keeps the scheduled date) is never touched,
 * because choosing a different day for one payment is something she does on purpose.
 */
export function findStaleCharges(
  expenses: FixedExpense[],
  charges: ExpectedCharge[],
  today: IsoDate,
): ExpectedCharge[] {
  return charges.filter((charge) => {
    if (charge.status !== "expected" || charge.date < today) return false;
    if (charge.id !== `${charge.fixedExpenseId}:${charge.date}`) return false;
    const expense = expenses.find((item) => item.id === charge.fixedExpenseId);
    if (!expense || !expense.active) return false;
    const { year, month } = getYearMonth(charge.date);
    return getChargeDateInMonth(expense, year, month) !== charge.date;
  });
}

export function isOverdue(charge: ExpectedCharge, today: IsoDate): boolean {
  return charge.status === "expected" && charge.date < today;
}
