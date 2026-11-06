"use client";

import Link from "next/link";

import { formatLongDate } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { PENDING_CATEGORY } from "@/data/seedData";
import { moveBanorteToCajita } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { POCKET_STYLES } from "../ui/styles";
import { IntervalReminderCard } from "./IntervalReminderCard";
import { PaymentPlanCard } from "./PaymentPlanCard";
import { PocketsDetails } from "./PocketsDetails";
import { UpcomingCharges } from "./UpcomingCharges";
import { YieldCard } from "./YieldCard";

const QUICK_ACTIONS = [
  { href: "/agregar", icon: "▭", label: "Gasto con tarjeta", tone: "bg-tarjeta-soft text-tarjeta" },
  { href: "/agregar?tipo=pago", icon: "✓", label: "Pagar tarjeta", tone: "bg-good-soft text-good" },
  { href: "/agregar?tipo=mover", icon: "⇄", label: "Mover dinero", tone: "bg-cajita-soft text-cajita" },
];

function signed(amount: number): string {
  return `${amount < 0 ? "−" : ""}${formatMoney(Math.abs(amount))}`;
}

/** The headline is what is still owed, because that is the number that drives decisions. */
function HeroBalance() {
  const { dashboard, today } = useFinance();
  const { free, toCoverDebt, toCoverWithExpected, expectedThisMonth, realMoney, debt, balances } =
    dashboard;
  const isCovered = toCoverDebt === 0;

  return (
    <section
      aria-labelledby="hero-label"
      className="rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5 text-white shadow-md"
    >
      <p className="text-sm text-white/80 first-letter:uppercase">{formatLongDate(today)}</p>
      <h1 id="hero-label" className="mt-3 text-base font-medium text-white/90">
        {isCovered ? "Ya te alcanza para pagar la tarjeta" : "Te falta para pagar la tarjeta"}
      </h1>
      <p className="amount mt-0.5 text-[2.75rem] leading-tight font-semibold tracking-tight">
        {isCovered ? formatMoney(debt) : formatMoney(toCoverDebt)}
      </p>
      <p className="amount mt-1 text-sm text-white/85">
        {isCovered
          ? `Debes ${formatMoney(debt)} y tienes ${formatMoney(realMoney)}.`
          : `Debes ${formatMoney(debt)} y tienes ${formatMoney(realMoney)} para pagarla.`}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2 rounded-2xl bg-white/12 p-3">
          <dt className="text-white/80">
            Libre de verdad
            {balances.porCobrarMama > 0 ? " (contando lo que te debe tu mamá)" : ""}
          </dt>
          <dd className="amount mt-0.5 text-xl font-semibold">{signed(free)}</dd>
        </div>
        <div className="rounded-2xl bg-white/12 p-3">
          <dt className="text-white/80">Dinero real</dt>
          <dd className="amount mt-0.5 font-semibold">{formatMoney(realMoney)}</dd>
        </div>
        <div className="rounded-2xl bg-white/12 p-3">
          <dt className="text-white/80">Tu mamá te debe</dt>
          <dd className="amount mt-0.5 font-semibold">{formatMoney(balances.porCobrarMama)}</dd>
        </div>
        {expectedThisMonth > 0 ? (
          <div className="col-span-2 rounded-2xl bg-white/12 p-3">
            <dt className="text-white/80">
              Con {formatMoney(expectedThisMonth)} en pagos esperados te faltaría
            </dt>
            <dd className="amount mt-0.5 font-semibold">{formatMoney(toCoverWithExpected)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function HomeScreen() {
  const { data, dashboard, today, runAction } = useFinance();
  const { balances } = dashboard;
  const pending = data.movements.filter(
    (movement) => movement.dataKind !== "dummy" && movement.category === PENDING_CATEGORY,
  );
  const dueReminders = dashboard.intervalReminders.filter((reminder) => reminder.isDue);

  return (
    <>
      <HeroBalance />

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

      {dueReminders.map((reminder) => (
        <IntervalReminderCard key={`${reminder.expense.id}-${today}`} reminder={reminder} />
      ))}

      {pending.length > 0 ? (
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
        </section>
      ) : null}

      <UpcomingCharges />

      {balances.porCobrarMama > 0 ? (
        <section className={`card ${POCKET_STYLES.porCobrarMama.soft}`}>
          <h2 className={`text-sm font-semibold ${POCKET_STYLES.porCobrarMama.text}`}>
            Tu mamá te debe
          </h2>
          <p className="amount -mt-2 text-2xl font-semibold">
            {formatMoney(balances.porCobrarMama)}
          </p>
          <Link href="/agregar?tipo=mover" className="btn-secondary bg-surface">
            Ya me regresó dinero
          </Link>
        </section>
      ) : null}

      <PaymentPlanCard />
      <YieldCard />
      <PocketsDetails />
    </>
  );
}
