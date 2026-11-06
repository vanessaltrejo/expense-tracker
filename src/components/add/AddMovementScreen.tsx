"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useFinance } from "../FinanceProvider";
import { AdjustmentForm } from "./AdjustmentForm";
import { MovementForm, type MovementFormKind } from "./MovementForm";
import { PaymentForm } from "./PaymentForm";
import { ShortcutList } from "./ShortcutList";

type AddTab = MovementFormKind | "payment" | "adjustment";

const TABS: { id: AddTab; label: string; param: string }[] = [
  { id: "cardExpense", label: "▭ Con tarjeta", param: "tarjeta" },
  { id: "expense", label: "↑ Gasto", param: "gasto" },
  { id: "income", label: "↓ Ingreso", param: "ingreso" },
  { id: "transfer", label: "⇄ Mover", param: "mover" },
  { id: "payment", label: "✓ Pagar tarjeta", param: "pago" },
  { id: "adjustment", label: "≈ Ajustar cajita", param: "ajuste" },
];

const TAB_HELP: Record<AddTab, string> = {
  cardExpense: "Algo que pagaste con tu Tarjeta Nu. Sube tu deuda.",
  expense: "Algo que pagaste con efectivo, la cajita o que pagó tu mamá.",
  income: "Dinero que te llegó: horno³, comedor o tu mamá.",
  transfer: "Mover dinero entre tus bolsas. No es un gasto.",
  payment: "Lo que abonaste a la tarjeta. Puedes pagar en varias partes.",
  adjustment: "Pon el saldo real de Nu y la diferencia se guarda como rendimiento.",
};

function AddMovementContent({ initialTab }: { initialTab: AddTab }) {
  const [tab, setTab] = useState<AddTab>(initialTab);

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Agregar</h1>

      <div
        role="radiogroup"
        aria-label="Tipo de movimiento"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={tab === item.id}
            className="chip shrink-0"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="-mt-1 px-1 text-sm text-ink-soft">{TAB_HELP[tab]}</p>

      {tab === "cardExpense" ? <ShortcutList /> : null}
      {tab === "payment" ? <PaymentForm /> : null}
      {tab === "adjustment" ? <AdjustmentForm /> : null}
      {tab !== "payment" && tab !== "adjustment" ? (
        // The key resets the form so nothing typed carries over to another type.
        <MovementForm key={tab} kind={tab} />
      ) : null}
    </>
  );
}

/** Needs a Suspense boundary above it, because it reads the URL (?tipo=pago). */
export function AddMovementScreen() {
  const { today } = useFinance();
  const searchParams = useSearchParams();
  const [visit, setVisit] = useState(0);
  const requested = searchParams.get("tipo");
  const initialTab = TABS.find((item) => item.param === requested)?.id ?? "cardExpense";

  // Next.js keeps a page's state when navigating away, and this cleanup runs at that
  // moment. Starting over each visit keeps a saved amount from being registered twice,
  // and the `today` key keeps a form left open overnight from using yesterday's date.
  useEffect(() => () => setVisit((current) => current + 1), []);

  return (
    <AddMovementContent
      key={`${visit}-${today}-${initialTab}`}
      initialTab={initialTab}
    />
  );
}
