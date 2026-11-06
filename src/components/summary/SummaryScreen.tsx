"use client";

import { useMemo } from "react";

import { buildPeriodSummary } from "@/domain/dashboard";
import { formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { useFinance } from "../FinanceProvider";
import { PeriodBar } from "../ui/PeriodBar";
import { formatCategory, getCategoryIcon } from "../ui/styles";
import { CategoryChart } from "./CategoryChart";

export function SummaryScreen() {
  const { data, today } = useFinance();
  const summary = useMemo(() => buildPeriodSummary(data, today), [data, today]);
  const hasSpending = summary.expenseCount > 0;

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Resumen</h1>
      <PeriodBar />

      <section className="card">
        <h2 className="card-title">Gastaste en este periodo</h2>
        <p className="amount -mt-2 text-3xl font-semibold">{formatMoney(summary.totalSpent)}</p>
        <p className="text-sm text-ink-soft">
          {summary.expenseCount === 1 ? "1 gasto" : `${summary.expenseCount} gastos`}
          {summary.paidByMom > 0
            ? ` · ${formatMoney(summary.paidByMom)} los pagó tu mamá`
            : ""}
        </p>
      </section>

      {hasSpending ? (
        <>
          <section className="card">
            <h2 className="card-title">En qué gastaste</h2>
            <CategoryChart categories={summary.categories} />
          </section>

          <section className="card">
            <h2 className="card-title">Lo más grande</h2>
            <ul className="flex flex-col gap-3">
              {summary.largest.map((movement) => (
                <li key={movement.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {movement.note || formatCategory(movement.category ?? "otros")}
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {getCategoryIcon(movement.category)}{" "}
                      {formatCategory(movement.category ?? "otros")} ·{" "}
                      {formatShortDate(movement.date)}
                    </span>
                  </span>
                  <span className="amount shrink-0 font-semibold">
                    {formatMoney(movement.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="card text-ink-soft">Todavía no hay gastos en este periodo.</p>
      )}

      {summary.income > 0 ? (
        <section className="card">
          <h2 className="card-title">Te entró en este periodo</h2>
          <p className="amount -mt-2 text-2xl font-semibold text-good">
            {formatMoney(summary.income)}
          </p>
        </section>
      ) : null}
    </>
  );
}
