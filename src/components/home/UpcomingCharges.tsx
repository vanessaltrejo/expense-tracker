"use client";

import { formatRelativeDay, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { isOverdue } from "@/domain/recurring";
import type { ExpectedCharge } from "@/domain/types";
import { confirmCharge, skipCharge } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { STATUS_STYLES } from "../ui/styles";

function ChargeRow({ charge }: { charge: ExpectedCharge }) {
  const { data, today, runAction } = useFinance();
  const overdue = isOverdue(charge, today);
  const charges = data.expectedCharges;

  return (
    <li className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{charge.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            <span
              className={`pill ${STATUS_STYLES[overdue ? "overdue" : "expected"].classes}`}
            >
              {STATUS_STYLES[overdue ? "overdue" : "expected"].label}
            </span>
            {formatRelativeDay(charge.date, today)} ·{" "}
            {formatShortDate(charge.date)}
          </p>
        </div>
        <p className="amount shrink-0 font-semibold">
          {formatMoney(charge.amount)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            void runAction(`${charge.name} ya se cobró`, () =>
              confirmCharge(charge, charges, today),
            )
          }
        >
          Ya se cobró
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            void runAction(`${charge.name} omitido este mes`, () =>
              skipCharge(charge, charges),
            )
          }
        >
          Omitir
        </button>
      </div>
    </li>
  );
}

export function UpcomingCharges() {
  const { dashboard } = useFinance();
  if (dashboard.upcomingCharges.length === 0) return null;

  return (
    <section className="card">
      <h2 className="card-title">Próximos cobros</h2>
      <ul className="flex flex-col gap-3">
        {dashboard.upcomingCharges.map((charge) => (
          <ChargeRow key={charge.id} charge={charge} />
        ))}
      </ul>
    </section>
  );
}
