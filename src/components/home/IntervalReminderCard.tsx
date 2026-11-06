"use client";

import { useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import type { IntervalReminder } from "@/domain/recurring";
import type { MovementEndpoint } from "@/domain/types";
import { logIntervalExpense } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";

function describeElapsed(days: number): string {
  const weeks = Math.floor(days / 7);
  return `Ya van ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
}

export function IntervalReminderCard({
  reminder,
}: {
  reminder: IntervalReminder;
}) {
  const { today, runAction } = useFinance();
  const [date, setDate] = useState(today);
  const { expense } = reminder;

  const log = (paidFrom: MovementEndpoint, message: string) =>
    void runAction(message, () => logIntervalExpense(expense, date, paidFrom));

  return (
    <section className="card">
      <div>
        <h2 className="font-semibold">
          {expense.name}: {describeElapsed(reminder.daysSinceLast)}
        </h2>
        <p className="amount mt-1 text-sm text-ink-soft">
          La última vez fue el {formatShortDate(reminder.lastDate)}. Normalmente{" "}
          {formatMoney(expense.normalAmount)}.
        </p>
      </div>
      <label className="field-label">
        ¿Qué día te las hiciste?
        <input
          className="field"
          type="date"
          max={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={!date}
          onClick={() => log("tarjetaNu", `${expense.name} en tu tarjeta`)}
        >
          Las pagué yo
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!date}
          onClick={() => log("mama", `${expense.name} pagadas por mamá`)}
        >
          Las pagó mamá
        </button>
      </div>
    </section>
  );
}
