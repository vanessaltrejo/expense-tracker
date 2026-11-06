import {
  addDays,
  dateInMonth,
  daysBetween,
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

export function isOverdue(charge: ExpectedCharge, today: IsoDate): boolean {
  return charge.status === "expected" && charge.date < today;
}

export interface IntervalReminder {
  expense: FixedExpense;
  lastDate: IsoDate;
  dueDate: IsoDate;
  daysSinceLast: number;
  isDue: boolean;
}

/** Reminders for expenses with no fixed day, such as nails every 3 weeks. */
export function getIntervalReminders(
  expenses: FixedExpense[],
  today: IsoDate,
): IntervalReminder[] {
  const reminders: IntervalReminder[] = [];

  for (const expense of expenses) {
    if (!expense.active || expense.schedule.kind !== "everyNDays") continue;

    const { days, lastDate } = expense.schedule;
    const dueDate = addDays(lastDate, days);
    reminders.push({
      expense,
      lastDate,
      dueDate,
      daysSinceLast: daysBetween(lastDate, today),
      isDue: today >= dueDate,
    });
  }

  return reminders;
}
