import { partId } from "@/domain/breakdown";
import { createMovementId } from "@/domain/ids";
import { findStaleCharges, generateExpectedCharges } from "@/domain/recurring";
import type {
  AppData,
  Cents,
  ExpectedCharge,
  IsoDate,
  Movement,
  MovementDraft,
  MovementEndpoint,
  PaymentPlan,
  Shortcut,
} from "@/domain/types";
import { getFinanceRepository } from "./financeRepository";

const repository = {
  get current() {
    return getFinanceRepository();
  },
};

export type Undo = () => Promise<void>;

function undoMovements(created: Movement[]): Undo {
  return () => repository.current.deleteMovements(created.map((item) => item.id));
}

/** Read-only viewers see the generated charges but never save them. */
export async function loadFinanceData(today: IsoDate, canEdit: boolean): Promise<AppData> {
  const data = await repository.current.load();
  // Charges the schedule no longer produces (its day changed) are dropped before new ones are made.
  const stale = findStaleCharges(data.fixedExpenses, data.expectedCharges, today);
  const staleIds = new Set(stale.map((charge) => charge.id));
  const existing = data.expectedCharges.filter((charge) => !staleIds.has(charge.id));
  if (canEdit && stale.length > 0) {
    await repository.current.deleteExpectedCharges([...staleIds]);
  }

  const charges = generateExpectedCharges(data.fixedExpenses, existing, today);
  // Only the new charges are saved: sending all of them would overwrite a status that
  // was changed in the sheet, such as a charge marked Omitido by hand.
  const created = charges.slice(existing.length);
  if (canEdit && created.length > 0) {
    await repository.current.addGeneratedCharges(created);
  }
  return { ...data, expectedCharges: charges };
}

export async function addMovement(draft: MovementDraft): Promise<Undo> {
  return undoMovements(await repository.current.addMovements([draft]));
}

/**
 * A bank movement with its breakdown, saved together so they can't end up apart. Each
 * part is named after the movement ("id.1", "id.2"…), which is how the app finds them.
 */
export async function addMovementWithBreakdown(
  movement: MovementDraft,
  parts: MovementDraft[],
): Promise<Undo> {
  const id = createMovementId(movement.date);
  const created = await repository.current.addMovements([
    { ...movement, id },
    ...parts.map((part, index) => ({ ...part, id: partId(id, index + 1) })),
  ]);
  return undoMovements(created);
}

export async function changeMovementCategory(
  movement: Movement,
  category: string,
): Promise<Undo> {
  await repository.current.updateMovement({ ...movement, category });
  return () => repository.current.updateMovement(movement);
}

/**
 * Fixes the amount, the day or the note of a movement, keeping everything else as it was.
 * The parts of its breakdown move with it when the day changes, so the spending they hold
 * stays in the same period as the bank movement.
 */
export async function editMovement(
  movement: Movement,
  changes: Pick<Movement, "amount" | "date" | "note">,
  parts: Movement[] = [],
): Promise<Undo> {
  const before = [movement, ...parts];
  await repository.current.saveMovements([
    { ...movement, ...changes },
    ...parts.map((part) => ({ ...part, date: changes.date })),
  ]);
  return () => repository.current.saveMovements(before);
}

/** Deleting a movement takes its breakdown with it, so no orphan parts are left behind. */
export async function deleteMovement(movement: Movement, parts: Movement[] = []): Promise<Undo> {
  const removed = [movement, ...parts];
  await repository.current.deleteMovements(removed.map((item) => item.id));
  return () => repository.current.saveMovements(removed);
}

function toSpendingDraft(input: {
  date: IsoDate;
  amount: Cents;
  category: string;
  note: string;
  paidFrom: MovementEndpoint;
}): MovementDraft {
  return {
    date: input.date,
    type: input.paidFrom === "tarjetaNu" ? "cardExpense" : "expense",
    amount: input.amount,
    from: input.paidFrom,
    to: null,
    category: input.category,
    note: input.note,
    dataKind: "real",
  };
}

export async function logShortcut(
  shortcut: Shortcut,
  today: IsoDate,
): Promise<Undo> {
  if (shortcut.amount === null) {
    throw new Error("A shortcut needs a price before it can be logged");
  }
  const created = await repository.current.addMovements([
    toSpendingDraft({
      date: today,
      amount: shortcut.amount,
      category: shortcut.category,
      note: shortcut.name,
      paidFrom: shortcut.paidFrom,
    }),
  ]);
  return undoMovements(created);
}

export async function saveShortcut(
  shortcut: Omit<Shortcut, "id"> & { id?: string },
): Promise<void> {
  await repository.current.saveShortcut(shortcut);
}

export async function deleteShortcut(shortcut: Shortcut): Promise<Undo> {
  await repository.current.deleteShortcut(shortcut.id);
  return async () => {
    await repository.current.saveShortcut(shortcut);
  };
}

/** Uses a shortcut, saving its price first when it didn't have one yet. */
export async function logShortcutWithPrice(
  shortcut: Shortcut,
  amount: Cents,
  today: IsoDate,
): Promise<Undo> {
  const priced = { ...shortcut, amount };
  await repository.current.saveShortcut(priced);
  return logShortcut(priced, today);
}

/** Saves just the charge that changed, so a status edited in the sheet is never overwritten. */
function updateCharge(updated: ExpectedCharge): Promise<void> {
  return repository.current.saveExpectedCharges([updated]);
}

export async function confirmCharge(
  charge: ExpectedCharge,
  today: IsoDate,
  /** The day it really got charged, when it wasn't the scheduled one. */
  chargedOn?: IsoDate,
): Promise<Undo> {
  // A charge can't be dated in the future: if it arrived early, it counts from today.
  const date = chargedOn ?? (charge.date <= today ? charge.date : today);
  const created = await repository.current.addMovements([
    toSpendingDraft({
      date,
      amount: charge.amount,
      category: charge.category,
      note: charge.name,
      paidFrom: "tarjetaNu",
    }),
  ]);
  // The charge keeps its ID but takes the real day, so the Sheet shows when it was really charged.
  await updateCharge({ ...charge, status: "charged", date });

  return async () => {
    await undoMovements(created)();
    await updateCharge(charge);
  };
}

export async function skipCharge(charge: ExpectedCharge): Promise<Undo> {
  await updateCharge({ ...charge, status: "skipped" });
  return () => updateCharge(charge);
}

export async function moveBanorteToCajita(
  amount: Cents,
  today: IsoDate,
): Promise<Undo> {
  return addMovement({
    date: today,
    type: "transfer",
    amount,
    from: "banorte",
    to: "cajita",
    category: null,
    note: "De Banorte a la cajita",
    dataKind: "real",
  });
}

export async function savePaymentPlan(plan: PaymentPlan): Promise<void> {
  await repository.current.savePaymentPlan(plan);
}

/** A JSON copy of everything, in case access to the device or the sheet is lost. */
export async function exportBackup(): Promise<string> {
  const data = await repository.current.load();
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2);
}
