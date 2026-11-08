"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { gaveNote, isPersonNote, personOf } from "@/domain/loans";
import { formatMoney, parseMoneyInput } from "@/domain/money";
import type { PocketId } from "@/domain/types";
import { addMovement, addMovementWithBreakdown } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";
import { AmountField } from "../ui/AmountField";
import { DateField } from "../ui/DateField";
import { BreakdownEditor, type BreakdownPart } from "./BreakdownEditor";

/** Deuda mami, the card and what mom sends (an income) have their own places in the app. */
type Place = Extract<PocketId, "banorte" | "cajita" | "efectivo" | "bbva">;
const SOURCES: Place[] = ["banorte", "cajita", "efectivo"];
const TARGETS: Place[] = ["cajita", "banorte", "efectivo"];
/** The simple layout has two places: the BBVA account and cash. */
const SIMPLE_PLACES: Place[] = ["bbva", "efectivo"];

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Place[];
  value: Place;
  onChange: (value: Place) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className="chip"
            onClick={() => onChange(option)}
          >
            {ENDPOINT_LABELS[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Moves money between your places: an amount, where it leaves and where it lands. */
function OwnTransferForm() {
  const { dashboard, today, runAction, user } = useFinance();
  const isSimple = user.layout === "simple";
  const sources = isSimple ? SIMPLE_PLACES : SOURCES;
  const targets = isSimple ? SIMPLE_PLACES : TARGETS;
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [from, setFrom] = useState<Place>(isSimple ? "bbva" : "banorte");
  const [to, setTo] = useState<Place>(isSimple ? "efectivo" : "cajita");
  const [date, setDate] = useState(today);

  const [parts, setParts] = useState<BreakdownPart[]>([]);

  const amount = parseMoneyInput(amountText);
  const canSubmit = amount !== null && amount > 0 && Boolean(date);
  // Taking cash out of BBVA is the one move with something to account for: what it paid for.
  const isWithdrawal = isSimple && from === "bbva" && to === "efectivo";

  // Picking a place that the other side already uses swaps them, so they never match.
  const pickFrom = (next: Place) => {
    if (next === to) setTo(from);
    setFrom(next);
  };
  const pickTo = (next: Place) => {
    if (next === from) setFrom(to);
    setTo(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || amount === null) return;

    const movement = {
      date,
      type: "transfer" as const,
      amount,
      from,
      to,
      category: null,
      note: isWithdrawal ? "Retiro de efectivo" : "",
      dataKind: "real" as const,
    };
    const spent = isWithdrawal ? parts : [];
    void runAction(`Guardado: ${formatMoney(amount)}`, () =>
      spent.length === 0
        ? addMovement(movement)
        : addMovementWithBreakdown(
            movement,
            // The cash is spent from the pocket the withdrawal filled.
            spent.map((part) => ({
              date,
              type: "expense" as const,
              amount: part.amount,
              from: "efectivo" as const,
              to: null,
              category: part.category,
              note: part.note,
              dataKind: "real" as const,
            })),
          ),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />
      <Choice label="De" options={sources} value={from} onChange={pickFrom} />
      <Choice label="A" options={targets} value={to} onChange={pickTo} />
      {isWithdrawal ? (
        <BreakdownEditor
          title="¿En qué se gastó este efectivo? (opcional)"
          total={amount}
          parts={parts}
          onChange={setParts}
        />
      ) : null}
      <p className="amount text-sm text-ink-soft">
        En {ENDPOINT_LABELS[from]} hay {formatMoney(dashboard.balances[from])}.
      </p>
      <DateField value={date} max={today} onChange={setDate} />
      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}

/** Who the card layout sends money to most. Others can be typed, and are remembered. */
const DEFAULT_PEOPLE = ["Mamá", "Francisco", "Roberto"];
const PERSON_SOURCES: Place[] = ["banorte", "cajita", "efectivo"];

/**
 * Money that goes to another person: it leaves one of your places and isn't spending, so
 * it shows under "Enviaste a otras personas" in the Summary, not in the categories.
 */
function PersonTransferForm() {
  const { data, dashboard, today, runAction } = useFinance();
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [from, setFrom] = useState<Place>("banorte");
  const [date, setDate] = useState(today);

  const people = [...DEFAULT_PEOPLE];
  for (const movement of data.movements) {
    if (movement.type !== "transfer" || movement.to !== null || movement.from === null) continue;
    if (!isPersonNote(movement.note)) continue;
    const name = personOf(movement.note);
    if (name !== "" && !people.some((known) => known.toLowerCase() === name.toLowerCase())) {
      people.push(name);
    }
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
        from,
        to: null,
        category: null,
        note: gaveNote(recipient),
        dataKind: "real",
      }),
    );
    router.push("/");
  };

  return (
    <form onSubmit={handleSubmit} className="card gap-4">
      <AmountField label="Monto" value={amountText} onChange={setAmountText} size="large" />

      <fieldset className="flex min-w-0 flex-col gap-2">
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
      </fieldset>

      <Choice label="¿De dónde sale?" options={PERSON_SOURCES} value={from} onChange={setFrom} />
      <p className="amount text-sm text-ink-soft">
        En {ENDPOINT_LABELS[from]} hay {formatMoney(dashboard.balances[from])}.
      </p>

      <DateField value={date} max={today} onChange={setDate} />

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Guardar
      </button>
    </form>
  );
}

/**
 * The card layout can also send money to someone, so it first asks which kind of move this
 * is. The simple layout only moves between BBVA and cash; its person sends live in Transferí.
 */
export function TransferForm() {
  const { user } = useFinance();
  const [mode, setMode] = useState<"own" | "person">("own");

  if (user.layout === "simple") return <OwnTransferForm />;

  return (
    <>
      <div role="radiogroup" aria-label="Tipo de movimiento de dinero" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "own"}
          className="tile"
          onClick={() => setMode("own")}
        >
          <span aria-hidden="true" className="text-2xl leading-none">⇄</span>
          <span className="text-sm">Entre mis bolsas</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "person"}
          className="tile"
          onClick={() => setMode("person")}
        >
          <span aria-hidden="true" className="text-2xl leading-none">↗</span>
          <span className="text-sm">A una persona</span>
        </button>
      </div>
      {mode === "own" ? <OwnTransferForm /> : <PersonTransferForm />}
    </>
  );
}
