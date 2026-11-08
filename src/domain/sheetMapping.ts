import {
  type Cell,
  type ColumnMap,
  type ColumnSpec,
  cellText as text,
  findColumns,
  findHeader,
  type SheetRow,
} from "./sheetColumns.ts";
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

export type { Cell, SheetRow } from "./sheetColumns.ts";

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
  previo: "Previo",
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

/**
 * A row with nothing in the columns the app reads. Unchecked checkboxes come back as false,
 * so a row of only those is still empty, and so is a row that only has the person's own notes.
 */
function isEmptyRow(row: SheetRow, columns: ColumnMap<string>): boolean {
  return Object.values<number>(columns).every((index) => {
    const cell = row[index];
    return cell === false || text(cell) === "";
  });
}

type Parsed<T> = { value: T } | { issue: string } | { empty: true };

/**
 * One tab of the Sheet: its name, the columns the app needs (found by header) and how a
 * row is read. Writing goes through the same column map, so it never depends on position.
 */
export interface Table<K extends string, T = unknown> {
  tab: string;
  columns: readonly ColumnSpec<K>[];
  parse: (row: SheetRow, columns: ColumnMap<K>) => Parsed<T>;
}

// ---------- Movimientos

const MOVEMENT_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "date", header: "Fecha" },
  { key: "type", header: "Tipo" },
  { key: "amount", header: "Monto" },
  { key: "from", header: "De" },
  { key: "to", header: "A" },
  { key: "category", header: "Categoría" },
  { key: "note", header: "Nota" },
  { key: "dataKind", header: "Dato" },
] as const;

export type MovementColumn = (typeof MOVEMENT_COLUMNS)[number]["key"];

export function parseMovementRow(
  row: SheetRow,
  columns: ColumnMap<MovementColumn>,
): Parsed<Movement> {
  if (isEmptyRow(row, columns)) return { empty: true };
  const cell = (key: MovementColumn): Cell => row[columns[key]];
  const [id, date, type, amount, from, to, category, note, dataKind] = [
    cell("id"),
    cell("date"),
    cell("type"),
    cell("amount"),
    cell("from"),
    cell("to"),
    cell("category"),
    cell("note"),
    cell("dataKind"),
  ];

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

export function movementToRecord(movement: Movement): Record<MovementColumn, Cell> {
  return {
    id: movement.id,
    date: movement.date,
    type: TYPE_LABELS[movement.type],
    amount: centsToPesos(movement.amount),
    from: endpointLabel(movement.from),
    to: endpointLabel(movement.to),
    category: movement.category ?? "",
    note: movement.note,
    dataKind: DATA_KIND_LABELS[movement.dataKind],
  };
}

export const MOVEMENTS_TABLE: Table<MovementColumn, Movement> = {
  tab: "Movimientos",
  columns: MOVEMENT_COLUMNS,
  parse: parseMovementRow,
};

// ---------- Gastos fijos (the app only reads)

const FIXED_EXPENSE_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Nombre" },
  { key: "amount", header: "Monto normal" },
  { key: "frequency", header: "Frecuencia" },
  { key: "day", header: "Día" },
  { key: "month", header: "Mes" },
  { key: "category", header: "Categoría" },
  { key: "start", header: "Desde" },
  { key: "end", header: "Hasta" },
  { key: "active", header: "Activo" },
] as const;

export type FixedExpenseColumn = (typeof FIXED_EXPENSE_COLUMNS)[number]["key"];

export function parseFixedExpenseRow(
  row: SheetRow,
  columns: ColumnMap<FixedExpenseColumn>,
): Parsed<FixedExpense> {
  if (isEmptyRow(row, columns)) return { empty: true };
  const cell = (key: FixedExpenseColumn): Cell => row[columns[key]];
  const [id, name, amount, frequency, day, month, category, start, end, active] = [
    cell("id"),
    cell("name"),
    cell("amount"),
    cell("frequency"),
    cell("day"),
    cell("month"),
    cell("category"),
    cell("start"),
    cell("end"),
    cell("active"),
  ];

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

export const FIXED_EXPENSES_TABLE: Table<FixedExpenseColumn, FixedExpense> = {
  tab: "Gastos fijos",
  columns: FIXED_EXPENSE_COLUMNS,
  parse: parseFixedExpenseRow,
};

// ---------- Pagos esperados

const EXPECTED_CHARGE_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "fixedExpenseId", header: "Gasto fijo" },
  { key: "name", header: "Nombre" },
  { key: "date", header: "Fecha" },
  { key: "amount", header: "Monto" },
  { key: "category", header: "Categoría" },
  { key: "status", header: "Estado" },
] as const;

export type ExpectedChargeColumn = (typeof EXPECTED_CHARGE_COLUMNS)[number]["key"];

