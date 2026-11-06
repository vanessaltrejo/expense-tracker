"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/domain/money";
import { adjustCajitaBalance } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

export function AdjustmentForm() {
  const { data, dashboard, today, runAction } = useFinance();
  const router = useRouter();
  const [balanceText, setBalanceText] = useState("");

  const current = dashboard.balances.cajita;
  const realBalance = parseMoneyInput(balanceText);
  const difference = realBalance === null ? null : realBalance - current;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (realBalance === null || difference === 0 || difference === null) return;

    void runAction(`Rendimiento registrado: ${formatMoney(difference)}`, () =>
      adjustCajitaBalance(data, realBalance, today),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <p className="amount text-sm text-ink-soft">
        La app tiene {formatMoney(current)} en tu cajita. Escribe lo que ves en Nu y
        la diferencia se guarda como rendimiento.
      </p>
      <AmountField
        label="Saldo real en Nu"
        value={balanceText}
        onChange={setBalanceText}
      />
      {difference !== null && difference !== 0 ? (
        <p className="amount text-sm font-medium">
          Diferencia: {difference > 0 ? "+" : ""}
          {formatMoney(difference)}
        </p>
      ) : null}
      <button
        type="submit"
        className="btn-primary"
        disabled={difference === null || difference === 0}
      >
        Guardar ajuste
      </button>
    </form>
  );
}
