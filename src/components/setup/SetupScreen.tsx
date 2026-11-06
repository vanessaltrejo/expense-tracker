"use client";

import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

import { formatLongDate } from "@/domain/dates";
import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { type OpeningPocket, setupOpeningBalances } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { POCKET_STYLES } from "../ui/styles";

const FIELDS: { pocket: OpeningPocket; hint: string }[] = [
  { pocket: "cajita", hint: "Lo que ves en tu cajita Turbo en Nu." },
  { pocket: "banorte", hint: "Si ya lo pasaste todo a la cajita, déjalo vacío." },
  { pocket: "efectivo", hint: "El que traes en la cartera." },
];

export function SetupScreen() {
  const { today, runAction, syncState } = useFinance();
  const [values, setValues] = useState<Record<OpeningPocket, string>>({
    cajita: "",
    banorte: "",
    efectivo: "",
  });

  const parsed = Object.fromEntries(
    FIELDS.map(({ pocket }) => [
      pocket,
      values[pocket] === "" ? 0 : parseMoneyInput(values[pocket]),
    ]),
  ) as Record<OpeningPocket, number | null>;
  const allValid = FIELDS.every(({ pocket }) => parsed[pocket] !== null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!allValid) return;
    const balances = parsed as Record<OpeningPocket, number>;
    void runAction("Listo, ya empezaste con tus saldos reales", () =>
      setupOpeningBalances(balances, today),
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="px-1">
        <p className="text-sm text-ink-soft first-letter:uppercase">
          {formatLongDate(today)}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Empecemos con tus saldos de hoy</h1>
        <p className="mt-2 text-ink-soft">
          Escribe cuánto dinero hay en cada bolsa ahorita. Lo que debes en la tarjeta y la
          Deuda mami salen de tus movimientos. Tus gastos fijos, cortes y atajos ya están
          cargados.
        </p>
      </div>

      {syncState.status === "signedOut" ? (
        <div className="card bg-accent-soft">
          <p className="text-sm">
            ¿Ya usas la app en otro dispositivo? Conecta tu Google primero y tus saldos
            llegan solos.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void signIn("google", { redirectTo: "/" })}
          >
            Conectar con Google
          </button>
        </div>
      ) : null}

      <div className="card gap-4">
        {FIELDS.map(({ pocket, hint }) => (
          <div key={pocket} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-8 size-3 shrink-0 rounded-full ${POCKET_STYLES[pocket].bar}`}
            />
            <div className="min-w-0 flex-1">
              <AmountField
                label={ENDPOINT_LABELS[pocket]}
                value={values[pocket]}
                onChange={(value) => setValues({ ...values, [pocket]: value })}
                hint={hint}
              />
            </div>
          </div>
        ))}
      </div>

      {allValid ? (
        <p className="amount px-1 text-sm text-ink-soft">
          Dinero real:{" "}
          <span className="font-semibold text-ink">
            {formatMoney((parsed.cajita ?? 0) + (parsed.banorte ?? 0) + (parsed.efectivo ?? 0))}
          </span>
        </p>
      ) : (
        <p className="px-1 text-sm font-medium text-danger">
          Revisa los montos: solo números, por ejemplo 1,250.50
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={!allValid}>
        Empezar
      </button>
    </form>
  );
}
