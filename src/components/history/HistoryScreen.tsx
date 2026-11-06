"use client";

import { useMemo, useState } from "react";

import { getBreakdowns, parentIdOf } from "@/domain/breakdown";
import { formatDayHeader } from "@/domain/dates";
import {
  getHistoryCategories,
  type HistoryKind,
  matchesKind,
} from "@/domain/history";
import { ENDPOINT_LABELS, isMomDebtEntry } from "@/domain/ledger";
import { getTopPlaces, placeOfNote } from "@/domain/places";
import { formatMoney } from "@/domain/money";
import { isInPeriod } from "@/domain/periods";
import type {
  Movement,
  MovementEndpoint,
  MovementType,
} from "@/domain/types";
import { changeMovementCategory, deleteMovement } from "@/services/financeService";
import { PENDING_CATEGORY } from "@/data/seedData";
import { useFinance } from "../FinanceProvider";
import { PeriodBar } from "../ui/PeriodBar";
import { formatCategory, getCategoryIcon, TYPE_STYLES } from "../ui/styles";

/** Only the pockets that hold or owe money. Deuda mami has its own card on Home. */
const ENDPOINTS: MovementEndpoint[] = ["cajita", "banorte", "efectivo", "tarjetaNu"];
const SIMPLE_ENDPOINTS: MovementEndpoint[] = ["bbva", "efectivo"];

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

/** A negative amount already says it is a spend, so spends show only where the money came from. */
function describeSubtitle(movement: Movement): string {
  const route = describeRoute(movement);
  const isSpend = movement.type === "expense" || movement.type === "cardExpense";
  if (isSpend && route) return route;
  return `${TYPE_LABELS[movement.type]} · ${route}`;
}

