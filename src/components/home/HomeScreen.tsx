"use client";

import Link from "next/link";

import { formatLongDate, formatShortDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { PENDING_CATEGORY } from "@/data/seedData";
import { moveBanorteToCajita } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { PeriodBar } from "../ui/PeriodBar";
import { POCKET_STYLES } from "../ui/styles";
import { MomDebtCard } from "./MomDebtCard";
import { PocketsDetails } from "./PocketsDetails";
import { UpcomingCharges } from "./UpcomingCharges";
import { YieldCard } from "./YieldCard";

const QUICK_ACTIONS = [
  { href: "/agregar", icon: "▭", label: "Agregar gasto", tone: "bg-tarjeta-soft text-tarjeta" },
  { href: "/agregar?tipo=pago", icon: "✓", label: "Pagar tarjeta", tone: "bg-good-soft text-good" },
  { href: "/agregar?tipo=mover", icon: "⇄", label: "Mover dinero", tone: "bg-cajita-soft text-cajita" },
];

function signed(amount: number): string {
  return `${amount < 0 ? "−" : ""}${formatMoney(Math.abs(amount))}`;
}

/**
 * Three numbers, in the order that matters: what the card says, what is still missing
 * with the money at hand, and the whole picture counting what mom owes.
 */
function HeroBalance() {
  const { dashboard, today } = useFinance();
  const { free, toCoverDebt, projectedDue, card, realMoney, debt, balances } =
    dashboard;
  // Charges that will land before the cut and are paid on the same due date.
  const expectedBeforeCut = projectedDue - card.remaining;
  const missingOnDueDate = Math.max(0, projectedDue - realMoney);

  return (
    <section
      aria-labelledby="hero-label"
      className="rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5 text-white shadow-md"
    >
      <p className="text-sm text-white/80 first-letter:uppercase">{formatLongDate(today)}</p>
      <h1 id="hero-label" className="mt-3 text-base font-medium text-white/90">
        Debes en la tarjeta
      </h1>
      <p className="amount mt-0.5 text-[2.75rem] leading-tight font-semibold tracking-tight">
        {formatMoney(debt)}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-white/12 p-3">
          <dt className="text-white/80">Te falta juntar</dt>
          <dd className="amount mt-0.5 text-lg font-semibold">{formatMoney(toCoverDebt)}</dd>
          <dd className="mt-0.5 text-xs text-white/70">
            Tienes {formatMoney(realMoney)}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/12 p-3">
          <dt className="text-white/80">Balance total</dt>
          <dd className="amount mt-0.5 text-lg font-semibold">{signed(free)}</dd>
          <dd className="mt-0.5 text-xs text-white/70">
            {balances.porCobrarMama > 0 ? "Contando Deuda mami" : "Tu dinero menos la tarjeta"}
          </dd>
        </div>
        {expectedBeforeCut > 0 ? (
          <div className="col-span-2 rounded-2xl bg-white/12 p-3">
            <dt className="text-white/80">
              Con tus suscripciones, el {formatShortDate(card.dueDate)} pagas
            </dt>
            <dd className="amount mt-0.5 text-lg font-semibold">{formatMoney(projectedDue)}</dd>
            <dd className="amount mt-0.5 text-xs text-white/70">
              Debes {formatMoney(card.remaining)} + {formatMoney(expectedBeforeCut)} que se cobran
              antes del corte. Te faltaría juntar {formatMoney(missingOnDueDate)}.
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function HomeScreen() {
  const { data, dashboard, today, runAction, canEdit } = useFinance();
  const { balances } = dashboard;
  const pending = data.movements.filter(
    (movement) => movement.dataKind !== "dummy" && movement.category === PENDING_CATEGORY,
  );

  return (
    <>
      <PeriodBar />
      <HeroBalance />
      <MomDebtCard />

      {canEdit ? (
        <nav aria-label="Acciones rápidas" className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 text-center text-xs font-semibold active:opacity-80"
            >
              <span
                aria-hidden="true"
                className={`flex size-9 items-center justify-center rounded-full text-lg ${action.tone}`}
              >
                {action.icon}
              </span>
              {action.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {canEdit && pending.length > 0 ? (
        <section className="card bg-warning-soft">
          <h2 className="text-sm font-semibold text-warning">
            {pending.length === 1 ? "1 gasto por revisar" : `${pending.length} gastos por revisar`}
          </h2>
          <ul className="flex flex-col gap-1">
            {pending.map((movement) => (
              <li key={movement.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{movement.note || "Sin nombre"}</span>
                <span className="amount font-semibold">{formatMoney(movement.amount)}</span>
              </li>
            ))}
          </ul>
          <Link href="/historial" className="btn-secondary bg-surface">
            Ponerle categoría en el historial
          </Link>
        </section>
      ) : null}

      {balances.banorte > 0 ? (
        <section className={`card ${POCKET_STYLES.banorte.soft}`}>
          <div>
            <h2 className={`text-sm font-semibold ${POCKET_STYLES.banorte.text}`}>
              Falta pasar a la cajita
            </h2>
            <p className="amount text-2xl font-semibold">{formatMoney(balances.banorte)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Está en Banorte, sin generar rendimiento.
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void runAction("Lo pasaste a la cajita", () =>
                  moveBanorteToCajita(balances.banorte, today),
                )
              }
            >
              Ya lo pasé a la cajita
            </button>
          ) : null}
        </section>
      ) : null}

      <UpcomingCharges />

      <YieldCard />
      <PocketsDetails />
    </>
  );
}
