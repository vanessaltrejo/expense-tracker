import type { Cents, IsoDate, Movement } from "./types.ts";

/**
 * Money handed to a relative that comes back later. It is a transfer, not spending:
 * giving it is a transfer out with this category, and the repayment is a transfer in.
 */
export const LOAN_CATEGORY = "préstamo";

const GAVE_PREFIX = "A ";
const GOT_BACK_PREFIX = "De ";

export function isLoan(movement: Movement): boolean {
  return (
    movement.dataKind === "real" &&
    movement.type === "transfer" &&
    movement.category === LOAN_CATEGORY &&
    (movement.from === null) !== (movement.to === null)
  );
}

/** True for notes written as "A Mamá" or "De Mamá", the ones that name a person. */
export function isPersonNote(note: string): boolean {
  const trimmed = note.trim();
  return trimmed.startsWith(GAVE_PREFIX) || trimmed.startsWith(GOT_BACK_PREFIX);
}

/** "A Mamá" and "De Mamá" both name Mamá. */
export function personOf(note: string): string {
  const trimmed = note.trim();
  if (trimmed.startsWith(GAVE_PREFIX)) return trimmed.slice(GAVE_PREFIX.length).trim();
  if (trimmed.startsWith(GOT_BACK_PREFIX)) return trimmed.slice(GOT_BACK_PREFIX.length).trim();
  return trimmed;
}

export function gaveNote(person: string): string {
  return `${GAVE_PREFIX}${person}`;
}

export function gotBackNote(person: string): string {
  return `${GOT_BACK_PREFIX}${person}`;
}

export interface LoanBalance {
  person: string;
  /** What this person still owes: what was lent minus what came back. Always positive. */
  owed: Cents;
  /** Date of the latest loan or repayment with this person. */
  lastDate: IsoDate;
}

/** Who still owes money, biggest debt first. People who are even or overpaid are left out. */
export function getLoanBalances(movements: Movement[]): LoanBalance[] {
  const people = new Map<string, LoanBalance>();

  for (const movement of movements) {
    if (!isLoan(movement)) continue;
    const person = personOf(movement.note) || "Otra persona";
    const key = person.toLowerCase();
    const current = people.get(key) ?? { person, owed: 0, lastDate: movement.date };
    // Lent money (it left an account) raises the debt; money that came back lowers it.
    current.owed += movement.from !== null ? movement.amount : -movement.amount;
    if (movement.date > current.lastDate) current.lastDate = movement.date;
    people.set(key, current);
  }

  return [...people.values()]
    .filter((balance) => balance.owed > 0)
    .sort((a, b) => b.owed - a.owed);
}