function getSign(movement: Movement): string {
  if (movement.type === "income") return "+";
  if (movement.type === "expense" || movement.type === "cardExpense") return "−";
  if (movement.type === "adjustment") return movement.to ? "+" : "−";
  // A transfer to another person is money leaving; one coming in from outside is money entering.
  if (movement.type === "transfer" && movement.from && !movement.to) return "−";
  if (movement.type === "transfer" && movement.to && !movement.from) return "+";
  return "";
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

function isSameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The receipt under a bank movement: what it was used for, one line per part. */
function BreakdownList({ movement, parts }: { movement: Movement; parts: Movement[] }) {
  const listed = parts.reduce((total, part) => total + part.amount, 0);

  return (
    <div className="mt-2 rounded-xl bg-page px-3 py-2">
      <ul className="flex flex-col">
        {parts.map((part) => (
          <li key={part.id} className="flex items-baseline gap-2 py-1 text-sm">
            <span aria-hidden="true" className="w-5 shrink-0 text-center">
              {getCategoryIcon(part.category)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium first-letter:uppercase">
                {part.note || (part.category ? formatCategory(part.category) : "Gasto")}
              </span>
              {part.category && part.note && !isSameText(part.note, part.category) ? (
                <span className="text-ink-soft"> · {formatCategory(part.category)}</span>
              ) : null}
            </span>
            <span className="amount shrink-0 font-medium">{formatMoney(part.amount)}</span>
          </li>
        ))}
      </ul>
      {listed !== movement.amount ? (
        <p className="amount mt-1 border-t border-line pt-1.5 text-xs text-ink-soft">
          Desglosado {formatMoney(listed)} de {formatMoney(movement.amount)}
        </p>
      ) : null}
    </div>
  );
}

function MovementRow({
  movement,
  parts,
}: {
  movement: Movement;
  parts: Movement[];
}) {
  const { data, runAction, canEdit } = useFinance();
  const subtitle = describeSubtitle(movement);
  const isDummy = movement.dataKind === "dummy";
  const canChangeCategory =
    canEdit && (movement.type === "expense" || movement.type === "cardExpense");
  const title = movement.note || movement.category || TYPE_LABELS[movement.type];

  return (
    <li
      className={`border-t border-line py-3 first:border-t-0 ${isDummy ? "opacity-55" : ""}`}
    >
      <div className="flex items-start gap-3">
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
          {subtitle ? <p className="text-sm text-ink-soft">{subtitle}</p> : null}
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
          {canEdit ? (
            <button
              type="button"
              className="min-h-11 pl-3 text-sm text-ink-soft underline underline-offset-2"
              aria-label={`Borrar ${title}`}
              onClick={() =>
                void runAction(parts.length > 0 ? "Movimiento y desglose borrados" : "Movimiento borrado", () =>
                  deleteMovement(movement, parts),
                )
              }
            >
              Borrar
            </button>
          ) : null}
        </div>
      </div>
      {parts.length > 0 ? (
        // Under the whole row, from the text on, so the receipt gets the space beside the amount.
        <div className="ml-13">
          <BreakdownList movement={movement} parts={parts} />
        </div>
      ) : null}
    </li>
  );
}

export function HistoryScreen() {
  const { data, dashboard, user, viewPeriod } = useFinance();
  const isSimple = user.layout === "simple";
  // Only the simple layout can look at an earlier month; the card layout is always current.
  const period = isSimple ? viewPeriod : dashboard.period;
  const [endpoint, setEndpoint] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<HistoryKind>("all");
  const [place, setPlace] = useState("");

  const visible = useMemo(
    () =>
      data.movements.filter((movement) => {
        // The Deuda mami entries only feed the calculations: the purchase itself is listed.
        if (isMomDebtEntry(movement)) return false;
        if (!isInPeriod(movement.date, period)) return false;
        if (!matchesKind(movement, kind)) return false;
        if (endpoint && movement.from !== endpoint && movement.to !== endpoint) {
          return false;
        }
        if (
          place &&
          placeOfNote(movement.note, data.settings.places).toLowerCase() !== place.toLowerCase()
        ) {
          return false;
        }
        return !category || movement.category === category;
      }),
    [data.movements, data.settings.places, period, endpoint, category, kind, place],
  );

  // Places for the filter: every place spent at this period, only where places are asked for.
  const placeOptions = useMemo(
    () =>
      isSimple
        ? getTopPlaces(data.movements, data.settings, period, 50).map((item) => item.place)
        : [],
    [isSimple, data.movements, data.settings, period],
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

  const { partsByParent } = useMemo(() => getBreakdowns(data.movements), [data.movements]);

  // A part sits under its movement. It shows on its own only when its movement is filtered
  // out, so a filter by category or place still finds it.
  const days = useMemo(() => {
    const visibleIds = new Set(visible.map((movement) => movement.id));
    const topLevel = visible.filter((movement) => {
      const parent = parentIdOf(movement.id);
      return parent === null || !partsByParent.has(parent) || !visibleIds.has(parent);
    });
    return groupByDay(
      topLevel.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    );
  }, [visible, partsByParent]);

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Historial</h1>
      <PeriodBar selectable />

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
        {(
        <label className="field-label">
          Bolsa
          <select
            className="field"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          >
            <option value="">Todas</option>
            {(isSimple ? SIMPLE_ENDPOINTS : ENDPOINTS).map((item) => (
              <option key={item} value={item}>
                {ENDPOINT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        )}
        {placeOptions.length > 0 ? (
          <label className="field-label">
            Lugar
            <select className="field" value={place} onChange={(event) => setPlace(event.target.value)}>
              <option value="">Todos</option>
              {placeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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

      {days.length > 0 ? (
        <section className="card gap-0 pb-1">
          {days.map((day, index) => (
            <div key={day.date}>
              <h3
                className={`border-b border-line pb-1.5 text-sm font-medium text-ink-soft ${
                  index === 0 ? "" : "mt-3"
                }`}
              >
                {formatDayHeader(day.date)}
              </h3>
              <ul>
                {day.movements.map((movement) => (
                  <MovementRow
                    key={movement.id}
                    movement={movement}
                    parts={partsByParent.get(movement.id) ?? []}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
