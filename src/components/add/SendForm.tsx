"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { formatMoney, parseMoneyInput } from "@/domain/money";
import { addMovement } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";

const DEFAULT_PEOPLE = ["Vanessa", "Mamá", "Papá"];
const NOTE_PREFIX = "A ";

/**
 * Money sent to another person. It leaves the account but is not spending, so it is kept
 * apart from the categories: a transfer out of BBVA, with the person's name in the note.
 */
export function SendForm() {
  const { data, today, runAction } = useFinance();
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [date, setDate] = useState(today);

  // The people already sent to before show up as buttons too.
  const learned = data.movements
    .filter((movement) => movement.type === "transfer" && movement.from !== null && movement.to === null)
    .map((movement) => movement.note.replace(NOTE_PREFIX, "").trim())
    .filter((name) => name !== "");
  const people = [...DEFAULT_PEOPLE];
  for (const name of learned) {
    if (!people.some((known) => known.toLowerCase() === name.toLowerCase())) people.push(name);
  }

  const amount = parseMoneyInput(amountText);
  const recipient = (person ?? other).trim();
  const canSubmit = amount !== null && amount > 0 && recipient !== "" && Boolean(date);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;
    void runAction(`Enviaste ${formatMoney(amount)} a ${recipient}`, () =>
      addMovement({
        date,
        type: "transfer",
        amount,
        from: "bbva",
        to: null,
        category: null,
        note: `${NOTE_PREFIX}${recipient}`,
        dataKind: "real",
      }),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">¿A quién?</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={person === name}
              className="chip"
              onClick={() => {
                setPerson(person === name ? null : name);
                setOther("");
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field-label">
        O escribe otra persona
        <input
          className="field"
          type="text"
          placeholder="Nombre"
          value={other}
          onChange={(event) => {
            setOther(event.target.value);
            setPerson(null);
          }}
        />
      </label>

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

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}
