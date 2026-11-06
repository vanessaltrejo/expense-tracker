"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { MovementDraft, MovementEndpoint, PocketId } from "@/domain/types";
import { addMovement, saveShortcut } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { formatCategory, getCategoryIcon } from "../ui/styles";

export type MovementFormKind = "expense" | "income";

/** The card goes first because almost every expense is paid with it. */
const EXPENSE_SOURCES: MovementEndpoint[] = ["tarjetaNu", "efectivo", "cajita", "banorte"];
/** What her mom sends always lands in Banorte, so that income never asks where it went. */
const MOM_INCOME_CATEGORY = "mamá";
const INCOME_TARGETS: PocketId[] = ["banorte", "efectivo"];
function PocketSelect<T extends MovementEndpoint>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <select
        className="field"
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option === event.target.value);
          if (next) onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {ENDPOINT_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MovementForm({ kind }: { kind: MovementFormKind }) {
  const { data, today, runAction } = useFinance();
  const router = useRouter();

  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [keepAsShortcut, setKeepAsShortcut] = useState(false);
  const [expenseFrom, setExpenseFrom] = useState<MovementEndpoint>("tarjetaNu");
  const [incomeTo, setIncomeTo] = useState<PocketId>("banorte");

  const amount = parseMoneyInput(amountText);
  const isFromMom = kind === "income" && category === MOM_INCOME_CATEGORY;
  const canSubmit =
    amount !== null &&
    amount > 0 &&
    Boolean(date) &&
    category !== null;

  const categories =
    kind === "income" ? data.settings.incomeCategories : data.settings.expenseCategories;

  const buildDraft = (validAmount: number): MovementDraft => {
    const base = {
      date,
      amount: validAmount,
      note: note.trim(),
      dataKind: "real" as const,
      category,
    };
    switch (kind) {
      case "expense":
        return {
          ...base,
          // Paying with the card raises the card debt; any other way spends from a pocket.
          type: expenseFrom === "tarjetaNu" ? "cardExpense" : "expense",
          from: expenseFrom,
          to: null,
        };
      case "income":
        return { ...base, type: "income", from: null, to: isFromMom ? "banorte" : incomeTo };
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;

    const draft = buildDraft(amount);
    const shortcutSource = draft.from;
    void runAction(`Guardado: ${formatMoney(amount)}`, async () => {
      if (keepAsShortcut && category && shortcutSource) {
        await saveShortcut({
          name: draft.note || category,
          amount,
          category,
          paidFrom: shortcutSource,
        });
      }
      return addMovement(draft);
    });
    router.push("/");
  };

  const canSaveShortcut = kind === "expense";

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />

      <label className="field-label">
        ¿En qué fue?
        <input
          className="field"
          type="text"
          placeholder={kind === "income" ? "Ej. quincena de horno³" : "Ej. chilaquiles Super Salads"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <span className="text-xs font-normal">Así se verá en tu historial.</span>
      </label>

      {kind === "expense" ? (
        <PocketSelect
          label="¿Con qué se pagó?"
          value={expenseFrom}
          options={EXPENSE_SOURCES}
          onChange={setExpenseFrom}
        />
      ) : null}

      {kind === "income" && !isFromMom ? (
        <PocketSelect
          label="¿A dónde cayó?"
          value={incomeTo}
          options={INCOME_TARGETS}
          onChange={setIncomeTo}
        />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={category === option}
              className="chip"
              onClick={() => setCategory(option)}
            >
              <span aria-hidden="true">{getCategoryIcon(option)}</span>
              <span>{formatCategory(option)}</span>
            </button>
          ))}
        </div>
      </fieldset>

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

      {canSaveShortcut ? (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={keepAsShortcut}
            onChange={(event) => setKeepAsShortcut(event.target.checked)}
          />
          Guardar como frecuente
        </label>
      ) : null}

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}
