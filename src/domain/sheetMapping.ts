import { ENDPOINT_LABELS } from "./ledger.ts";
import type {
  Cents,
  DataKind,
  ExpectedCharge,
  ExpectedChargeStatus,
  FixedExpense,
  IsoDate,
  Movement,
  MovementEndpoint,
  MovementType,
  PaymentPlan,
  Settings,
  Shortcut,
  StatementRecord,
} from "./types.ts";

/**
 * Translates between the rows of each person's Google Sheet and the app's types.
 * The sheet uses Spanish labels and pesos; the app uses codes and centavos.
 */

export type Cell = string | number | boolean | null | undefined;
export type SheetRow = Cell[];

export interface RowIssue {
  tab: string;
  row: number;
  reason: string;
}

const TYPE_LABELS: Record<MovementType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  cardExpense: "Gasto con tarjeta",
  transfer: "Transferencia",
  adjustment: "Ajuste",
};

const DATA_KIND_LABELS: Record<DataKind, string> = {
  real: "Real",
  dummy: "Dummy",
};

const STATUS_LABELS: Record<ExpectedChargeStatus, string> = {
  expected: "Esperado",
  charged: "Cobrado",
  skipped: "Omitido",
};

const FREQUENCY_LABELS = {
  monthly: "Mensual",
  yearly: "Anual",
} as const;

function invert<K extends string>(labels: Record<K, string>): Map<string, K> {
  const map = new Map<string, K>();
  for (const key of Object.keys(labels) as K[]) {
    map.set(labels[key].toLowerCase(), key);
  }
  return map;
}

const TYPE_BY_LABEL = invert(TYPE_LABELS);
const DATA_KIND_BY_LABEL = invert(DATA_KIND_LABELS);
const STATUS_BY_LABEL = invert(STATUS_LABELS);
const ENDPOINT_BY_LABEL = invert(ENDPOINT_LABELS);
const FREQUENCY_BY_LABEL = invert(FREQUENCY_LABELS);

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

