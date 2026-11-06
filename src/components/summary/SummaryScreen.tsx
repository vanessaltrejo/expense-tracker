"use client";

import { useMemo } from "react";

import { buildMonthlySummary } from "@/domain/dashboard";
import { formatMonthName, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { useFinance } from "../FinanceProvider";
import { CategoryChart } from "./CategoryChart";

function ComparisonRow({
  label,
  current,
  previous,
  previousName,
}: {
  label: string;
  current: number;
  previous: number;
  previousName: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right">
        <span className="amount block font-semibold">{formatMoney(current)}</span>
        <span className="amount block text-xs text-ink-soft">
          {previousName}: {formatMoney(previous)}
        </span>
      </span>
    </div>
  );
}

export function SummaryScreen() {
  const { data, today } = useFinance();
  const summary = useMemo(() => buildMonthlySummary(data, today), [data, today]);
  const previousName = formatMonthName(summary.lastMonthKey);

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Resumen</h1>

      <section className="card">
        <h2 className="card-title">En qué gastas</h2>
        {summary.categories.length > 0 ? (
          <CategoryChart
            categories={summary.categories}
            thisMonthKey={summary.thisMonthKey}
            lastMonthKey={summary.lastMonthKey}
          />
        ) : (
          <p className="text-ink-soft">Todavía no hay gastos en estos dos meses.</p>
        )}
        {summary.paidByMomThisMonth > 0 ? (
          <p className="amount text-sm text-ink-soft">
            Incluye {formatMoney(summary.paidByMomThisMonth)} que pagó tu mamá este mes.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2 className="card-title">Cuánto entra y cuánto sale</h2>
        <ComparisonRow
          label="Entró"
          current={summary.incomeThisMonth}
          previous={summary.incomeLastMonth}
          previousName={previousName}
        />
        <ComparisonRow
          label="Salió"
          current={summary.outflowThisMonth}
          previous={summary.outflowLastMonth}
          previousName={previousName}
        />
        <p className="text-xs text-ink-soft">
          &ldquo;Salió&rdquo; no incluye lo que pagó tu mamá ni los pagos a la tarjeta,
          porque esas compras ya se contaron cuando las hiciste.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Rendimiento de la cajita</h2>
        <ComparisonRow
          label="Ganado"
          current={summary.yieldThisMonth}
          previous={summary.yieldLastMonth}
          previousName={previousName}
        />
      </section>

      {summary.recentStatements.length > 0 ? (
        <section className="card">
          <h2 className="card-title">Tus últimos dos cortes</h2>
          <ul className="flex flex-col gap-3">
            {summary.recentStatements.map((statement) => {
              const percent =
                summary.cardLimit > 0
                  ? (statement.statementAmount / summary.cardLimit) * 100
                  : 0;
              return (
                <li key={statement.cutDate} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-soft">
                      Corte del {formatShortDate(statement.cutDate)}
                    </span>
                    <span className="amount font-semibold">
                      {formatMoney(statement.statementAmount)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-page"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <p className="amount text-xs text-ink-soft">
                    {percent.toFixed(1)}% de tu límite de {formatMoney(summary.cardLimit)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
