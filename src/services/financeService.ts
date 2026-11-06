import { partId } from "@/domain/breakdown";
import { createId } from "@/domain/ids";
import { generateExpectedCharges } from "@/domain/recurring";
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
  const charges = generateExpectedCharges(
    data.fixedExpenses,
    data.expectedCharges,
    today,
  );
  // Only the new charges are saved: sending all of them would overwrite a status that
  // was changed in the sheet, such as a charge marked Omitido by hand.
  const created = charges.slice(data.expectedCharges.length);
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
  const id = createId("m");
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

/** Deleting a movement takes its breakdown with it, so no orphan parts are left behind. */
export async function deleteMovement(movement: Movement, parts: Movement[] = []): Promise<Undo> {
  const removed = [movement, ...parts];
  await repository.current.deleteMovements(removed.map((item) => item.id));
  return () => repository.current.restoreMovements(removed);
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

/** Saves just the charge that changed, for the same reason as above. */
async function updateCharge(
  _charges: ExpectedCharge[],
  updated: ExpectedCharge,
): Promise<void> {
  await repository.current.saveExpectedCharges([updated]);
}

export async function confirmCharge(
  charge: ExpectedCharge,
  charges: ExpectedCharge[],
  today: IsoDate,
): Promise<Undo> {
  // A charge can't be dated in the future: if it arrived early, it counts from today.
  const date = charge.date <= today ? charge.date : today;
  const created = await repository.current.addMovements([
    toSpendingDraft({
      date,
      amount: charge.amount,
      category: charge.category,
      note: charge.name,
      paidFrom: "tarjetaNu",
    }),
  ]);
  await updateCharge(charges, { ...charge, status: "charged" });

  return async () => {
    await undoMovements(created)();
    await updateCharge(charges, charge);
  };
}

export async function skipCharge(
  charge: ExpectedCharge,
  charges: ExpectedCharge[],
): Promise<Undo> {
  await updateCharge(charges, { ...charge, status: "skipped" });
  return () => updateCharge(charges, charge);
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
