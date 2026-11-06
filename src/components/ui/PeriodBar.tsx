"use client";

import { useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { formatPeriodRange } from "@/domain/periods";
import { useFinance } from "../FinanceProvider";

/**
 * Shows which period the screen is about, with a button to change it. Earlier periods can
 * be picked only where `selectable` is set and in the simple layout (calendar months with
 * their own movements); in the card layout the current period is the only one with
 * complete information.
 */
export function PeriodBar({ selectable = false }: { selectable?: boolean }) {
  const { dashboard, user, viewPeriod, periods, selectPeriod } = useFinance();
  const isSimple = user.layout === "simple";
  const canPick = selectable && isSimple && periods.length > 1;
  const period = canPick ? viewPeriod : dashboard.period;
  const isCurrent = period.start === dashboard.period.start;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="period-list"
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2 text-left active:opacity-80"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="min-w-0">
          <span className="block text-xs text-ink-soft">{isSimple ? "Mes" : "Periodo"}</span>
          <span className="block font-semibold">{formatPeriodRange(period)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
          {isSimple ? (isCurrent ? "" : "Mes anterior") : `Se paga el ${formatShortDate(period.dueDate)}`}
          <span aria-hidden="true" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {isOpen && canPick ? (
        <div id="period-list" className="card mt-2 gap-2">
          {periods.map((item) => {
            const isChosen = item.start === period.start;
            return (
              <button
                key={item.start}
                type="button"
                aria-pressed={isChosen}
                className="chip justify-between rounded-xl"
                onClick={() => {
                  selectPeriod(item.start === dashboard.period.start ? null : item);
                  setIsOpen(false);
                }}
              >
                <span>{formatPeriodRange(item)}</span>
                <span className="text-xs font-medium">
                  {item.start === dashboard.period.start ? "Actual" : ""}
                  {isChosen ? " ✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : isOpen ? (
        <div id="period-list" className="card mt-2 gap-2">
          <p className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent">
            <span>{formatPeriodRange(period)}</span>
            <span className="text-xs font-medium">Actual ✓</span>
          </p>
          <p className="text-xs text-ink-soft">
            {isSimple ? "Los meses anteriores" : "Los periodos anteriores"} se podrán ver aquí cuando tengan su información completa.
          </p>
        </div>
      ) : null}
    </div>
  );
}
