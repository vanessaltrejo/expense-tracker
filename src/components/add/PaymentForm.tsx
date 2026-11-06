"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { addMovement } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

/** The card is always paid from the cajita, so the only thing to say is how much. */
export function PaymentForm() {
  const { dashboard, today, runAction } = useFinance();
  const router = useRouter();
  const [amountText, setAmountText] = useState("");

  const amount = parseMoneyInput(amountText);
  const canSubmit = amount !== null && amount > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;

    void runAction(`Pago de ${formatMoney(amount)} registrado`, () =>
      addMovement({
        date: today,
        type: "transfer",
        amount,
        from: "cajita",
        to: "tarjetaNu",
        category: null,
        note: "Pago de tarjeta",
        dataKind: "real",
      }),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField
        label="Monto"
        value={amountText}
        onChange={setAmountText}
        size="large"
        hint={`Debes ${formatMoney(dashboard.debt)} en la tarjeta.`}
      />
      <p className="amount text-sm text-ink-soft">
        Sale de tu {ENDPOINT_LABELS.cajita}, donde tienes {formatMoney(dashboard.balances.cajita)}.
      </p>
      <button type="submit" className="btn-primary amount" disabled={!canSubmit}>
        Pagar {canSubmit && amount !== null ? formatMoney(amount) : "tarjeta"}
      </button>
    </form>
  );
}
