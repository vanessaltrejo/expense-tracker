"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { MovementDraft, MovementEndpoint, PocketId } from "@/domain/types";
import { addMovement, saveShortcut } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { getCategoryIcon } from "../ui/styles";

export type MovementFormKind = "cardExpense" | "expense" | "income" | "transfer";

const EXPENSE_SOURCES: MovementEndpoint[] = ["efectivo", "cajita", "banorte", "mama"];
const INCOME_TARGETS: PocketId[] = ["banorte", "efectivo"];
const TRANSFER_POCKETS: PocketId[] = ["banorte", "cajita", "efectivo", "porCobrarMama"];

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
  const { data, dashboard, today, runAction } = useFinance();
  const router = useRouter();

  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [keepAsShortcut, setKeepAsShortcut] = useState(false);
  const [expenseFrom, setExpenseFrom] = useState<MovementEndpoint>("efectivo");
  const [incomeTo, setIncomeTo] = useState<PocketId>("banorte");
  const [transferFrom, setTransferFrom] = useState<PocketId>("banorte");
  const [transferTo, setTransferTo] = useState<PocketId>("cajita");

  const amount = parseMoneyInput(amountText);
  const needsCategory = kind !== "transfer";
  const samePocket = kind === "transfer" && transferFrom === transferTo;
  const canSubmit =
    amount !== null &&
    amount > 0 &&
    Boolean(date) &&
    !samePocket &&
    (!needsCategory || category !== null);

  const categories =
    kind === "income"
      ? data.settings.incomeCategories
      : data.settings.expenseCategories;

  const buildDraft = (validAmount: number): MovementDraft => {
    const base = {
      date,
      amount: validAmount,
      note: note.trim(),
      dataKind: "real" as const,
      category,
    };
    switch (kind) {
      case "cardExpense":
        return { ...base, type: "cardExpense", from: "tarjetaNu", to: null };
      case "expense":
        return { ...base, type: "expense", from: expenseFrom, to: null };
      case "income":
        return { ...base, type: "income", from: null, to: incomeTo };
      case "transfer":
        return {
          ...base,
          type: "transfer",
          from: transferFrom,
          to: transferTo,
          category: null,
        };
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
          fixedExpenseId: null,
        });
      }
      return addMovement(draft);
    });
    router.push("/");
  };

  const canSaveShortcut = kind === "cardExpense" || kind === "expense";

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />

      <label className="field-label">
        {kind === "transfer" ? "Nota (opcional)" : "¿En qué fue?"}
        <input
          className="field"
          type="text"
          placeholder={kind === "income" ? "Ej. quincena de horno³" : "Ej. chilaquiles Super Salads"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {kind !== "transfer" ? (
          <span className="text-xs font-normal">Así se verá en tu historial.</span>
        ) : null}
      </label>

      {kind === "expense" ? (
        <PocketSelect
          label="¿Con qué se pagó?"
          value={expenseFrom}
          options={EXPENSE_SOURCES}
          onChange={setExpenseFrom}
        />
      ) : null}

      {kind === "income" ? (
        <PocketSelect
          label="¿A dónde cayó?"
          value={incomeTo}
          options={INCOME_TARGETS}
          onChange={setIncomeTo}
        />
      ) : null}

      {kind === "transfer" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <PocketSelect
              label="De"
              value={transferFrom}
              options={TRANSFER_POCKETS}
              onChange={setTransferFrom}
            />
            <PocketSelect
              label="A"
              value={transferTo}
              options={TRANSFER_POCKETS}
              onChange={setTransferTo}
            />
          </div>
          <p className="amount text-sm text-ink-soft">
            {samePocket
              ? "Elige dos bolsas distintas."
              : `En ${ENDPOINT_LABELS[transferFrom]} hay ${formatMoney(dashboard.balances[transferFrom])}.`}
          </p>
        </>
      ) : null}

      {needsCategory ? (
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
                <span className="first-letter:uppercase">{option}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

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
