"use client";

import { addDays, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { savePaymentPlan } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";

export function YieldCard() {
  const { data, dashboard, today, runAction, canEdit } = useFinance();
  const { plan, card, balances } = dashboard;

  if (balances.cajita <= 0 && dashboard.yieldThisPeriod === 0) return null;

  return (
    <section className="card">
      <div>
        <h2 className="text-sm font-semibold text-cajita">Rendimiento hasta tu día de pago</h2>
        <p className="amount text-2xl font-semibold text-cajita">
          +{formatMoney(dashboard.estimatedYield)}
        </p>
        <p className="amount mt-1 text-sm text-ink-soft">
          Hoy tienes {formatMoney(balances.cajita)} en la cajita. Para el{" "}
          {formatShortDate(plan.plannedDate)} tendrías {formatMoney(dashboard.cajitaOnPaymentDay)}.
          Interés compuesto diario al {Math.round(data.settings.annualYieldRate * 100)}% anual.
        </p>
      </div>

      {/* Read-only viewers see the day as plain, prominent text: a box would look editable. */}
      {canEdit ? (
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
                savePaymentPlan({ plannedDate }),
              );
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-ink-soft">
            Tu día de pago (antes del {formatShortDate(card.dueDate)})
          </p>
          <p className="amount text-xl font-semibold">{formatShortDate(plan.plannedDate)}</p>
        </div>
      )}

      {dashboard.yieldThisPeriod !== 0 ? (
        <p className="amount text-sm">
          <span className="text-ink-soft">Ganado en este periodo: </span>
          <span className="font-semibold">
            {formatMoney(dashboard.yieldThisPeriod)}
          </span>
        </p>
      ) : null}
    </section>
  );
}
