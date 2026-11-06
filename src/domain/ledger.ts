import type {
  Cents,
  IsoDate,
  Movement,
  MovementDraft,
  MovementEndpoint,
  PocketId,
} from "./types.ts";

export const OPENING_BALANCE_CATEGORY = "Saldo inicial";
export const YIELD_CATEGORY = "Rendimiento";

export const POCKET_IDS: PocketId[] = [
  "cajita",
  "banorte",
  "efectivo",
  "porCobrarMama",
  "tarjetaNu",
];

export const ENDPOINT_LABELS: Record<MovementEndpoint, string> = {
  cajita: "Cajita Turbo",
  banorte: "Banorte",
  efectivo: "Efectivo",
  porCobrarMama: "Por cobrar (mamá)",
  tarjetaNu: "Tarjeta Nu",
  mama: "Mamá",
};

function isPocket(endpoint: MovementEndpoint | null): endpoint is PocketId {
  return endpoint !== null && endpoint !== "mama";
}

/** Each pocket starts counting on the date of its earliest opening balance row. */
export function getOpeningDates(
  movements: Movement[],
): Partial<Record<PocketId, IsoDate>> {
  const openings: Partial<Record<PocketId, IsoDate>> = {};

  for (const movement of movements) {
    if (movement.type !== "adjustment") continue;
    if (movement.category !== OPENING_BALANCE_CATEGORY) continue;
    if (movement.dataKind !== "real") continue;

    const pocket = isPocket(movement.to) ? movement.to : movement.from;
    if (!isPocket(pocket)) continue;

    const current = openings[pocket];
    if (!current || movement.date < current) openings[pocket] = movement.date;
  }

  return openings;
}

/**
 * Every pocket is a ledger: money in minus money out. The card ledger goes negative
 * as charges come out of it, so its debt is the ledger with the sign flipped.
 * Dummy rows, future rows and rows older than the pocket's opening balance don't count.
 */
export function getLedgerBalances(
  movements: Movement[],
  asOf: IsoDate,
): Record<PocketId, Cents> {
  const openings = getOpeningDates(movements);
  const balances: Record<PocketId, Cents> = {
    cajita: 0,
    banorte: 0,
    efectivo: 0,
    porCobrarMama: 0,
    tarjetaNu: 0,
  };

  const counts = (pocket: PocketId, movement: Movement): boolean => {
    const opening = openings[pocket];
    return !opening || movement.date >= opening;
  };

  for (const movement of movements) {
    if (movement.dataKind !== "real" || movement.date > asOf) continue;

    if (isPocket(movement.to) && counts(movement.to, movement)) {
      balances[movement.to] += movement.amount;
    }
    if (isPocket(movement.from) && counts(movement.from, movement)) {
      balances[movement.from] -= movement.amount;
    }
  }

  return balances;
}

export function getCardDebt(movements: Movement[], asOf: IsoDate): Cents {
  // Subtracting from 0 instead of negating avoids -0, which would display as "-$0.00".
  return 0 - getLedgerBalances(movements, asOf).tarjetaNu;
}

export interface PaymentInput {
  date: IsoDate;
  fromCajita: Cents;
  fromCash: Cents;
  momGift: Cents;
}

/** One card payment can have several sources, and each one becomes its own row. */
export function buildPaymentMovements(input: PaymentInput): MovementDraft[] {
  const drafts: MovementDraft[] = [];
  const base = { date: input.date, dataKind: "real" as const };

  if (input.fromCajita > 0) {
    drafts.push({
      ...base,
      type: "transfer",
      amount: input.fromCajita,
      from: "cajita",
      to: "tarjetaNu",
      category: null,
      note: "Pago de tarjeta",
    });
  }
  if (input.fromCash > 0) {
    drafts.push({
      ...base,
      type: "transfer",
      amount: input.fromCash,
      from: "efectivo",
      to: "tarjetaNu",
      category: null,
      note: "Pago de tarjeta (efectivo vía mamá)",
    });
  }
  if (input.momGift > 0) {
    drafts.push({
      ...base,
      type: "income",
      amount: input.momGift,
      from: null,
      to: "tarjetaNu",
      category: "mamá",
      note: "Regalo de mamá al depositar a la tarjeta",
    });
  }

  return drafts;
}

/** Records the difference between the app and Nu as yield. Null if they already match. */
export function buildYieldAdjustment(
  currentBalance: Cents,
  realBalance: Cents,
  date: IsoDate,
): MovementDraft | null {
  const difference = realBalance - currentBalance;
  if (difference === 0) return null;

  return {
    date,
    type: "adjustment",
    amount: Math.abs(difference),
    from: difference < 0 ? "cajita" : null,
    to: difference > 0 ? "cajita" : null,
    category: YIELD_CATEGORY,
    note: "Ajuste de saldo con Nu",
    dataKind: "real",
  };
}
