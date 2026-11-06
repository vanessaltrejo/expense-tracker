"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { PENDING_CATEGORY } from "@/data/seedData";
import { buildPeriodSummary } from "@/domain/dashboard";
import { formatLongDate } from "@/domain/dates";
import { getOpeningDates, OPENING_BALANCE_CATEGORY } from "@/domain/ledger";
import { getTopPlaces } from "@/domain/places";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { addMovement, type Undo } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { CategoryChart } from "../summary/CategoryChart";
import { AmountField } from "../ui/AmountField";
import { PeriodBar } from "../ui/PeriodBar";

function signed(amount: number): string {
  return `${amount < 0 ? "−" : ""}${formatMoney(Math.abs(amount))}`;
}

/** Asks once for today's balances, the starting point every later balance builds on. */
function OpeningBalanceCard() {
  const { data, today, runAction } = useFinance();
  const openings = getOpeningDates(data.movements);
  const [bbvaText, setBbvaText] = useState("");
  const [cashText, setCashText] = useState("");
  const bbva = bbvaText === "" ? null : parseMoneyInput(bbvaText);
  const cash = cashText === "" ? null : parseMoneyInput(cashText);
  const canSave = (bbva !== null || cash !== null) && (bbvaText === "" || bbva !== null) && (cashText === "" || cash !== null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const opening = (pocket: "bbva" | "efectivo", amount: number) => ({
      date: today,
      type: "adjustment" as const,
      amount,
      from: null,
      to: pocket,
      category: OPENING_BALANCE_CATEGORY,
      note: OPENING_BALANCE_CATEGORY,
      dataKind: "real" as const,
    });
    void runAction("Saldos guardados", async () => {
      let undo: Undo | null = null;
      if (bbva !== null && !openings.bbva) undo = await addMovement(opening("bbva", bbva));
      if (cash !== null && !openings.efectivo) undo = await addMovement(opening("efectivo", cash));
      return undo;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-3 bg-warning-soft">
      <h2 className="text-sm font-semibold text-warning">¿Cuánto tienes hoy?</h2>
      {openings.bbva ? null : (
        <AmountField label="En tu BBVA" value={bbvaText} onChange={setBbvaText} />
      )}
      {openings.efectivo ? null : (
        <AmountField
          label="En efectivo"
          value={cashText}
          onChange={setCashText}
          hint="A partir de aquí la app lleva la cuenta."
        />
      )}
      <button type="submit" className="btn-primary" disabled={!canSave}>
        Guardar saldos
      </button>
    </form>
  );
}

/**
 * The home of the simple layout: one BBVA account, by calendar month. What is in the
 * account, what was spent, what came in and what the money went to.
 */
export function SimpleHome() {
  const { data, dashboard, today, canEdit } = useFinance();
  const summary = useMemo(() => buildPeriodSummary(data, today), [data, today]);
  const topPlaces = useMemo(
    () => getTopPlaces(data.movements, data.settings, dashboard.period, 3),
    [data.movements, data.settings, dashboard.period],
  );
  const openings = getOpeningDates(data.movements);
  const hasOpening = openings.bbva !== undefined && openings.efectivo !== undefined;
  const pending = data.movements.filter(
    (movement) => movement.dataKind !== "dummy" && movement.category === PENDING_CATEGORY,
  );

  return (
    <>
      <PeriodBar />

      <section
        aria-labelledby="hero-label"
        className="rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5 text-white shadow-md"
      >
        <p className="text-sm text-white/80 first-letter:uppercase">{formatLongDate(today)}</p>
        <h1 id="hero-label" className="mt-3 text-base font-medium text-white/90">
          Tienes en total
        </h1>
        <p className="amount mt-0.5 text-[2.75rem] leading-tight font-semibold tracking-tight">
          {signed(dashboard.balances.bbva + dashboard.balances.efectivo)}
        </p>
        <p className="amount mt-1 text-sm text-white/80">
          BBVA {signed(dashboard.balances.bbva)} · Efectivo {signed(dashboard.balances.efectivo)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-white/12 p-3">
            <dt className="text-white/80">Gastaste este mes</dt>
            <dd className="amount mt-0.5 text-lg font-semibold">
              {formatMoney(summary.totalSpent)}
            </dd>
            <dd className="mt-0.5 text-xs text-white/70">
              {summary.expenseCount === 1 ? "1 gasto" : `${summary.expenseCount} gastos`}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/12 p-3">
            <dt className="text-white/80">Te entró este mes</dt>
            <dd className="amount mt-0.5 text-lg font-semibold">{formatMoney(summary.income)}</dd>
            <dd className="mt-0.5 text-xs text-white/70">Depósitos</dd>
          </div>
        </dl>
      </section>

      {canEdit && !hasOpening ? <OpeningBalanceCard /> : null}

      {canEdit ? (
        <nav aria-label="Acciones rápidas" className="grid grid-cols-2 gap-2">
          <Link
            href="/agregar"
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 text-center text-xs font-semibold active:opacity-80"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-tarjeta-soft text-lg text-tarjeta"
            >
              ↑
            </span>
            Agregar gasto
          </Link>
          <Link
            href="/agregar?tipo=ingreso"
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 text-center text-xs font-semibold active:opacity-80"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-good-soft text-lg text-good"
            >
              ↓
            </span>
            Me depositaron
          </Link>
        </nav>
      ) : null}

      {canEdit && pending.length > 0 ? (
        <section className="card bg-warning-soft">
          <h2 className="text-sm font-semibold text-warning">
            {pending.length === 1 ? "1 gasto por revisar" : `${pending.length} gastos por revisar`}
          </h2>
          <Link href="/historial" className="btn-secondary bg-surface">
            Ponerle categoría en el historial
          </Link>
        </section>
      ) : null}

      {summary.categories.length > 0 ? (
        <section className="card">
          <h2 className="card-title">En qué gastaste este mes</h2>
          <CategoryChart categories={summary.categories} />
          <Link href="/resumen" className="btn-secondary min-h-12">
            Ver el resumen
          </Link>
        </section>
      ) : (
        <p className="card text-ink-soft">Todavía no hay gastos este mes.</p>
      )}

      {topPlaces.length > 0 ? (
        <section className="card">
          <h2 className="card-title">Dónde más gastas</h2>
          <ul className="flex flex-col gap-2">
            {topPlaces.map((item) => (
              <li key={item.place} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">{item.place}</span>
                <span className="amount shrink-0 font-semibold">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
