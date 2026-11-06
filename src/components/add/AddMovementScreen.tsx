"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useFinance } from "../FinanceProvider";
import { MovementForm, type MovementFormKind } from "./MovementForm";
import { PaymentForm } from "./PaymentForm";
import { SendForm } from "./SendForm";
import { ShortcutList } from "./ShortcutList";
import { TransferForm } from "./TransferForm";

type AddTab = MovementFormKind | "transfer" | "payment" | "send";

const TABS: { id: AddTab; icon: string; label: string; param: string }[] = [
  { id: "expense", icon: "↑", label: "Gasto", param: "gasto" },
  { id: "income", icon: "↓", label: "Ingreso", param: "ingreso" },
  { id: "transfer", icon: "⇄", label: "Mover", param: "mover" },
  { id: "payment", icon: "✓", label: "Pagar tarjeta", param: "pago" },
  { id: "send", icon: "↗", label: "Transferí", param: "enviar" },
];

function AddMovementContent({ initialTab }: { initialTab: AddTab }) {
  const { user } = useFinance();
  const isSimple = user.layout === "simple";
  const tabs = isSimple
    ? TABS.filter((item) => item.id !== "payment")
    : TABS.filter((item) => item.id !== "send");
  const [tab, setTab] = useState<AddTab>(
    tabs.some((item) => item.id === initialTab) ? initialTab : "expense",
  );

  return (
    <>
      <h1 className="flex h-14 items-center px-1 text-2xl font-semibold">Agregar</h1>

      <div
        role="radiogroup"
        aria-label="Tipo de movimiento"
        className="flex gap-1.5"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={tab === item.id}
            className="chip min-w-0 flex-auto gap-1 whitespace-nowrap px-2 text-[clamp(0.6875rem,3.4vw,0.875rem)]"
            onClick={() => setTab(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {tab === "expense" ? <ShortcutList /> : null}
      {tab === "payment" ? <PaymentForm /> : null}
      {tab === "transfer" ? <TransferForm /> : null}
      {tab === "send" ? <SendForm /> : null}
      {tab === "expense" || tab === "income" ? (
        // The key resets the form so nothing typed carries over to another type.
        <MovementForm key={tab} kind={tab} />
      ) : null}
    </>
  );
}

/** Needs a Suspense boundary above it, because it reads the URL (?tipo=pago). */
export function AddMovementScreen() {
  const { today, canEdit } = useFinance();
  const searchParams = useSearchParams();
  const [visit, setVisit] = useState(0);
  const requested = searchParams.get("tipo");
  const initialTab = TABS.find((item) => item.param === requested)?.id ?? "expense";

  // Next.js keeps a page's state when navigating away, and this cleanup runs at that
  // moment. Starting over each visit keeps a saved amount from being registered twice,
  // and the `today` key keeps a form left open overnight from using yesterday's date.
  useEffect(() => () => setVisit((current) => current + 1), []);

  if (!canEdit) {
    return (
      <p className="card text-center text-ink-soft">
        Esta cuenta es de solo lectura: aquí no se agregan movimientos.
      </p>
    );
  }

  return (
    <AddMovementContent
      key={`${visit}-${today}-${initialTab}`}
      initialTab={initialTab}
    />
  );
}
