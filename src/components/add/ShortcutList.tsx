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

/** Three per row, two rows before "Más". */
const VISIBLE = 6;

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
  const { today, runAction } = useFinance();
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
        logShortcutWithPrice(shortcut, amount, today),
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
  const [expanded, setExpanded] = useState(false);

  if (data.shortcuts.length === 0) return null;

  // Two rows of three fit without scrolling; with more, "Más" opens the rest in place.
  const isCrowded = data.shortcuts.length > VISIBLE;
  const shown = isCrowded && !expanded ? data.shortcuts.slice(0, VISIBLE - 1) : data.shortcuts;

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
      logShortcut(shortcut, today),
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

      <ul className="grid grid-cols-3 gap-2">
        {shown.map((shortcut) => (
          <li key={shortcut.id} className="flex">
            <button
              type="button"
              className={`tile w-full ${isEditing ? "border-dashed border-accent" : ""}`}
              onClick={() => handleTap(shortcut)}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {getCategoryIcon(shortcut.category)}
              </span>
              <span className="line-clamp-2 w-full text-[0.6875rem] leading-tight wrap-break-word">
                {shortcut.name}
              </span>
              <span className="amount text-xs font-normal text-ink-soft">
                {shortcut.amount === null ? "Poner precio" : formatMoney(shortcut.amount)}
              </span>
            </button>
          </li>
        ))}
        {isCrowded ? (
          <li className="flex">
            <button
              type="button"
              aria-expanded={expanded}
              className="tile w-full text-ink-soft"
              onClick={() => setExpanded(!expanded)}
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {expanded ? "▴" : "⋯"}
              </span>
              <span className="text-[0.6875rem] leading-tight">{expanded ? "Menos" : "Más"}</span>
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
