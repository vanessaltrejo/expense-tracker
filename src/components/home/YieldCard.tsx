"use client";

import { addDays, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { savePaymentPlan } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";

export function YieldCard() {
  const { data, dashboard, today, runAction } = useFinance();
  const { plan, card, balances } = dashboard;

  if (balances.cajita <= 0 && dashboard.yieldThisMonth === 0) return null;

  return (
    <section className="card">
      <div>
        <h2 className="text-sm font-semibold text-cajita">Rendimiento hasta tu día de pago</h2>
        <p className="amount text-2xl font-semibold text-cajita">
          +{formatMoney(dashboard.estimatedYield)}
        </p>
        <p className="amount mt-1 text-sm text-ink-soft">
          Llegarías con {formatMoney(dashboard.cajitaOnPaymentDay)} a la cajita.
          Es una estimación al {Math.round(data.settings.annualYieldRate * 100)}%
          anual.
        </p>
      </div>

      <label className="field-label">
        Tu día de pago (antes del {formatShortDate(card.dueDate)})
        <input
          className="field"
          type="date"
          min={today}
          max={addDays(card.dueDate, -1)}
          value={plan.plannedDate}
          onChange={(event) => {
            const plannedDate = event.target.value || null;
            void runAction("Día de pago actualizado", () =>
              savePaymentPlan({ ...data.paymentPlan, plannedDate }),
            );
          }}
        />
      </label>

      {dashboard.yieldThisMonth !== 0 ? (
        <p className="amount text-sm">
          <span className="text-ink-soft">Ganado este mes: </span>
          <span className="font-semibold">
            {formatMoney(dashboard.yieldThisMonth)}
          </span>
        </p>
      ) : null}
    </section>
  );
}
