"use client";

import { useState } from "react";

import { formatRelativeDay, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { isOverdue } from "@/domain/recurring";
import type { ExpectedCharge } from "@/domain/types";
import { confirmCharge, skipCharge } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { DateField } from "../ui/DateField";
import { STATUS_STYLES } from "../ui/styles";

function ChargeRow({ charge }: { charge: ExpectedCharge }) {
  const { today, runAction, canEdit } = useFinance();
  const overdue = isOverdue(charge, today);
  const [pickingDate, setPickingDate] = useState(false);
  const [chargedOn, setChargedOn] = useState(charge.date <= today ? charge.date : today);

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

      {canEdit ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                void runAction(`${charge.name} ya se cobró`, () =>
                  confirmCharge(charge, today),
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
                  skipCharge(charge),
                )
              }
            >
              Omitir
            </button>
          </div>
          <button
            type="button"
            aria-expanded={pickingDate}
            className="min-h-9 self-start text-sm text-ink-soft underline underline-offset-2"
            onClick={() => setPickingDate(!pickingDate)}
          >
            Se cobró otro día
          </button>
          {pickingDate ? (
            <div className="flex flex-col gap-2">
              <DateField value={chargedOn} max={today} onChange={setChargedOn} />
              <button
                type="button"
                className="btn-secondary"
                disabled={!chargedOn}
                onClick={() =>
                  void runAction(`${charge.name} se cobró el ${formatShortDate(chargedOn)}`, () =>
                    confirmCharge(charge, today, chargedOn),
                  )
                }
              >
                Guardar cobro del {chargedOn ? formatShortDate(chargedOn) : "…"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
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
