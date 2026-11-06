"use client";

import { type FormEvent, useState } from "react";

import { formatShortDate } from "@/domain/dates";
import { getOpeningDates, MOM_DEBT_CATEGORY } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { Movement, PocketId } from "@/domain/types";
import { addMovement, deleteMovement } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { POCKET_STYLES } from "../ui/styles";

const MOM: PocketId = "porCobrarMama";

type Mode = "newDebt" | "repayment" | null;

/** "registered": the purchase is already in the app (or in the opening debt), so only mom's side moves. */
type Source = PocketId | "registered";

const PAID_WITH: { id: Source; label: string }[] = [
  { id: "tarjetaNu", label: "Tarjeta" },
  { id: "efectivo", label: "Efectivo" },
  { id: "registered", label: "Ya está registrado" },
];

const SOURCE_HELP: Record<Source, string> = {
  tarjetaNu: "Lo pagaste con tu tarjeta: sube tu deuda de la tarjeta y Deuda mami por lo mismo.",
  efectivo: "Tu mamá te quitó efectivo: baja tu efectivo y sube Deuda mami.",
  cajita: "",
  banorte: "",
  porCobrarMama: "",
  bbva: "",
  registered:
    "Para algo que ya está en tu historial o en tu deuda inicial: solo sube Deuda mami, sin contarlo dos veces.",
};

/** She gives it back either in cash or by depositing it in Banorte. */
const RECEIVED_IN: { id: PocketId; label: string }[] = [
  { id: "banorte", label: "Banorte" },
  { id: "efectivo", label: "Efectivo" },
];

const RECEIVED_HELP: Partial<Record<Source, string>> = {
  banorte:
    "Te lo depositó en Banorte: de ahí lo pasas a la cajita y, el día que toque, pagas la tarjeta.",
  efectivo: "Te lo dio en efectivo: sube tu efectivo.",
};

function describe(movement: Movement): string {
  if (movement.note && movement.note !== "Saldo inicial") return movement.note;
  return movement.to === MOM ? "Lo que te debía al empezar" : "Te regresó";
}

/** What mom owes, item by item, with quick ways to add a new one or log a repayment. */
export function MomDebtCard() {
  const { data, dashboard, today, runAction, canEdit } = useFinance();
  const [mode, setMode] = useState<Mode>(null);
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [pocket, setPocket] = useState<Source>("tarjetaNu");

  const total = dashboard.balances[MOM];
  const opening = getOpeningDates(data.movements)[MOM];
  const items = data.movements
    .filter(
      (movement) =>
        movement.dataKind === "real" &&
        (movement.to === MOM || movement.from === MOM) &&
        (!opening || movement.date >= opening) &&
        movement.amount > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  if (total <= 0 && items.length === 0 && mode === null) return null;

  const amount = parseMoneyInput(amountText);
  const canSave =
    amount !== null && amount > 0 && (mode === "repayment" || note.trim() !== "");

  const open = (next: Mode) => {
    setMode(next);
    setAmountText("");
    setNote("");
    setPocket(next === "repayment" ? "banorte" : "tarjetaNu");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || amount === null || mode === null) return;
    const isNewDebt = mode === "newDebt";
    setMode(null);

    if (isNewDebt && pocket === "registered") {
      // The money already left (it is in the card debt), so only mom's side goes up.
      void runAction("Agregado a Deuda mami", () =>
        addMovement({
          date: today,
          type: "adjustment",
          amount,
          from: null,
          to: MOM,
          category: MOM_DEBT_CATEGORY,
          note: note.trim(),
          dataKind: "real",
        }),
      );
      return;
    }

    const source: PocketId = pocket === "registered" ? "efectivo" : pocket;
    void runAction(isNewDebt ? "Agregado a Deuda mami" : "Registrado lo que te regresó", () =>
      addMovement({
        date: today,
        // Paying something for mom isn't your spending: the money is owed back.
        type: "transfer",
        amount,
        from: isNewDebt ? source : MOM,
        to: isNewDebt ? MOM : source,
        category: null,
        note: isNewDebt ? note.trim() : note.trim() || "Te regresó",
        dataKind: "real",
      }),
    );
  };

  return (
    <section className={`card ${POCKET_STYLES[MOM].soft}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-semibold ${POCKET_STYLES[MOM].text}`}>Deuda mami</h2>
        <p className="amount text-2xl font-semibold">{formatMoney(total)}</p>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((movement) => {
            const isRepayment = movement.from === MOM;
            return (
              <li key={movement.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{describe(movement)}</span>
                  <span className="text-ink-soft"> · {formatShortDate(movement.date)}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className={`amount font-semibold ${isRepayment ? "text-good" : ""}`}>
                    {isRepayment ? "−" : ""}
                    {formatMoney(movement.amount)}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="-my-2 min-h-11 px-1 text-xs text-ink-soft underline underline-offset-2"
                      aria-label={`Quitar ${describe(movement)} de Deuda mami`}
                      onClick={() =>
                        void runAction("Quitado de Deuda mami", () => deleteMovement(movement))
                      }
                    >
                      Quitar
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!canEdit ? null : mode ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-surface p-3">
          <AmountField
            label={mode === "newDebt" ? "¿Cuánto te debe?" : "¿Cuánto te regresó?"}
            value={amountText}
            onChange={setAmountText}
            autoFocus
          />
          <label className="field-label">
            {mode === "newDebt" ? "¿Qué fue?" : "Nota (opcional)"}
            <input
              className="field"
              placeholder={mode === "newDebt" ? "Ej. viaje EGS" : "Ej. me pasó la mitad"}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-soft">
              {mode === "newDebt" ? "¿Cómo fue?" : "¿Cómo te lo regresó?"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(mode === "newDebt" ? PAID_WITH : RECEIVED_IN).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={pocket === option.id}
                  className="chip"
                  onClick={() => setPocket(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {mode === "newDebt" ? SOURCE_HELP[pocket] : RECEIVED_HELP[pocket]}
            </p>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary min-h-12" onClick={() => setMode(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!canSave}>
              Guardar
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary bg-surface" onClick={() => open("newDebt")}>
            Me debe algo nuevo
          </button>
          <button
            type="button"
            className="btn-secondary bg-surface"
            disabled={total <= 0}
            onClick={() => open("repayment")}
          >
            Ya me regresó
          </button>
        </div>
      )}
    </section>
  );
}
