import { daysBetween } from "./dates.ts";
import type {
  Cents,
  IsoDate,
  Movement,
  MovementEndpoint,
  PocketId,
} from "./types.ts";

export const OPENING_BALANCE_CATEGORY = "Saldo inicial";
export const YIELD_CATEGORY = "Rendimiento";

export const ENDPOINT_LABELS: Record<MovementEndpoint, string> = {
  cajita: "Cajita Nu Débito",
  banorte: "Banorte",
  efectivo: "Efectivo",
  porCobrarMama: "Deuda mami",
  tarjetaNu: "Tarjeta Nu crédito",
  bbva: "BBVA",
};

function isPocket(endpoint: MovementEndpoint | null): endpoint is PocketId {
  return endpoint !== null;
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
 * Previo rows, future rows and rows older than the pocket's opening balance don't count.
 */
/** Growth of one peso in the cajita after `days` days, compounded daily like Nu does. */
export function dailyGrowth(annualRate: number, days: number): number {
  return (1 + annualRate / 365) ** days;
}

/**
 * `cajitaRate` is the yearly rate of the cajita (0.13 for 13%). With it, every amount that
 * entered the cajita earns interest from its date to `asOf`, compounded daily. Without it
 * (0), balances are plain sums.
 */
export function getLedgerBalances(
  movements: Movement[],
  asOf: IsoDate,
  cajitaRate = 0,
): Record<PocketId, Cents> {
  const openings = getOpeningDates(movements);
  const balances: Record<PocketId, Cents> = {
    cajita: 0,
    banorte: 0,
    efectivo: 0,
    porCobrarMama: 0,
    tarjetaNu: 0,
    bbva: 0,
  };

  const counts = (pocket: PocketId, movement: Movement): boolean => {
    const opening = openings[pocket];
    return !opening || movement.date >= opening;
  };

  const weight = (pocket: PocketId, date: IsoDate): number =>
    pocket === "cajita" && cajitaRate > 0
      ? dailyGrowth(cajitaRate, daysBetween(date, asOf))
      : 1;

  for (const movement of movements) {
    if (movement.dataKind !== "real" || movement.date > asOf) continue;

    if (isPocket(movement.to) && counts(movement.to, movement)) {
      balances[movement.to] += movement.amount * weight(movement.to, movement.date);
    }
    if (isPocket(movement.from) && counts(movement.from, movement)) {
      balances[movement.from] -= movement.amount * weight(movement.from, movement.date);
    }
  }

  balances.cajita = Math.round(balances.cajita);
  return balances;
}

export function getCardDebt(movements: Movement[], asOf: IsoDate): Cents {
  // Subtracting from 0 instead of negating avoids -0, which would display as "-$0.00".
  return 0 - getLedgerBalances(movements, asOf).tarjetaNu;
}

/** Category of the entries that only record what mom owes, like "Viaje EGS" in her card. */
export const MOM_DEBT_CATEGORY = "Deuda mami";

/**
 * Bookkeeping that exists for the calculations and would repeat something already in the
 * history: the purchase is already listed as a card expense, this entry only raises Deuda mami.
 */
export function isMomDebtEntry(movement: Movement): boolean {
  return movement.type === "adjustment" && movement.category === MOM_DEBT_CATEGORY;
}