/** Sheets stores dates as days since 1899-12-30; typed text dates are accepted too. */
export function cellToIsoDate(cell: Cell): IsoDate | null {
  if (typeof cell === "number" && Number.isFinite(cell)) {
    const date = new Date(SHEETS_EPOCH_MS + Math.round(cell) * MS_PER_DAY);
    return date.toISOString().slice(0, 10);
  }
  const value = text(cell);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Pesos in the sheet become centavos. Empty or text that isn't a number gives null. */
export function cellToCents(cell: Cell): Cents | null {
  if (typeof cell === "number" && Number.isFinite(cell)) return Math.round(cell * 100);
  const value = text(cell).replace(/[\s$,]/g, "");
  if (value === "" || !/^-?\d+(\.\d+)?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function centsToPesos(amount: Cents): number {
  return amount / 100;
}

function cellToInteger(cell: Cell): number | null {
  const value = typeof cell === "number" ? cell : Number(text(cell));
  return Number.isInteger(value) ? value : null;
}

function cellToBoolean(cell: Cell): boolean {
  if (typeof cell === "boolean") return cell;
  return ["true", "verdadero", "sí", "si"].includes(text(cell).toLowerCase());
}

function endpointFromCell(cell: Cell): MovementEndpoint | null | undefined {
  const value = text(cell);
  if (value === "") return null;
  return ENDPOINT_BY_LABEL.get(value.toLowerCase());
}

function endpointLabel(endpoint: MovementEndpoint | null): string {
  return endpoint ? ENDPOINT_LABELS[endpoint] : "";
}

/** Unchecked checkboxes come back as false, so a row of only those is still empty. */
function isEmptyRow(row: SheetRow): boolean {
  return row.every((cell) => cell === false || text(cell) === "");
}

type Parsed<T> = { value: T } | { issue: string } | { empty: true };

// ---------- Movimientos: ID | Fecha | Tipo | Monto | De | A | Categoría | Nota | Dato

export function parseMovementRow(row: SheetRow): Parsed<Omit<Movement, "id"> & { id: string }> {
  if (isEmptyRow(row)) return { empty: true };
  const [id, date, type, amount, from, to, category, note, dataKind] = row;

  const parsedDate = cellToIsoDate(date);
  if (!parsedDate) return { issue: "La fecha no es válida" };
  const parsedType = TYPE_BY_LABEL.get(text(type).toLowerCase());
  if (!parsedType) return { issue: `El tipo "${text(type)}" no existe` };
  const parsedAmount = cellToCents(amount);
  if (parsedAmount === null || parsedAmount < 0) return { issue: "El monto no es un número" };
  const parsedFrom = endpointFromCell(from);
  const parsedTo = endpointFromCell(to);
  if (parsedFrom === undefined || parsedTo === undefined) {
    return { issue: "Una bolsa no existe" };
  }
  const kindText = text(dataKind);
  const parsedKind = kindText === "" ? "real" : DATA_KIND_BY_LABEL.get(kindText.toLowerCase());
  if (!parsedKind) return { issue: `El dato "${kindText}" no existe` };

  return {
    value: {
      id: text(id),
      date: parsedDate,
      type: parsedType,
      amount: parsedAmount,
      from: parsedFrom,
      to: parsedTo,
      category: text(category) || null,
      note: text(note),
      dataKind: parsedKind,
    },
  };
}

export function movementToRow(movement: Movement): Cell[] {
  return [
    movement.id,
    movement.date,
    TYPE_LABELS[movement.type],
    centsToPesos(movement.amount),
    endpointLabel(movement.from),
    endpointLabel(movement.to),
    movement.category ?? "",
    movement.note,
    DATA_KIND_LABELS[movement.dataKind],
  ];
}

// ---------- Gastos fijos (the app only reads): ID | Nombre | Monto normal | Frecuencia | Día | Mes | Categoría | Desde | Hasta | Activo

export function parseFixedExpenseRow(row: SheetRow): Parsed<FixedExpense> {
  if (isEmptyRow(row)) return { empty: true };
  const [id, name, amount, frequency, day, month, category, start, end, active] = row;

  const normalAmount = cellToCents(amount);
  if (!text(id) || !text(name) || normalAmount === null) {
    return { issue: "Falta el ID, el nombre o el monto" };
  }
  const kind = FREQUENCY_BY_LABEL.get(text(frequency).toLowerCase());
  const startDate = cellToIsoDate(start);
  if (!kind || !startDate) return { issue: "La frecuencia o la fecha Desde no son válidas" };

  const dayOfMonth = cellToInteger(day);
  if (!dayOfMonth) return { issue: "Falta el día de cobro" };
  let schedule: FixedExpense["schedule"];
  if (kind === "yearly") {
    const monthNumber = cellToInteger(month);
    if (!monthNumber) return { issue: "Falta el mes del cobro anual" };
    schedule = { kind, month: monthNumber, dayOfMonth };
  } else {
    schedule = { kind, dayOfMonth };
  }

  return {
    value: {
      id: text(id),
      name: text(name),
      normalAmount,
      schedule,
      category: text(category) || "otros",
      startDate,
      endDate: cellToIsoDate(end),
      active: cellToBoolean(active),
    },
  };
}

// ---------- Pagos esperados: ID | Gasto fijo | Nombre | Fecha | Monto | Categoría | Estado

export function parseExpectedChargeRow(row: SheetRow): Parsed<ExpectedCharge> {
  if (isEmptyRow(row)) return { empty: true };
  const [id, fixedExpenseId, name, date, amount, category, status] = row;
  const parsedDate = cellToIsoDate(date);
  const parsedAmount = cellToCents(amount);
  const parsedStatus = STATUS_BY_LABEL.get(text(status).toLowerCase());
  if (!text(id) || !parsedDate || parsedAmount === null || !parsedStatus) {
    return { issue: "Falta el ID, la fecha, el monto o el estado" };
  }
  return {
    value: {
      id: text(id),
      fixedExpenseId: text(fixedExpenseId),
      name: text(name),
      date: parsedDate,
      amount: parsedAmount,
      category: text(category) || "otros",
      status: parsedStatus,
    },
  };
}

export function expectedChargeToRow(charge: ExpectedCharge): Cell[] {
  return [
    charge.id,
    charge.fixedExpenseId,
    charge.name,
    charge.date,
    centsToPesos(charge.amount),
    charge.category,
    STATUS_LABELS[charge.status],
  ];
}

// ---------- Cortes: Fecha de corte | Fecha límite | Estado de cuenta (the app only reads)

export function parseStatementRow(row: SheetRow): Parsed<StatementRecord> {
  if (isEmptyRow(row)) return { empty: true };
  const [cut, due, amount] = row;
  const cutDate = cellToIsoDate(cut);
  const dueDate = cellToIsoDate(due);
  const statementAmount = cellToCents(amount);
  if (!cutDate || !dueDate || statementAmount === null) {
    return { issue: "Falta la fecha de corte, la fecha límite o el monto" };
  }
  return { value: { cutDate, dueDate, statementAmount } };
}

// ---------- Atajos: ID | Nombre | Monto | Categoría | Se paga con

export function parseShortcutRow(row: SheetRow): Parsed<Shortcut> {
  if (isEmptyRow(row)) return { empty: true };
  const [id, name, amount, category, paidFrom] = row;
  const endpoint = endpointFromCell(paidFrom);
  if (!text(id) || !text(name) || !endpoint) {
    return { issue: "Falta el ID, el nombre o con qué se paga" };
  }
  return {
    value: {
      id: text(id),
      name: text(name),
      amount: cellToCents(amount),
      category: text(category) || "otros",
      paidFrom: endpoint,
    },
  };
}

export function shortcutToRow(shortcut: Shortcut): Cell[] {
  return [
    shortcut.id,
    shortcut.name,
    shortcut.amount === null ? "" : centsToPesos(shortcut.amount),
    shortcut.category,
    ENDPOINT_LABELS[shortcut.paidFrom],
  ];
}

// ---------- Ajustes: values in B2:B6, lists in E (gasto), F (ingreso), L (lugares), M (categorías con lugar), N (dónde sale cada lugar)

/** Rows of the Ajustes tab, starting at row 1 (the header). */
export function parseSettings(
  rows: SheetRow[],
  fallback: Settings,
): { settings: Settings; plan: PaymentPlan } {
  const value = (rowNumber: number): Cell => rows[rowNumber - 1]?.[1];
  const column = (index: number): string[] =>
    rows
      .slice(1)
      .map((row) => text(row[index]))
      .filter((item) => item !== "");

  const expenseCategories = column(4);
  const incomeCategories = column(5);
  // Columns L, M and N exist only in the simple layout's Sheet; elsewhere they stay empty.
  // N says in which categories (separated by commas) the place on its row is offered.
  const places: string[] = [];
  const placeScopes: Record<string, string[]> = {};
  for (const row of rows.slice(1)) {
    const place = text(row[11]);
    if (place === "") continue;
    places.push(place);
    const scope = text(row[13])
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    if (scope.length > 0) placeScopes[place.toLowerCase()] = scope;
  }
  const placeCategories = column(12);

  return {
    settings: {
      cardLimit: cellToCents(value(2)) ?? fallback.cardLimit,
      cutDay: cellToInteger(value(3)) ?? fallback.cutDay,
      dueDay: cellToInteger(value(4)) ?? fallback.dueDay,
      annualYieldRate:
        typeof value(5) === "number" ? (value(5) as number) : fallback.annualYieldRate,
      expenseCategories:
        expenseCategories.length > 0 ? expenseCategories : fallback.expenseCategories,
      incomeCategories:
        incomeCategories.length > 0 ? incomeCategories : fallback.incomeCategories,
      places,
      placeCategories,
      placeScopes,
    },
    plan: { plannedDate: cellToIsoDate(value(6)) },
  };
}

export function paymentPlanToCells(plan: PaymentPlan): Cell[][] {
  return [[plan.plannedDate ?? ""]];
}

/** Parses every row of a tab, collecting the rows that can't be read instead of failing. */
export function parseRows<T>(
  rows: SheetRow[],
  parse: (row: SheetRow) => Parsed<T>,
  tab: string,
  firstRowNumber: number,
): { items: T[]; issues: RowIssue[]; rowNumbers: number[] } {
  const items: T[] = [];
  const issues: RowIssue[] = [];
  const rowNumbers: number[] = [];

  rows.forEach((row, index) => {
    const result = parse(row);
    const rowNumber = firstRowNumber + index;
    if ("value" in result) {
      items.push(result.value);
      rowNumbers.push(rowNumber);
    } else if ("issue" in result) {
      issues.push({ tab, row: rowNumber, reason: result.issue });
    }
  });

  return { items, issues, rowNumbers };
}
