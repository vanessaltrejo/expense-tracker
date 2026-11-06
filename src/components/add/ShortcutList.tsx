"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { Shortcut } from "@/domain/types";
import {
  deleteShortcut,
  logShortcut,
  logShortcutWithPrice,
  saveShortcut,
} from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { getCategoryIcon } from "../ui/styles";

type Editing =
  | { mode: "price"; shortcut: Shortcut }
  | { mode: "edit"; shortcut: Shortcut };

function ShortcutEditor({
  editing,
  onClose,
}: {
  editing: Editing;
  onClose: () => void;
}) {
  const { data, today, runAction } = useFinance();
  const router = useRouter();
  const { shortcut, mode } = editing;
  const [name, setName] = useState(shortcut.name);
  const [amountText, setAmountText] = useState(
    shortcut.amount === null ? "" : (shortcut.amount / 100).toFixed(2),
  );
  const amount = parseMoneyInput(amountText);
  const isValid = amount !== null && amount > 0 && name.trim() !== "";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || amount === null) return;
    onClose();

    if (mode === "price") {
      void runAction(`${shortcut.name}, ${formatMoney(amount)}`, () =>
        logShortcutWithPrice(shortcut, amount, data.fixedExpenses, today),
      );
      router.push("/");
      return;
    }
    void runAction("Atajo actualizado", () =>
      saveShortcut({ ...shortcut, name: name.trim(), amount }),
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-page p-3">
      {mode === "price" ? (
        <p className="text-sm font-medium">
          ¿Cuánto cuesta {shortcut.name}? Lo guardo para la próxima.
        </p>
      ) : (
        <label className="field-label">
          Nombre
          <input
            className="field bg-surface"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      )}
      <AmountField label="Precio" value={amountText} onChange={setAmountText} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary min-h-12 bg-surface" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={!isValid}>
          {mode === "price" ? "Guardar gasto" : "Guardar"}
        </button>
      </div>
      {mode === "edit" ? (
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-danger"
          onClick={() => {
            onClose();
            void runAction("Atajo borrado", () => deleteShortcut(shortcut));
          }}
        >
          Borrar atajo
        </button>
      ) : null}
    </form>
  );
}

export function ShortcutList() {
  const { data, today, runAction } = useFinance();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  if (data.shortcuts.length === 0) return null;

  const handleTap = (shortcut: Shortcut) => {
    if (isEditing) {
      setEditing({ mode: "edit", shortcut });
      return;
    }
    if (shortcut.amount === null) {
      setEditing({ mode: "price", shortcut });
      return;
    }
    void runAction(`${shortcut.name}, ${formatMoney(shortcut.amount)}`, () =>
      logShortcut(shortcut, data.fixedExpenses, today),
    );
    router.push("/");
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="card-title">
          {isEditing ? "Toca un atajo para editarlo" : "Un toque y listo"}
        </h2>
        <button
          type="button"
          className="-my-2 min-h-11 px-2 text-sm font-semibold text-accent"
          onClick={() => {
            setIsEditing(!isEditing);
            setEditing(null);
          }}
        >
          {isEditing ? "Listo" : "Editar"}
        </button>
      </div>

      {editing ? (
        <ShortcutEditor
          key={`${editing.mode}-${editing.shortcut.id}`}
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ul className="grid grid-cols-2 gap-2">
        {data.shortcuts.map((shortcut) => (
          <li key={shortcut.id} className="flex">
            <button
              type="button"
              className={`flex min-h-18 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left active:bg-page ${
                isEditing ? "border-dashed border-accent" : "border-line"
              }`}
              onClick={() => handleTap(shortcut)}
            >
              <span aria-hidden="true" className="text-xl">
                {getCategoryIcon(shortcut.category)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-medium">{shortcut.name}</span>
                <span className="amount block text-sm text-ink-soft">
                  {shortcut.amount === null ? "Poner precio" : formatMoney(shortcut.amount)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
