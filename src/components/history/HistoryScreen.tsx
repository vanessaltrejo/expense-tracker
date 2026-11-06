"use client";

import { useMemo, useState } from "react";

import {
  formatDayHeader,
  formatMonthName,
  monthKey,
  previousMonthKey,
} from "@/domain/dates";
import {
  getHistoryCategories,
  type HistoryKind,
  matchesKind,
} from "@/domain/history";
import { ENDPOINT_LABELS, getOpeningDates, isMomDebtEntry } from "@/domain/ledger";
import { formatMoney } from "@/domain/money";
import type {
  Movement,
  MovementEndpoint,
  MovementType,
  PocketId,
} from "@/domain/types";
import { changeMovementCategory, deleteMovement } from "@/services/financeService";
import { PENDING_CATEGORY } from "@/data/seedData";
import { useFinance } from "../FinanceProvider";
import { SHEET_URL } from "../sync/sheetUrl";
import { formatCategory, getCategoryIcon, TYPE_STYLES } from "../ui/styles";

/** Only the pockets that hold or owe money. Deuda mami has its own card on Home. */
const ENDPOINTS: MovementEndpoint[] = ["cajita", "banorte", "efectivo", "tarjetaNu"];

const TYPE_LABELS: Record<MovementType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  cardExpense: "Gasto con tarjeta",
  transfer: "Transferencia",
  adjustment: "Ajuste",
};

function describeRoute(movement: Movement): string {
  const from = movement.from ? ENDPOINT_LABELS[movement.from] : null;
  const to = movement.to ? ENDPOINT_LABELS[movement.to] : null;
  if (from && to) return `${from} → ${to}`;
  return from ?? to ?? "";
}

function getSign(movement: Movement): string {
  if (movement.type === "income") return "+";
  if (movement.type === "expense" || movement.type === "cardExpense") return "−";
  if (movement.type === "adjustment") return movement.to ? "+" : "−";
  return "";
}

function isBeforeOpening(
  movement: Movement,
  openings: Partial<Record<PocketId, string>>,
): boolean {
  return [movement.from, movement.to].some((endpoint) => {
    if (!endpoint || endpoint === "mama") return false;
    const opening = openings[endpoint];
    return Boolean(opening && movement.date < opening);
  });
}

/** Splits a list already sorted from newest to oldest into one group per day. */
const KIND_OPTIONS: { id: HistoryKind; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "expenses", label: "Gastos" },
  { id: "income", label: "Ingresos" },
];

function groupByDay(movements: Movement[]): { date: string; movements: Movement[] }[] {
  const days: { date: string; movements: Movement[] }[] = [];
  for (const movement of movements) {
    const last = days[days.length - 1];
    if (last && last.date === movement.date) last.movements.push(movement);
    else days.push({ date: movement.date, movements: [movement] });
  }
  return days;
}

