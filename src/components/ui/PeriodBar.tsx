"use client";

import { useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { formatPeriodRange } from "@/domain/periods";
import { useFinance } from "../FinanceProvider";

/**
 * Shows which card period the screen is about, with a button to change it. For now the
 * current period is the only one with complete information, so the list has just that one.
 */
export function PeriodBar() {
  const { dashboard, user } = useFinance();
  const isSimple = user.layout === "simple";
  const { period } = dashboard;
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
          {isSimple ? "" : `Se paga el ${formatShortDate(period.dueDate)}`}
          <span aria-hidden="true" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {isOpen ? (
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
