"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { PocketId } from "@/domain/types";
import { addMovement } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

/** Deuda mami, the card and what mom sends (an income) have their own places in the app. */
type Place = Extract<PocketId, "banorte" | "cajita" | "efectivo">;
const SOURCES: Place[] = ["banorte", "cajita", "efectivo"];
const TARGETS: Place[] = ["cajita", "banorte", "efectivo"];

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Place[];
  value: Place;
  onChange: (value: Place) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className="chip"
            onClick={() => onChange(option)}
          >
            {ENDPOINT_LABELS[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Moves money between your places: an amount, where it leaves and where it lands. */
export function TransferForm() {
  const { dashboard, today, runAction } = useFinance();
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [from, setFrom] = useState<Place>("banorte");
  const [to, setTo] = useState<Place>("cajita");

  const amount = parseMoneyInput(amountText);
  const canSubmit = amount !== null && amount > 0;

  // Picking a place that the other side already uses swaps them, so they never match.
  const pickFrom = (next: Place) => {
    if (next === to) setTo(from);
    setFrom(next);
  };
  const pickTo = (next: Place) => {
    if (next === from) setFrom(to);
    setTo(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;

    void runAction(`Guardado: ${formatMoney(amount)}`, () =>
      addMovement({
        date: today,
        type: "transfer",
        amount,
        from,
        to,
        category: null,
        note: "",
        dataKind: "real",
      }),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />
      <Choice label="De" options={SOURCES} value={from} onChange={pickFrom} />
      <Choice label="A" options={TARGETS} value={to} onChange={pickTo} />
      <p className="amount text-sm text-ink-soft">
        En {ENDPOINT_LABELS[from]} hay {formatMoney(dashboard.balances[from])}.
      </p>
      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}
