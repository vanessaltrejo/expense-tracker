"use client";

import { useState } from "react";

import { formatRelativeDay, formatShortDate } from "@/domain/dates";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { isOverdue } from "@/domain/recurring";
import type { ExpectedCharge } from "@/domain/types";
import {
  changeChargeAmount,
  confirmCharge,
  skipCharge,
} from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { STATUS_STYLES } from "../ui/styles";

function ChargeRow({ charge }: { charge: ExpectedCharge }) {
  const { data, today, runAction } = useFinance();
  const [editedAmount, setEditedAmount] = useState<string | null>(null);
  const overdue = isOverdue(charge, today);
  const charges = data.expectedCharges;

  const parsedAmount = editedAmount === null ? null : parseMoneyInput(editedAmount);

  return (
    <li className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{charge.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            <span className={`pill ${STATUS_STYLES[overdue ? "overdue" : "expected"].classes}`}>
              {STATUS_STYLES[overdue ? "overdue" : "expected"].label}
            </span>
            {formatRelativeDay(charge.date, today)} · {formatShortDate(charge.date)}
          </p>
        </div>
        <button
          type="button"
          className="amount -my-2 min-h-11 shrink-0 font-semibold underline decoration-line underline-offset-4"
          aria-label={`Cambiar el monto de ${charge.name} solo este mes`}
          onClick={() => setEditedAmount((charge.amount / 100).toFixed(2))}
        >
          {formatMoney(charge.amount)}
        </button>
      </div>

      {editedAmount !== null ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <AmountField
              label="Monto solo de este mes"
              value={editedAmount}
              onChange={setEditedAmount}
            />
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={parsedAmount === null || parsedAmount === 0}
            onClick={() => {
              if (parsedAmount === null) return;
              setEditedAmount(null);
              void runAction("Monto cambiado solo este mes", () =>
                changeChargeAmount(charge, charges, parsedAmount),
              );
            }}
          >
            Guardar
          </button>
        </div>
      ) : (
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
      )}
    </li>
  );
}

export function UpcomingCharges() {
  const { dashboard } = useFinance();
  if (dashboard.upcomingCharges.length === 0) return null;

  return (
    <section className="card">
      <div>
        <h2 className="card-title">Próximos cobros</h2>
        <p className="text-xs text-ink-soft">Toca el monto si este mes cambia.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {dashboard.upcomingCharges.map((charge) => (
          <ChargeRow key={charge.id} charge={charge} />
        ))}
      </ul>
    </section>
  );
}
