"use client";

import { useMemo } from "react";

import { buildPeriodSummary } from "@/domain/dashboard";
import { formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { getSentToPeople, getTopPlaces } from "@/domain/places";
import { useFinance } from "../FinanceProvider";
import { PeriodBar } from "../ui/PeriodBar";
import { formatCategory, getCategoryIcon } from "../ui/styles";
import { CategoryChart } from "./CategoryChart";

export function SummaryScreen() {
  const { data, today, user, viewPeriod, dashboard } = useFinance();
  const isSimple = user.layout === "simple";
  // Only the simple layout can look at an earlier month; the card layout is always current.
  const period = isSimple ? viewPeriod : dashboard.period;
  const isCurrent = period.start === dashboard.period.start;
  const when = isSimple ? (isCurrent ? "este mes" : "ese mes") : "este periodo";
  const summary = useMemo(() => buildPeriodSummary(data, today, period), [data, today, period]);
  const hasSpending = summary.expenseCount > 0;
  const topPlaces = useMemo(
    () => getTopPlaces(data.movements, data.settings, summary.period, 4),
    [data.movements, data.settings, summary.period],
  );
  const sent = useMemo(
    () => getSentToPeople(data.movements, summary.period),
    [data.movements, summary.period],
  );

  return (
    <>
      <PeriodBar title="Resumen" selectable />

      <section className="card">
        <h2 className="card-title">Gastaste {when}</h2>
        <p className="amount -mt-2 text-3xl font-semibold">{formatMoney(summary.totalSpent)}</p>
        <p className="text-sm text-ink-soft">
          {summary.expenseCount === 1 ? "1 gasto" : `${summary.expenseCount} gastos`}
        </p>
      </section>

      {hasSpending ? (
        <>
          <section className="card">
            <h2 className="card-title">En qué gastaste</h2>
            <CategoryChart categories={summary.categories} />
          </section>

          <section className="card">
            <h2 className="card-title">Top 4 gastos</h2>
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
        <p className="card text-ink-soft">Todavía no hay gastos {when}.</p>
      )}

      {topPlaces.length > 0 ? (
        <section className="card">
          <h2 className="card-title">Dónde más gastaste {when}</h2>
          <ul className="flex flex-col gap-3">
            {topPlaces.map((item) => (
              <li key={item.place} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{item.place}</span>
                  <span className="block text-sm text-ink-soft">
                    {item.count === 1 ? "1 vez" : `${item.count} veces`}
                  </span>
                </span>
                <span className="amount shrink-0 font-semibold">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sent.total > 0 ? (
        <section className="card">
          <h2 className="card-title">Enviaste a otras personas</h2>
          <p className="amount -mt-2 text-2xl font-semibold">{formatMoney(sent.total)}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {sent.people.map((item) => (
              <li key={item.place} className="flex justify-between gap-3">
                <span>{item.place}</span>
                <span className="amount font-semibold">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">Esto no cuenta como gasto.</p>
        </section>
      ) : null}

      {!isSimple && summary.income > 0 ? (
        <section className="card">
          <h2 className="card-title">Te entró {when}</h2>
          <p className="amount -mt-2 text-2xl font-semibold text-good">
            {formatMoney(summary.income)}
          </p>
        </section>
      ) : null}
    </>
  );
}
