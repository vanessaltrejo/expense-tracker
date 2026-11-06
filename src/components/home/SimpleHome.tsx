"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { PENDING_CATEGORY } from "@/data/seedData";
import { buildPeriodSummary } from "@/domain/dashboard";
import { formatLongDate } from "@/domain/dates";
import { getOpeningDates, OPENING_BALANCE_CATEGORY } from "@/domain/ledger";
import { getLoanBalances } from "@/domain/loans";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { addMovement, type Undo } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { PeriodBar } from "../ui/PeriodBar";
import { ACTION_TILE, ACTION_TONES } from "../ui/styles";

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
  const { data, dashboard, today, canEdit, viewPeriod } = useFinance();
  // The month stats follow the month picked in the bar; the balance is always today's.
  const period = viewPeriod;
  const when = period.start === dashboard.period.start ? "este mes" : "ese mes";
  const summary = useMemo(() => buildPeriodSummary(data, today, period), [data, today, period]);
  const owing = useMemo(() => getLoanBalances(data.movements), [data.movements]);
  const totalOwed = owing.reduce((total, item) => total + item.owed, 0);
  const openings = getOpeningDates(data.movements);
  const hasOpening = openings.bbva !== undefined && openings.efectivo !== undefined;
  const pending = data.movements.filter(
    (movement) => movement.dataKind !== "dummy" && movement.category === PENDING_CATEGORY,
  );

  return (
    <>
      <PeriodBar title="Inicio" selectable />

      <section
        aria-labelledby="hero-label"
        className="rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5 text-white shadow-md"
      >
        <p className="text-sm text-white/80 first-letter:uppercase">{formatLongDate(today)}</p>
        <h2 id="hero-label" className="mt-3 text-base font-medium text-white/90">
          Tienes en total
        </h2>
        <p className="amount mt-0.5 text-4xl leading-tight font-semibold tracking-tight">
          {signed(dashboard.balances.bbva + dashboard.balances.efectivo)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 p-4">
            <dt className="text-sm font-medium text-white/85">BBVA</dt>
            <dd className="amount mt-1 text-[1.75rem] leading-tight font-semibold">
              {signed(dashboard.balances.bbva)}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/15 p-4">
            <dt className="text-sm font-medium text-white/85">Efectivo</dt>
            <dd className="amount mt-1 text-[1.75rem] leading-tight font-semibold">
              {signed(dashboard.balances.efectivo)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 flex items-baseline justify-between gap-3 text-sm text-white/85">
          <span>
            Gastaste {when}
            <span className="text-white/70">
              {" "}
              · {summary.expenseCount === 1 ? "1 gasto" : `${summary.expenseCount} gastos`}
            </span>
          </span>
          <span className="amount text-base font-semibold text-white">
            {formatMoney(summary.totalSpent)}
          </span>
        </p>
      </section>

      {canEdit && !hasOpening ? <OpeningBalanceCard /> : null}

      {canEdit ? (
        <nav aria-label="Acciones rápidas" className="grid grid-cols-2 gap-2">
          <Link
            href="/agregar"
            className={`${ACTION_TILE} ${ACTION_TONES.expense}`}
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-white/20 text-lg"
            >
              ↑
            </span>
            Agregar gasto
          </Link>
          <Link
            href="/agregar?tipo=ingreso"
            className={`${ACTION_TILE} ${ACTION_TONES.income}`}
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-white/20 text-lg"
            >
              ↓
            </span>
            Me depositaron
          </Link>
        </nav>
      ) : null}

      {owing.length > 0 ? (
        <section className="card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="card-title">Te deben</h2>
            <p className="amount text-lg font-semibold">{formatMoney(totalOwed)}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {owing.map((item) => (
              <li key={item.person} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">🤝 {item.person}</span>
                <span className="amount shrink-0 font-semibold">{formatMoney(item.owed)}</span>
              </li>
            ))}
          </ul>
          {canEdit ? (
            <Link href="/agregar?tipo=enviar" className="btn-secondary min-h-12">
              Anotar que me regresaron
            </Link>
          ) : null}
        </section>
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
    </>
  );
}
