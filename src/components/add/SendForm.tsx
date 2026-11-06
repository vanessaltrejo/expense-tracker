"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { gaveNote, getLoanBalances, gotBackNote, isPersonNote, LOAN_CATEGORY, personOf } from "@/domain/loans";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { PocketId } from "@/domain/types";
import { addMovement, addMovementWithBreakdown } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { BreakdownEditor, type BreakdownPart } from "./BreakdownEditor";

const DEFAULT_PEOPLE = ["Vanessa", "Mamá", "Papá"];
/** Where the money comes from or lands: the account, or cash in hand. */
const POCKETS: PocketId[] = ["bbva", "efectivo"];

type Direction = "give" | "back";
type Reason = "loan" | "gift";

/**
 * Money that goes to another person or comes back from them. None of it is spending or
 * income, so it is kept apart from the categories:
 * - give, as a loan: a transfer out tagged "préstamo"; the app counts what is still owed.
 * - give, with no return: a plain transfer out with the person's name.
 * - back: a transfer in tagged "préstamo", which lowers what that person owes.
 */
export function SendForm() {
  const { data, today, runAction } = useFinance();
  const router = useRouter();
  const [direction, setDirection] = useState<Direction>("give");
  const [reason, setReason] = useState<Reason>("loan");
  const [pocket, setPocket] = useState<PocketId>("bbva");
  const [amountText, setAmountText] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [date, setDate] = useState(today);
  const [parts, setParts] = useState<BreakdownPart[]>([]);

  const owing = getLoanBalances(data.movements);
  const isBack = direction === "back";

  // People already given to or paid back by show up as buttons too.
  const learned = data.movements
    .filter(
      (movement) =>
        movement.type === "transfer" &&
        (movement.from === null) !== (movement.to === null) &&
        isPersonNote(movement.note),
    )
    .map((movement) => personOf(movement.note))
    .filter((name) => name !== "");
  const everyone = [...DEFAULT_PEOPLE];
  for (const name of learned) {
    if (!everyone.some((known) => known.toLowerCase() === name.toLowerCase())) everyone.push(name);
  }
  // When money comes back, the ones who owe go first, since they are the likely ones.
  const people = isBack
    ? [
        ...owing.map((item) => item.person),
        ...everyone.filter((name) => !owing.some((item) => item.person.toLowerCase() === name.toLowerCase())),
      ]
    : everyone;

  const amount = parseMoneyInput(amountText);
  const recipient = (person ?? other).trim();
  const canSubmit = amount !== null && amount > 0 && recipient !== "" && Boolean(date);
  const owedBy = (name: string) =>
    owing.find((item) => item.person.toLowerCase() === name.toLowerCase())?.owed ?? 0;
  const chosenOwes = recipient === "" ? 0 : owedBy(recipient);

  const pickPerson = (name: string) => {
    const next = person === name ? null : name;
    setPerson(next);
    setOther("");
    // Paying back what is owed is the usual case, so the amount comes filled in.
    if (isBack && next && amountText === "" && owedBy(next) > 0) {
      setAmountText((owedBy(next) / 100).toFixed(2));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;

    if (isBack) {
      void runAction(`${recipient} te regresó ${formatMoney(amount)}`, () =>
        addMovement({
          date,
          type: "transfer",
          amount,
          from: null,
          to: pocket,
          category: LOAN_CATEGORY,
          note: gotBackNote(recipient),
          dataKind: "real",
        }),
      );
    } else {
      const movement = {
        date,
        type: "transfer" as const,
        amount,
        from: pocket,
        to: null,
        category: reason === "loan" ? LOAN_CATEGORY : null,
        note: gaveNote(recipient),
        dataKind: "real" as const,
      };
      // Only money that isn't coming back is accounted for in parts.
      const spent = reason === "gift" ? parts : [];
      void runAction(
        reason === "loan"
          ? `Le prestaste ${formatMoney(amount)} a ${recipient}`
          : `Enviaste ${formatMoney(amount)} a ${recipient}`,
        () =>
          spent.length === 0
            ? addMovement(movement)
            : addMovementWithBreakdown(
                movement,
                // The money left with the transfer, so the parts don't take from any pocket.
                spent.map((part) => ({
                  date,
                  type: "expense" as const,
                  amount: part.amount,
                  from: null,
                  to: null,
                  category: part.category,
                  note: part.note,
                  dataKind: "real" as const,
                })),
              ),
      );
    }
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <div role="radiogroup" aria-label="Dar o recibir" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={!isBack}
          className="tile"
          onClick={() => setDirection("give")}
        >
          <span aria-hidden="true" className="text-2xl leading-none">↗</span>
          <span className="text-sm">Le di dinero</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isBack}
          className="tile"
          onClick={() => setDirection("back")}
        >
          <span aria-hidden="true" className="text-2xl leading-none">↙</span>
          <span className="text-sm">Me regresaron</span>
        </button>
      </div>

      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">
          {isBack ? "¿Quién te regresó?" : "¿A quién?"}
        </legend>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {people.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={person === name}
              className="chip shrink-0 whitespace-nowrap"
              onClick={() => pickPerson(name)}
            >
              {name}
              {isBack && owedBy(name) > 0 ? (
                <span className="amount text-xs font-normal text-ink-soft">
                  debe {formatMoney(owedBy(name))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <input
          className="field"
          type="text"
          aria-label="Otra persona"
          placeholder="O escribe otra persona"
          value={other}
          onChange={(event) => {
            setOther(event.target.value);
            setPerson(null);
          }}
        />
        {isBack && recipient !== "" && chosenOwes === 0 ? (
          <p className="text-xs text-ink-soft">
            No tienes un préstamo pendiente con {recipient}; se guarda de todos modos.
          </p>
        ) : null}
      </fieldset>

      {isBack ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Motivo</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={reason === "loan"}
              className="tile"
              onClick={() => setReason("loan")}
            >
              <span aria-hidden="true" className="text-2xl leading-none">🤝</span>
              <span className="text-sm">Préstamo</span>
              <span className="text-[0.6875rem] font-normal text-ink-soft">Me lo van a regresar</span>
            </button>
            <button
              type="button"
              aria-pressed={reason === "gift"}
              className="tile"
              onClick={() => setReason("gift")}
            >
              <span aria-hidden="true" className="text-2xl leading-none">🎁</span>
              <span className="text-sm">Sin regreso</span>
              <span className="text-[0.6875rem] font-normal text-ink-soft">Regalo o apoyo</span>
            </button>
          </div>
        </fieldset>
      )}

      {!isBack && reason === "gift" ? (
        <BreakdownEditor
          title="¿Para qué fue? (opcional)"
          total={amount}
          parts={parts}
          onChange={setParts}
        />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">
          {isBack ? "¿A dónde te lo regresaron?" : "¿Cómo se lo diste?"}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {POCKETS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={pocket === option}
              className="chip"
              onClick={() => setPocket(option)}
            >
              {option === "bbva" ? "Transferencia" : "Efectivo"}
              {option === "bbva" ? (
                <span className="text-xs font-normal text-ink-soft">{ENDPOINT_LABELS[option]}</span>
              ) : null}
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

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}
