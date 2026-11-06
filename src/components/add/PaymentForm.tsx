"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/domain/money";
import { registerPayment } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

export function PaymentForm() {
  const { data, dashboard, today, runAction } = useFinance();
  const router = useRouter();
  const [cajitaText, setCajitaText] = useState("");
  const [cashText, setCashText] = useState("");
  const [giftText, setGiftText] = useState("");
  const [date, setDate] = useState(today);

  const fromCajita = cajitaText ? parseMoneyInput(cajitaText) : 0;
  const fromCash = cashText ? parseMoneyInput(cashText) : 0;
  const momGift = giftText ? parseMoneyInput(giftText) : 0;

  const isValid = fromCajita !== null && fromCash !== null && momGift !== null;
  const total = isValid ? fromCajita + fromCash + momGift : 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || total === 0 || !date) return;

    void runAction(`Pago de ${formatMoney(total)} registrado`, () =>
      registerPayment({ date, fromCajita, fromCash, momGift }, data.paymentPlan),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <p className="amount text-sm text-ink-soft">
        Debes {formatMoney(dashboard.debt)} en total. Puedes pagar en varias partes.
      </p>
      <AmountField
        label="De la cajita"
        value={cajitaText}
        onChange={setCajitaText}
        hint={`Tienes ${formatMoney(dashboard.balances.cajita)}`}
      />
      <AmountField
        label="En efectivo (se lo diste a tu mamá)"
        value={cashText}
        onChange={setCashText}
        hint={`Tienes ${formatMoney(dashboard.balances.efectivo)}`}
      />
      <AmountField
        label="Lo que tu mamá puso de regalo"
        value={giftText}
        onChange={setGiftText}
        hint="Por ejemplo: le das 800, deposita 1,000, aquí van 200."
      />
      <label className="field-label">
        Fecha
        <input
          className="field"
          type="date"
          max={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="btn-primary amount"
        disabled={!isValid || total === 0 || !date}
      >
        Registrar pago de {formatMoney(total)}
      </button>
    </form>
  );
}
