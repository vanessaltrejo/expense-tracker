"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { PocketId } from "@/domain/types";
import { addMovement, addMovementWithBreakdown } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { BreakdownEditor, type BreakdownPart } from "./BreakdownEditor";

/** Deuda mami, the card and what mom sends (an income) have their own places in the app. */
type Place = Extract<PocketId, "banorte" | "cajita" | "efectivo" | "bbva">;
const SOURCES: Place[] = ["banorte", "cajita", "efectivo"];
const TARGETS: Place[] = ["cajita", "banorte", "efectivo"];
/** The simple layout has two places: the BBVA account and cash. */
const SIMPLE_PLACES: Place[] = ["bbva", "efectivo"];

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
  const { dashboard, today, runAction, user } = useFinance();
  const isSimple = user.layout === "simple";
  const sources = isSimple ? SIMPLE_PLACES : SOURCES;
  const targets = isSimple ? SIMPLE_PLACES : TARGETS;
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [from, setFrom] = useState<Place>(isSimple ? "bbva" : "banorte");
  const [to, setTo] = useState<Place>(isSimple ? "efectivo" : "cajita");

  const [parts, setParts] = useState<BreakdownPart[]>([]);

  const amount = parseMoneyInput(amountText);
  const canSubmit = amount !== null && amount > 0;
  // Taking cash out of BBVA is the one move with something to account for: what it paid for.
  const isWithdrawal = isSimple && from === "bbva" && to === "efectivo";

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

    const movement = {
      date: today,
      type: "transfer" as const,
      amount,
      from,
      to,
      category: null,
      note: isWithdrawal ? "Retiro de efectivo" : "",
      dataKind: "real" as const,
    };
    const spent = isWithdrawal ? parts : [];
    void runAction(`Guardado: ${formatMoney(amount)}`, () =>
      spent.length === 0
        ? addMovement(movement)
        : addMovementWithBreakdown(
            movement,
            // The cash is spent from the pocket the withdrawal filled.
            spent.map((part) => ({
              date: today,
              type: "expense" as const,
              amount: part.amount,
              from: "efectivo" as const,
              to: null,
              category: part.category,
              note: part.note,
              dataKind: "real" as const,
            })),
          ),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />
      <Choice label="De" options={sources} value={from} onChange={pickFrom} />
      <Choice label="A" options={targets} value={to} onChange={pickTo} />
      {isWithdrawal ? (
        <BreakdownEditor
          title="¿En qué se gastó este efectivo? (opcional)"
          total={amount}
          parts={parts}
          onChange={setParts}
        />
      ) : null}
      <p className="amount text-sm text-ink-soft">
        En {ENDPOINT_LABELS[from]} hay {formatMoney(dashboard.balances[from])}.
      </p>
      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}
