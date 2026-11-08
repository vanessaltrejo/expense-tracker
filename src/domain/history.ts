import type { Movement } from "./types.ts";

/** What the history can be narrowed to. Transfers and adjustments only show under "all". */
export type HistoryKind = "all" | "expenses" | "income";

export function matchesKind(movement: Movement, kind: HistoryKind): boolean {
  if (kind === "all") return true;
  if (kind === "income") return movement.type === "income";
  return movement.type === "expense" || movement.type === "cardExpense";
}

export interface HistoryCategories {
  expenses: string[];
  income: string[];
}

function sorted(values: Set<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Categories for the history filter, split into spending and income. They come only from
 * real expenses and income, so bookkeeping labels such as "Saldo inicial" or "Deuda mami"
 * never show up as if they were spending.
 */
export function getHistoryCategories(movements: Movement[]): HistoryCategories {
  const expenses = new Set<string>();
  const income = new Set<string>();

  for (const movement of movements) {
    if (!movement.category) continue;
    if (matchesKind(movement, "expenses")) expenses.add(movement.category);
    if (matchesKind(movement, "income")) income.add(movement.category);
  }

  return { expenses: sorted(expenses), income: sorted(income) };
}
