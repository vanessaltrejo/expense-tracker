"use client";

import Link from "next/link";
import { useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { registerPayment, savePaymentPlan } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

function toInputValue(cents: number): string {
  return cents === 0 ? "" : (cents / 100).toFixed(2);
}

function describeDaysLeft(days: number): string {
  if (days === 0) return "vence hoy";
  return days === 1 ? "queda 1 día" : `quedan ${days} días`;
}

function PlanRow({ label, amount }: { label: string; amount: number }) {
  if (amount === 0) return null;
  return (
    <li className="flex justify-between gap-3 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="amount font-medium">{formatMoney(amount)}</span>
    </li>
  );
}

export function PaymentPlanCard() {
  const { data, dashboard, today, runAction } = useFinance();
  const { card, plan, projectedDue, projectedNext } = dashboard;
  const saved = data.paymentPlan;

  const [draft, setDraft] = useState<{
    cajita: string;
    cash: string;
    gift: string;
  } | null>(null);

  if (projectedDue === 0 && projectedNext === 0 && plan.reserved === 0) {
    return null;
  }

  const parsed = draft && {
    cajita: draft.cajita ? parseMoneyInput(draft.cajita) : 0,
    cash: draft.cash ? parseMoneyInput(draft.cash) : 0,
    gift: draft.gift ? parseMoneyInput(draft.gift) : 0,
  };
  const draftIsValid =
    parsed !== null &&
    parsed.cajita !== null &&
    parsed.cash !== null &&
    parsed.gift !== null;

  return (
    <section className="card">
      <div>
        <h2 className="text-sm font-semibold text-tarjeta">Plan de la tarjeta</h2>
        {card.isFullyPaid && projectedDue === 0 ? (
          <p className="mt-1 text-lg font-semibold text-good">
            <span aria-hidden="true">✓ </span>
            Pagado completo
          </p>
        ) : (
          <>
            <p className="amount text-2xl font-semibold">
              {formatMoney(projectedDue)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Por pagar antes del {formatShortDate(card.dueDate)},{" "}
              {describeDaysLeft(card.daysLeft)}.
            </p>
          </>
        )}
        {card.paidSoFar > 0 ? (
          <p className="amount mt-1 text-sm text-ink-soft">
            Ya pagaste {formatMoney(card.paidSoFar)} de{" "}
            {formatMoney(card.statementAmount)}.
          </p>
        ) : null}
        {projectedNext > 0 ? (
          <p className="amount mt-1 text-sm text-ink-soft">
            {formatMoney(projectedNext)} pasan al siguiente periodo.
          </p>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <AmountField
            label="De la cajita"
            value={draft.cajita}
            onChange={(cajita) => setDraft({ ...draft, cajita })}
            hint={`Tienes ${formatMoney(dashboard.balances.cajita)}`}
          />
          <AmountField
            label="En efectivo (se lo das a tu mamá)"
            value={draft.cash}
            onChange={(cash) => setDraft({ ...draft, cash })}
            hint={`Tienes ${formatMoney(dashboard.balances.efectivo)}`}
          />
          <AmountField
            label="Lo que pondría tu mamá de regalo"
            value={draft.gift}
            onChange={(gift) => setDraft({ ...draft, gift })}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary min-h-12"
              onClick={() => setDraft(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!draftIsValid}
              onClick={() => {
                if (!parsed || !draftIsValid) return;
                const nextPlan = {
                  ...saved,
                  fromCajita: parsed.cajita ?? 0,
                  fromCash: parsed.cash ?? 0,
                  momGift: parsed.gift ?? 0,
                };
                setDraft(null);
                void runAction("Plan guardado", () => savePaymentPlan(nextPlan));
              }}
            >
              Guardar plan
            </button>
          </div>
        </div>
      ) : (
        <>
          {plan.reserved > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-sm font-medium">Apartado</p>
              <ul className="flex flex-col gap-1">
                <PlanRow label="De la cajita" amount={saved.fromCajita} />
                <PlanRow label="En efectivo" amount={saved.fromCash} />
                <PlanRow label="Regalo de mamá" amount={saved.momGift} />
              </ul>
              {plan.unassigned > 0 ? (
                <p className="amount text-sm font-medium">
                  Te falta apartar {formatMoney(plan.unassigned)}
                </p>
              ) : null}
              {plan.cajitaShort > 0 ? (
                <p className="amount text-sm font-medium text-danger">
                  A la cajita le faltan {formatMoney(plan.cajitaShort)} para este plan.
                </p>
              ) : null}
              {plan.cashShort > 0 ? (
                <p className="amount text-sm font-medium text-danger">
                  Te faltan {formatMoney(plan.cashShort)} en efectivo para este plan.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setDraft({
                  cajita: toInputValue(saved.fromCajita),
                  cash: toInputValue(saved.fromCash),
                  gift: toInputValue(saved.momGift),
                })
              }
            >
              {plan.reserved > 0 ? "Cambiar plan" : "Apartar dinero"}
            </button>
            {plan.reserved > 0 ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  void runAction("Pago registrado", () =>
                    registerPayment(
                      {
                        date: today,
                        fromCajita: saved.fromCajita,
                        fromCash: saved.fromCash,
                        momGift: saved.momGift,
                      },
                      saved,
                    ),
                  )
                }
              >
                Ya pagué esto
              </button>
            ) : (
              <Link href="/agregar?tipo=pago" className="btn-secondary">
                Registrar pago
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}
