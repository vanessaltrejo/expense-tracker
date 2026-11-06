import {
  buildPaymentMovements,
  buildYieldAdjustment,
  getLedgerBalances,
  OPENING_BALANCE_CATEGORY,
  type PaymentInput,
} from "@/domain/ledger";
import { generateExpectedCharges } from "@/domain/recurring";
import type { Profile } from "@/domain/profile";
import type {
  AppData,
  Cents,
  ExpectedCharge,
  FixedExpense,
  IsoDate,
  Movement,
  MovementDraft,
  MovementEndpoint,
  PaymentPlan,
  PocketId,
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

export async function loadFinanceData(today: IsoDate): Promise<AppData> {
  const data = await repository.current.load();
  const charges = generateExpectedCharges(
    data.fixedExpenses,
    data.expectedCharges,
    today,
  );
  // Only the new charges are saved: sending all of them would overwrite a status that
  // was changed in the sheet, such as a charge marked Omitido by hand.
  const created = charges.slice(data.expectedCharges.length);
  if (created.length > 0) {
    await repository.current.addGeneratedCharges(created);
  }
  return { ...data, expectedCharges: charges };
}

export async function addMovement(draft: MovementDraft): Promise<Undo> {
  return undoMovements(await repository.current.addMovements([draft]));
}

export async function changeMovementCategory(
  movement: Movement,
  category: string,
): Promise<Undo> {
  await repository.current.updateMovement({ ...movement, category });
  return () => repository.current.updateMovement(movement);
}

export async function deleteMovement(movement: Movement): Promise<Undo> {
  await repository.current.deleteMovements([movement.id]);
  return () => repository.current.restoreMovements([movement]);
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

async function restartInterval(
  expense: FixedExpense,
  date: IsoDate,
): Promise<Undo> {
  if (expense.schedule.kind !== "everyNDays") return async () => undefined;

  await repository.current.saveFixedExpense({
    ...expense,
    schedule: { ...expense.schedule, lastDate: date },
  });
  return () => repository.current.saveFixedExpense(expense);
}

export async function logShortcut(
  shortcut: Shortcut,
  fixedExpenses: FixedExpense[],
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
  const linked = fixedExpenses.find(
    (expense) => expense.id === shortcut.fixedExpenseId,
  );
  const undoInterval = linked
    ? await restartInterval(linked, today)
    : async () => undefined;

  return async () => {
    await undoMovements(created)();
    await undoInterval();
  };
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
  fixedExpenses: FixedExpense[],
  today: IsoDate,
): Promise<Undo> {
  const priced = { ...shortcut, amount };
  await repository.current.saveShortcut(priced);
  return logShortcut(priced, fixedExpenses, today);
}

/** Only the money the user holds needs an opening balance: card debt and Deuda mami come from movements. */
export type OpeningPocket = Extract<PocketId, "cajita" | "banorte" | "efectivo">;

const SETUP_POCKETS: OpeningPocket[] = ["cajita", "banorte", "efectivo"];

/** Every pocket gets an opening row, even at 0, so the pocket has a clear starting date. */
export async function setupOpeningBalances(
  balances: Record<OpeningPocket, Cents>,
  today: IsoDate,
): Promise<void> {
  const drafts: MovementDraft[] = SETUP_POCKETS.map((pocket) => ({
    date: today,
    type: "adjustment",
    amount: balances[pocket],
    from: null,
    to: pocket,
    category: OPENING_BALANCE_CATEGORY,
    note: "Saldo inicial",
    dataKind: "real",
  }));
  await repository.current.addMovements(drafts);
  // Asks the browser not to clear this data when the phone runs low on space.
  await navigator.storage?.persist?.();
}

/** Records an interval expense on its real date and restarts its reminder. */
export async function logIntervalExpense(
  expense: FixedExpense,
  date: IsoDate,
  paidFrom: MovementEndpoint,
): Promise<Undo> {
  const created = await repository.current.addMovements([
    toSpendingDraft({
      date,
      amount: expense.normalAmount,
      category: expense.category,
      note: paidFrom === "mama" ? `${expense.name} (las pagó mamá)` : expense.name,
      paidFrom,
    }),
  ]);
  const undoInterval = await restartInterval(expense, date);

  return async () => {
    await undoMovements(created)();
    await undoInterval();
  };
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

export async function changeChargeAmount(
  charge: ExpectedCharge,
  charges: ExpectedCharge[],
  amount: Cents,
): Promise<void> {
  await updateCharge(charges, { ...charge, amount });
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

/** Registers a payment and releases that much money from the plan. */
export async function registerPayment(
  input: PaymentInput,
  plan: PaymentPlan,
): Promise<Undo> {
  const created = await repository.current.addMovements(buildPaymentMovements(input));
  await repository.current.savePaymentPlan({
    ...plan,
    fromCajita: Math.max(0, plan.fromCajita - input.fromCajita),
    fromCash: Math.max(0, plan.fromCash - input.fromCash),
    momGift: Math.max(0, plan.momGift - input.momGift),
  });

  return async () => {
    await undoMovements(created)();
    await repository.current.savePaymentPlan(plan);
  };
}

export async function adjustCajitaBalance(
  data: AppData,
  realBalance: Cents,
  today: IsoDate,
): Promise<Undo | null> {
  const current = getLedgerBalances(
    data.movements,
    today,
    data.settings.annualYieldRate,
  ).cajita;
  const adjustment = buildYieldAdjustment(current, realBalance, today);
  return adjustment ? addMovement(adjustment) : null;
}

/** A JSON copy of everything, in case access to the device or the sheet is lost. */
export async function getStoredProfile(): Promise<Profile | null> {
  return repository.current.getProfile();
}

export async function exportBackup(): Promise<string> {
  const data = await repository.current.load();
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2);
}
