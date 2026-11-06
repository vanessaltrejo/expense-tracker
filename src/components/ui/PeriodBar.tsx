"use client";

import { useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { formatPeriodRange } from "@/domain/periods";
import { useFinance } from "../FinanceProvider";

/**
 * The title of the screen on the left and, in the opposite corner, the period it is about
 * as a small button to change it. Earlier periods can
 * be picked only where `selectable` is set and in the simple layout (calendar months with
 * their own movements); in the card layout the current period is the only one with
 * complete information.
 */
export function PeriodBar({
  title,
  selectable = false,
}: {
  title: string;
  selectable?: boolean;
}) {
  const { dashboard, user, viewPeriod, periods, selectPeriod } = useFinance();
  const isSimple = user.layout === "simple";
  const canPick = selectable && isSimple && periods.length > 1;
  const period = canPick ? viewPeriod : dashboard.period;
  const isCurrent = period.start === dashboard.period.start;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate px-1 text-2xl font-semibold">{title}</h1>
        <button
          type="button"
          aria-expanded={canPick ? isOpen : undefined}
          aria-controls="period-list"
          aria-label={`${isSimple ? "Mes" : "Periodo"}: ${formatPeriodRange(period)}`}
          className="flex h-14 min-w-40 shrink-0 items-center justify-between gap-3 rounded-2xl bg-surface px-4 text-right active:opacity-80"
          onClick={() => canPick && setIsOpen(!isOpen)}
        >
          <span className="flex flex-col items-end gap-0.5 leading-snug">
            <span className="text-[0.9375rem] font-semibold">{formatPeriodRange(period)}</span>
            <span className="text-xs text-ink-soft">
              {isSimple
                ? isCurrent
                  ? "Mes actual"
                  : "Mes anterior"
                : `Se paga el ${formatShortDate(period.dueDate)}`}
            </span>
          </span>
          {canPick ? (
            <span
              aria-hidden="true"
              className={`text-xs text-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          ) : null}
        </button>
      </div>

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
      ) : null}
    </div>
  );
}
