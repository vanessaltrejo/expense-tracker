"use client";

import { useState } from "react";

import { PENDING_CATEGORY } from "@/data/seedData";
import { getCategoryOptions } from "@/domain/categories";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import { getFrequentPlaces } from "@/domain/places";
import type { Cents } from "@/domain/types";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { formatCategory, getCategoryIcon } from "../ui/styles";
import { CategoryPicker } from "./CategoryPicker";
import { PlacePicker } from "./PlacePicker";

export interface BreakdownPart {
  key: string;
  amount: Cents;
  category: string;
  note: string;
}

let nextKey = 0;

/**
 * A receipt under a bank movement: what a cash withdrawal paid for, or what a transfer
 * settled. Each part is a spend with its own category and place. Parts don't have to add
 * up to the total: part of the money may not be accounted for.
 */
export function BreakdownEditor({
  title,
  total,
  parts,
  onChange,
}: {
  title: string;
  /** The amount of the bank movement, to show how much is accounted for. */
  total: Cents | null;
  parts: BreakdownPart[];
  onChange: (parts: BreakdownPart[]) => void;
}) {
  const { data } = useFinance();
  const [isAdding, setIsAdding] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const categories = getCategoryOptions(data.settings.expenseCategories, data.movements, true, [
    PENDING_CATEGORY,
  ]);
  const places = getFrequentPlaces(data.movements, data.settings, category);
  const asksForPlace = category !== null && data.settings.placeCategories.includes(category);
  const amount = parseMoneyInput(amountText);
  const canAdd = amount !== null && amount > 0 && category !== null;
  const listed = parts.reduce((sum, part) => sum + part.amount, 0);

  const close = () => {
    setIsAdding(false);
    setAmountText("");
    setCategory(null);
    setNote("");
  };

  const add = () => {
    if (!canAdd || amount === null || category === null) return;
    nextKey += 1;
    onChange([...parts, { key: `part-${nextKey}`, amount, category, note: note.trim() }]);
    close();
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">{title}</legend>

      {parts.length > 0 ? (
        <div className="rounded-xl bg-page px-3 py-2">
          <ul className="flex flex-col">
            {parts.map((part) => (
              <li key={part.key} className="flex items-center gap-2 py-0.5 text-sm">
                <span aria-hidden="true" className="w-5 shrink-0 text-center">
                  {getCategoryIcon(part.category)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium first-letter:uppercase">
                    {part.note || formatCategory(part.category)}
                  </span>
                  {part.note && part.note.trim().toLowerCase() !== part.category.toLowerCase() ? (
                    <span className="text-ink-soft"> · {formatCategory(part.category)}</span>
                  ) : null}
                </span>
                <span className="amount shrink-0 font-medium">{formatMoney(part.amount)}</span>
                <button
                  type="button"
                  className="-my-1 flex min-h-11 min-w-9 items-center justify-center text-ink-soft"
                  aria-label={`Quitar ${part.note || formatCategory(part.category)}`}
                  onClick={() => onChange(parts.filter((item) => item.key !== part.key))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {total !== null ? (
            <p className="amount mt-1 border-t border-line pt-1.5 text-xs text-ink-soft">
              Desglosado {formatMoney(listed)} de {formatMoney(total)}
            </p>
          ) : null}
        </div>
      ) : null}

      {isAdding ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line p-3">
          <AmountField label="Monto de esta parte" value={amountText} onChange={setAmountText} autoFocus />
          <CategoryPicker options={categories} value={category} onChange={setCategory} />
          {places.length > 0 ? (
            <PlacePicker
              places={places}
              knownPlaces={data.settings.places}
              value={note}
              onChange={setNote}
              bleed="-mx-3 px-3"
            />
          ) : null}
          <label className="field-label">
            {asksForPlace ? "Lugar (o escribe otro)" : "Detalle (opcional)"}
            <input
              className="field"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary min-h-12" onClick={close}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" disabled={!canAdd} onClick={add}>
              Agregar parte
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary min-h-12" onClick={() => setIsAdding(true)}>
          ＋ Agregar parte
        </button>
      )}
    </fieldset>
  );
}