export function parseExpectedChargeRow(
  row: SheetRow,
  columns: ColumnMap<ExpectedChargeColumn>,
): Parsed<ExpectedCharge> {
  if (isEmptyRow(row, columns)) return { empty: true };
  const cell = (key: ExpectedChargeColumn): Cell => row[columns[key]];
  const [id, fixedExpenseId, name, date, amount, category, status] = [
    cell("id"),
    cell("fixedExpenseId"),
    cell("name"),
    cell("date"),
    cell("amount"),
    cell("category"),
    cell("status"),
  ];
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

export function expectedChargeToRecord(
  charge: ExpectedCharge,
): Record<ExpectedChargeColumn, Cell> {
  return {
    id: charge.id,
    fixedExpenseId: charge.fixedExpenseId,
    name: charge.name,
    date: charge.date,
    amount: centsToPesos(charge.amount),
    category: charge.category,
    status: STATUS_LABELS[charge.status],
  };
}

export const EXPECTED_CHARGES_TABLE: Table<ExpectedChargeColumn, ExpectedCharge> = {
  tab: "Pagos esperados",
  columns: EXPECTED_CHARGE_COLUMNS,
  parse: parseExpectedChargeRow,
};

// ---------- Cortes (the app only reads)

const STATEMENT_COLUMNS = [
  { key: "cut", header: "Fecha de corte" },
  { key: "due", header: "Fecha límite" },
  { key: "amount", header: "Estado de cuenta" },
] as const;

export type StatementColumn = (typeof STATEMENT_COLUMNS)[number]["key"];

export function parseStatementRow(
  row: SheetRow,
  columns: ColumnMap<StatementColumn>,
): Parsed<StatementRecord> {
  if (isEmptyRow(row, columns)) return { empty: true };
  const [cut, due, amount] = [row[columns.cut], row[columns.due], row[columns.amount]];
  const cutDate = cellToIsoDate(cut);
  const dueDate = cellToIsoDate(due);
  // An empty amount is fine: the statement isn't out yet and the app keeps calculating it.
  const statementAmount = text(amount) === "" ? null : cellToCents(amount);
  if (!cutDate || !dueDate || (statementAmount === null && text(amount) !== "")) {
    return { issue: "Falta la fecha de corte o la fecha límite, o el monto no es un número" };
  }
  return { value: { cutDate, dueDate, statementAmount } };
}

export const STATEMENTS_TABLE: Table<StatementColumn, StatementRecord> = {
  tab: "Cortes",
  columns: STATEMENT_COLUMNS,
  parse: parseStatementRow,
};

// ---------- Atajos

const SHORTCUT_COLUMNS = [
  { key: "id", header: "ID" },
  { key: "name", header: "Nombre" },
  { key: "amount", header: "Monto" },
  { key: "category", header: "Categoría" },
  { key: "paidFrom", header: "Se paga con" },
] as const;

export type ShortcutColumn = (typeof SHORTCUT_COLUMNS)[number]["key"];

export function parseShortcutRow(
  row: SheetRow,
  columns: ColumnMap<ShortcutColumn>,
): Parsed<Shortcut> {
  if (isEmptyRow(row, columns)) return { empty: true };
  const cell = (key: ShortcutColumn): Cell => row[columns[key]];
  const [id, name, amount, category, paidFrom] = [
    cell("id"),
    cell("name"),
    cell("amount"),
    cell("category"),
    cell("paidFrom"),
  ];
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

export function shortcutToRecord(shortcut: Shortcut): Record<ShortcutColumn, Cell> {
  return {
    id: shortcut.id,
    name: shortcut.name,
    amount: shortcut.amount === null ? "" : centsToPesos(shortcut.amount),
    category: shortcut.category,
    paidFrom: ENDPOINT_LABELS[shortcut.paidFrom],
  };
}

export const SHORTCUTS_TABLE: Table<ShortcutColumn, Shortcut> = {
  tab: "Atajos",
  columns: SHORTCUT_COLUMNS,
  parse: parseShortcutRow,
};

// ---------- Ajustes: settings by their name, lists by the name in the header row

const SETTINGS_COLUMNS = [
  { key: "name", header: "Ajuste" },
  { key: "value", header: "Valor" },
] as const;

/** The settings, found by the start of their name (the row where each lives can move). */
const SETTING_LABELS = {
  cardLimit: "límite de la tarjeta",
  cutDay: "día de corte",
  dueDay: "día límite de pago",
  yieldRate: "tasa anual",
  paymentDay: "día de pago",
} as const;

export type SettingName = keyof typeof SETTING_LABELS;

/** The 1-based row of a setting, or null when the tab has no setting with that name. */
export function findSettingRow(rows: SheetRow[], setting: SettingName, nameColumn = 0): number | null {
  const index = rows.findIndex((row) =>
    text(row[nameColumn]).toLowerCase().startsWith(SETTING_LABELS[setting]),
  );
  return index >= 0 ? index + 1 : null;
}

/** Where the settings and their values are, from the header row of Ajustes. */
export function findSettingsColumns(rows: SheetRow[]): ColumnMap<(typeof SETTINGS_COLUMNS)[number]["key"]> {
  return findColumns("Ajustes", rows[0], SETTINGS_COLUMNS);
}

/**
 * Rows of the Ajustes tab, starting at row 1 (the header). Every list and setting is found
 * by name, so deleting or moving columns and rows can't confuse the app. What isn't there
 * simply isn't set: the app's defaults fill in, nothing is guessed from a position.
 */
export function parseSettings(
  rows: SheetRow[],
  fallback: Settings,
): { settings: Settings; plan: PaymentPlan } {
  const header = rows[0];
  const settingsColumns = findSettingsColumns(rows);
  const value = (setting: SettingName): Cell => {
    const row = findSettingRow(rows, setting, settingsColumns.name);
    return row === null ? undefined : rows[row - 1]?.[settingsColumns.value];
  };
  const column = (name: string): string[] => {
    const index = findHeader(header, name);
    if (index < 0) return [];
    return rows
      .slice(1)
      .map((row) => text(row[index]))
      .filter((item) => item !== "");
  };

  const expenseCategories = column("Categorías de gasto");
  const incomeCategories = column("Categorías de ingreso");
  // The place lists exist only in the simple layout's Sheet; elsewhere they stay empty.
  // "Dónde sale cada lugar" says in which categories (separated by commas) a place is offered.
  const placeColumn = findHeader(header, "Lugares frecuentes");
  const placeScopeColumn = findHeader(header, "Dónde sale cada lugar");
  const places: string[] = [];
  const placeScopes: Record<string, string[]> = {};
  if (placeColumn >= 0) {
    for (const row of rows.slice(1)) {
      const place = text(row[placeColumn]);
      if (place === "") continue;
      places.push(place);
      const scope =
        placeScopeColumn < 0
          ? []
          : text(row[placeScopeColumn])
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item !== "");
      if (scope.length > 0) placeScopes[place.toLowerCase()] = scope;
    }
  }

  return {
    settings: {
      cardLimit: cellToCents(value("cardLimit")) ?? fallback.cardLimit,
      cutDay: cellToInteger(value("cutDay")) ?? fallback.cutDay,
      dueDay: cellToInteger(value("dueDay")) ?? fallback.dueDay,
      annualYieldRate:
        typeof value("yieldRate") === "number"
          ? (value("yieldRate") as number)
          : fallback.annualYieldRate,
      expenseCategories:
        expenseCategories.length > 0 ? expenseCategories : fallback.expenseCategories,
      incomeCategories:
        incomeCategories.length > 0 ? incomeCategories : fallback.incomeCategories,
      places,
      placeCategories: column("Categorías con lugar"),
      placeScopes,
    },
    plan: { plannedDate: cellToIsoDate(value("paymentDay")) },
  };
}

export function paymentPlanToCells(plan: PaymentPlan): Cell[][] {
  return [[plan.plannedDate ?? ""]];
}

/**
 * A row whose ID already showed up above is left out and reported. The app keeps one entry
 * per ID, so the copy would be hidden in the app but still counted in the Sheet's own tabs.
 * Rows with no ID yet are skipped here: they get one when the Sheet is read.
 */
export function dropDuplicateIds<T extends { id: string }>(
  parsed: { items: T[]; issues: RowIssue[]; rowNumbers: number[] },
  tab: string,
): { items: T[]; issues: RowIssue[]; rowNumbers: number[] } {
  const seen = new Map<string, number>();
  const items: T[] = [];
  const rowNumbers: number[] = [];
  const issues = [...parsed.issues];

  parsed.items.forEach((item, index) => {
    const rowNumber = parsed.rowNumbers[index];
    const firstRow = item.id === "" ? undefined : seen.get(item.id);
    if (firstRow !== undefined) {
      issues.push({ tab, row: rowNumber, reason: `El ID "${item.id}" ya está en la fila ${firstRow}` });
      return;
    }
    if (item.id !== "") seen.set(item.id, rowNumber);
    items.push(item);
    rowNumbers.push(rowNumber);
  });

  return { items, issues, rowNumbers };
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

/**
 * Reads a whole tab as it comes from the Sheet: the header row first, then the data rows.
 * Throws SheetLayoutError when a column the app needs is not in the header.
 */
export function readTable<K extends string, T>(
  rows: SheetRow[],
  table: Table<K, T>,
): { items: T[]; issues: RowIssue[]; rowNumbers: number[]; columns: ColumnMap<K> } {
  const columns = findColumns(table.tab, rows[0], table.columns);
  const parsed = parseRows(rows.slice(1), (row) => table.parse(row, columns), table.tab, 2);
  return { ...parsed, columns };
}