function MovementRow({
  movement,
  summaryOnly,
}: {
  movement: Movement;
  summaryOnly: boolean;
}) {
  const { data, runAction } = useFinance();
  const isDummy = movement.dataKind === "dummy";
  const canChangeCategory = movement.type === "expense" || movement.type === "cardExpense";
  const title = movement.note || movement.category || TYPE_LABELS[movement.type];

  return (
    <li
      className={`flex items-start gap-3 border-t border-line py-3 first:border-t-0 ${
        isDummy ? "opacity-55" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${TYPE_STYLES[movement.type].soft}`}
      >
        {movement.category ? getCategoryIcon(movement.category) : (
          <span className={TYPE_STYLES[movement.type].text}>{TYPE_STYLES[movement.type].icon}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium first-letter:uppercase">{title}</p>
        <p className="text-sm text-ink-soft">
          {TYPE_LABELS[movement.type]} · {describeRoute(movement)}
        </p>
        {canChangeCategory ? (
          <label className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            <span className="sr-only">Categoría de {title}</span>
            <select
              className={`min-h-9 rounded-lg border border-line bg-page px-2 text-sm ${
                movement.category === PENDING_CATEGORY ? "font-semibold text-warning" : "text-ink"
              }`}
              value={movement.category ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                void runAction(`Ahora es ${next}`, () => changeMovementCategory(movement, next));
              }}
            >
              {data.settings.expenseCategories.map((option) => (
                <option key={option} value={option}>
                  {getCategoryIcon(option)} {formatCategory(option)}
                </option>
              ))}
            </select>
          </label>
        ) : movement.category && movement.category.toLowerCase() !== title.toLowerCase() ? (
          // Skipped when it would only repeat the title, like "Saldo inicial".
          <p className="text-sm text-ink-soft">{formatCategory(movement.category)}</p>
        ) : null}
        {isDummy ? (
          <p className="mt-1 text-xs font-semibold">Dummy: no cuenta en saldos ni Resumen</p>
        ) : null}
        {summaryOnly && !isDummy ? (
          <p className="mt-1 text-xs text-ink-soft">Anterior a tu saldo inicial: solo cuenta en Resumen</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <p
          className={`amount font-semibold ${
            movement.type === "income" ? "text-good" : ""
          }`}
        >
          {getSign(movement)}
          {formatMoney(movement.amount)}
        </p>
        <button
          type="button"
          className="min-h-11 pl-3 text-sm text-ink-soft underline underline-offset-2"
          aria-label={`Borrar ${title}`}
          onClick={() =>
            void runAction("Movimiento borrado", () => deleteMovement(movement))
          }
        >
          Borrar
        </button>
      </div>
    </li>
  );
}

export function HistoryScreen() {
  const { data, today } = useFinance();
  const [endpoint, setEndpoint] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<HistoryKind>("all");

  const thisMonth = monthKey(today);
  const lastMonth = previousMonthKey(today);
  const openings = useMemo(() => getOpeningDates(data.movements), [data.movements]);

  const visible = useMemo(
    () =>
      data.movements.filter((movement) => {
        // The Deuda mami entries only feed the calculations: the purchase itself is listed.
        if (isMomDebtEntry(movement)) return false;
        const key = monthKey(movement.date);
        if (key !== thisMonth && key !== lastMonth) return false;
        if (!matchesKind(movement, kind)) return false;
        if (endpoint && movement.from !== endpoint && movement.to !== endpoint) {
          return false;
        }
        return !category || movement.category === category;
      }),
    [data.movements, thisMonth, lastMonth, endpoint, category, kind],
  );

  const categories = useMemo(() => getHistoryCategories(data.movements), [data.movements]);
  // With both kinds on screen the menu is split into Gastos and Ingresos.
  const showGroups =
    kind === "all" && categories.expenses.length > 0 && categories.income.length > 0;
  const flatCategories =
    kind === "income"
      ? categories.income
      : kind === "expenses"
        ? categories.expenses
        : [...new Set([...categories.expenses, ...categories.income])];

  const months = [thisMonth, lastMonth].map((key) => ({
    key,
    movements: visible
      .filter((movement) => monthKey(movement.date) === key)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  })).map(({ key, movements }) => ({ key, days: groupByDay(movements) }));

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Historial</h1>

      <div role="radiogroup" aria-label="Qué mostrar" className="grid grid-cols-3 gap-2">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={kind === option.id}
            className="chip"
            onClick={() => {
              setKind(option.id);
              // A category from the other group wouldn't match anything.
              setCategory("");
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="field-label">
          Bolsa
          <select
            className="field"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          >
            <option value="">Todas</option>
            {ENDPOINTS.map((item) => (
              <option key={item} value={item}>
                {ENDPOINT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Categoría
          <select
            className="field"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas</option>
            {showGroups ? (
              <>
                <optgroup label="Gastos">
                  {categories.expenses.map((item) => (
                    <option key={`g-${item}`} value={item}>
                      {formatCategory(item)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ingresos">
                  {categories.income.map((item) => (
                    <option key={`i-${item}`} value={item}>
                      {formatCategory(item)}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              flatCategories.map((item) => (
                <option key={item} value={item}>
                  {formatCategory(item)}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="card text-ink-soft">Nada con estos filtros.</p>
      ) : null}

      {months.map(({ key, days }) =>
        days.length > 0 ? (
          <section key={key} className="card gap-0 pb-1">
            <h2 className="pb-1 text-base font-semibold first-letter:uppercase">
              {formatMonthName(key)}
            </h2>
            {days.map((day) => (
              <div key={day.date}>
                <h3 className="mt-3 border-b border-line pb-1.5 text-sm font-medium text-ink-soft">
                  {formatDayHeader(day.date)}
                </h3>
                <ul>
                  {day.movements.map((movement) => (
                    <MovementRow
                      key={movement.id}
                      movement={movement}
                      summaryOnly={isBeforeOpening(movement, openings)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null,
      )}

      <a href={SHEET_URL} target="_blank" rel="noreferrer" className="btn-secondary min-h-12">
        Ver todo en Google Sheets
      </a>
    </>
  );
}
