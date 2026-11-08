import { emptyPaymentPlan, seedSettings } from "@/data/seedData";
import { createMovementId } from "@/domain/ids";
import {
  type Cell,
  type ColumnMap,
  type ColumnSpec,
  cellRuns,
  columnLetter,
  findColumns,
  rowFromRecord,
  SheetLayoutError,
  type SheetRow,
} from "@/domain/sheetColumns";
import {
  dropDuplicateIds,
  EXPECTED_CHARGES_TABLE,
  expectedChargeToRecord,
  FIXED_EXPENSES_TABLE,
  findSettingRow,
  findSettingsColumns,
  MOVEMENTS_TABLE,
  movementToRecord,
  parseSettings,
  paymentPlanToCells,
  readTable,
  type RowIssue,
  SHORTCUTS_TABLE,
  shortcutToRecord,
  STATEMENTS_TABLE,
} from "@/domain/sheetMapping";
import type { SyncOp } from "@/domain/syncOps";
import type { AppData } from "@/domain/types";
import type { SheetsClient } from "./sheetsClient";

const SETTINGS_TAB = "Ajustes";

/** A tab as far as writing goes: its name and the columns the app owns in it. */
interface TableLayout<K extends string> {
  tab: string;
  columns: readonly ColumnSpec<K>[];
}

/** Tabs whose rows are identified by an ID column. */
type IdTable<K extends string> = TableLayout<K | "id">;

function quote(tab: string): string {
  return `'${tab}'`;
}

export interface SheetSnapshot {
  data: AppData;
  issues: RowIssue[];
}

/**
 * Reads every tab. Rows with mistakes are reported and left out, never guessed. A column the
 * app needs that isn't in the header throws SheetLayoutError: reading around it would show
 * the app an empty tab, and the next sync would treat that as the truth.
 */
export async function readSnapshot(client: SheetsClient): Promise<SheetSnapshot> {
  // A bare tab name reads the whole tab, header row included.
  const [movementRows, fixedRows, expectedRows, statementRows, shortcutRows, settingsRows] =
    await client.batchGet([
      quote(MOVEMENTS_TABLE.tab),
      quote(FIXED_EXPENSES_TABLE.tab),
      quote(EXPECTED_CHARGES_TABLE.tab),
      quote(STATEMENTS_TABLE.tab),
      quote(SHORTCUTS_TABLE.tab),
      quote(SETTINGS_TAB),
    ]);

  const movementTable = readTable(movementRows, MOVEMENTS_TABLE);
  const movements = dropDuplicateIds(movementTable, MOVEMENTS_TABLE.tab);
  const fixedExpenses = dropDuplicateIds(
    readTable(fixedRows, FIXED_EXPENSES_TABLE),
    FIXED_EXPENSES_TABLE.tab,
  );
  const expectedCharges = dropDuplicateIds(
    readTable(expectedRows, EXPECTED_CHARGES_TABLE),
    EXPECTED_CHARGES_TABLE.tab,
  );
  const statements = readTable(statementRows, STATEMENTS_TABLE);
  const shortcuts = dropDuplicateIds(readTable(shortcutRows, SHORTCUTS_TABLE), SHORTCUTS_TABLE.tab);
  const { settings, plan } = parseSettings(settingsRows, seedSettings);

  // Rows added by hand with an empty ID get one, written back so it stays the same.
  const idUpdates: { range: string; values: Cell[][] }[] = [];
  const idColumn = columnLetter(movementTable.columns.id);
  movements.items.forEach((movement, index) => {
    if (movement.id !== "") return;
    movement.id = createMovementId(movement.date);
    idUpdates.push({
      range: `${quote(MOVEMENTS_TABLE.tab)}!${idColumn}${movements.rowNumbers[index]}`,
      values: [[movement.id]],
    });
  });
  await client.updateValues(idUpdates);

  return {
    data: {
      movements: movements.items,
      fixedExpenses: fixedExpenses.items,
      expectedCharges: expectedCharges.items,
      statements: statements.items,
      shortcuts: shortcuts.items,
      settings,
      paymentPlan: plan ?? emptyPaymentPlan,
    },
    issues: [
      ...movements.issues,
      ...fixedExpenses.issues,
      ...expectedCharges.issues,
      ...statements.issues,
      ...shortcuts.issues,
    ],
  };
}

/** Every tab the app writes to. */
const WRITABLE_TABLES = [MOVEMENTS_TABLE, EXPECTED_CHARGES_TABLE, SHORTCUTS_TABLE];

/**
 * What a run of changes needs to know about the Sheet: the header row of every tab, read in
 * one request. Opening a session also checks that each tab has the columns the app needs,
 * so a renamed or deleted column stops everything before a single cell is written.
 */
class SheetSession {
  private constructor(
    readonly client: SheetsClient,
    private readonly headers: Map<string, SheetRow>,
  ) {}

  static async open(client: SheetsClient): Promise<SheetSession> {
    const tables = [...WRITABLE_TABLES, FIXED_EXPENSES_TABLE, STATEMENTS_TABLE];
    const rows = await client.batchGet(tables.map((table) => `${quote(table.tab)}!1:1`));
    const headers = new Map(tables.map((table, index) => [table.tab, rows[index]?.[0] ?? []]));
    const session = new SheetSession(client, headers);
    for (const table of tables) session.layout(table);
    return session;
  }

  /** Where each column of the tab is, and how many columns it has. */
  layout<K extends string>(table: TableLayout<K>): { columns: ColumnMap<K>; width: number } {
    const header = this.headers.get(table.tab) ?? [];
    const columns = findColumns(table.tab, header, table.columns);
    const lastColumn = Math.max(...Object.values<number>(columns));
    return { columns, width: Math.max(header.length, lastColumn + 1) };
  }
}

/** Every row each ID is on, top to bottom. An ID is normally on one row, but a copied row repeats it. */
async function readRowNumbersById<K extends string>(
  session: SheetSession,
  table: IdTable<K>,
): Promise<Map<string, number[]>> {
  const { columns } = session.layout(table);
  const letter = columnLetter(columns.id);
  const [rows] = await session.client.batchGet([`${quote(table.tab)}!${letter}2:${letter}`]);
  const map = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const id = row[0];
    if (id === undefined || id === null || String(id) === "") return;
    const key = String(id);
    map.set(key, [...(map.get(key) ?? []), index + 2]);
  });
  return map;
}

/** Appends rows after the last one of the tab, filling only the columns the app owns. */
async function appendRecords<K extends string>(
  session: SheetSession,
  table: TableLayout<K>,
  records: Record<K, Cell>[],
): Promise<void> {
  if (records.length === 0) return;
  const { columns, width } = session.layout(table);
  await session.client.appendRows(
    `${quote(table.tab)}!A:${columnLetter(width - 1)}`,
    records.map((record) => rowFromRecord(columns, record)),
  );
}

/** Updates the rows whose ID already exists and appends the rest. Returns the IDs it appended. */
async function upsertRows<K extends string>(
  session: SheetSession,
  table: IdTable<K>,
  items: { id: string; record: Record<K | "id", Cell> }[],
): Promise<string[]> {
  const rowNumbers = await readRowNumbersById(session, table);
  const { columns } = session.layout(table);
  const updates: { range: string; values: Cell[][] }[] = [];
  const appends: typeof items = [];

  for (const item of items) {
    const rowNumber = rowNumbers.get(item.id)?.[0];
    if (!rowNumber) {
      appends.push(item);
      continue;
    }
    // Only the columns the app owns are written: anything else in the row stays as it is.
    for (const run of cellRuns(columns, item.record)) {
      const first = columnLetter(run.first);
      const last = columnLetter(run.first + run.values.length - 1);
      updates.push({
        range: `${quote(table.tab)}!${first}${rowNumber}:${last}${rowNumber}`,
        values: [run.values],
      });
    }
  }

  await session.client.updateValues(updates);
  await appendRecords(
    session,
    table,
    appends.map((item) => item.record),
  );
  return appends.map((item) => item.id);
}

/** Appends only the rows whose ID isn't in the sheet yet. Existing rows are never touched. */
async function addMissingRows<K extends string>(
  session: SheetSession,
  table: IdTable<K>,
  items: { id: string; record: Record<K | "id", Cell> }[],
): Promise<string[]> {
  const rowNumbers = await readRowNumbersById(session, table);
  const missing = items.filter((item) => !rowNumbers.has(item.id));
  await appendRecords(
    session,
    table,
    missing.map((item) => item.record),
  );
  return missing.map((item) => item.id);
}

async function deleteRowNumbers(
  session: SheetSession,
  tab: string,
  rows: number[],
): Promise<void> {
  // The Set keeps one request per row: deleting the same row twice would take its neighbour.
  const targets = [...new Set(rows)]
    // From the bottom up, so deleting one row doesn't move the next one.
    .sort((a, b) => b - a);
  if (targets.length === 0) return;
  const sheetId = await session.client.getSheetId(tab);

  await session.client.batchUpdate(
    targets.map((rowNumber) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
      },
    })),
  );
}

async function deleteRowsById<K extends string>(
  session: SheetSession,
  table: IdTable<K>,
  ids: string[],
): Promise<void> {
  const rowNumbers = await readRowNumbersById(session, table);
  // Every row with the ID goes, so a copy can't stay behind and come back on the next read.
  await deleteRowNumbers(session, table.tab, ids.flatMap((id) => rowNumbers.get(id) ?? []));
}

/**
 * Two syncs that run at the same moment (a page reloaded while a save was still on its way)
 * can both append the same new row. Right after appending, the copies of those IDs are
 * removed and the first row stays, which is the one later edits update.
 */
async function removeRepeatedRows<K extends string>(
  session: SheetSession,
  table: IdTable<K>,
  appendedIds: string[],
): Promise<void> {
  if (appendedIds.length === 0) return;
  const rowNumbers = await readRowNumbersById(session, table);
  await deleteRowNumbers(
    session,
    table.tab,
    appendedIds.flatMap((id) => (rowNumbers.get(id) ?? []).slice(1)),
  );
}

/**
 * Keeps Movimientos in date order, oldest at the top and newest at the bottom. New rows are
 * appended at the end, so one with an older date (or a date that was edited) sends the
 * rows back to order. The Sheet is only touched when the order is actually broken.
 */
export async function sortMovementsByDate(client: SheetsClient): Promise<void> {
  const session = await SheetSession.open(client);
  const { columns, width } = session.layout(MOVEMENTS_TABLE);
  const letter = columnLetter(columns.date);
  const [rows] = await client.batchGet([`${quote(MOVEMENTS_TABLE.tab)}!${letter}2:${letter}`]);
  let previous = Number.NEGATIVE_INFINITY;
  let isSorted = true;
  for (const row of rows) {
    const date = row[0];
    if (typeof date !== "number") continue;
    if (date < previous) {
      isSorted = false;
      break;
    }
    previous = date;
  }
  if (isSorted) return;

  const sheetId = await client.getSheetId(MOVEMENTS_TABLE.tab);
  await client.batchUpdate([
    {
      sortRange: {
        // The whole width moves together, so a column the person added stays with its row.
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: width },
        sortSpecs: [{ dimensionIndex: columns.date, sortOrder: "ASCENDING" }],
      },
    },
  ]);
}

/** Applies the app's pending changes in order. Each one can safely run twice. */
export async function applyOps(client: SheetsClient, ops: SyncOp[]): Promise<void> {
  const session = await SheetSession.open(client);

  for (const op of ops) {
    switch (op.kind) {
      case "upsertMovements":
        await removeRepeatedRows(
          session,
          MOVEMENTS_TABLE,
          await upsertRows(
            session,
            MOVEMENTS_TABLE,
            op.movements.map((movement) => ({ id: movement.id, record: movementToRecord(movement) })),
          ),
        );
        break;
      case "deleteMovements":
        await deleteRowsById(session, MOVEMENTS_TABLE, op.ids);
        break;
      case "upsertExpectedCharges":
        await removeRepeatedRows(
          session,
          EXPECTED_CHARGES_TABLE,
          await upsertRows(
            session,
            EXPECTED_CHARGES_TABLE,
            op.charges.map((charge) => ({ id: charge.id, record: expectedChargeToRecord(charge) })),
          ),
        );
        break;
      case "deleteExpectedCharges":
        await deleteRowsById(session, EXPECTED_CHARGES_TABLE, op.ids);
        break;
      case "addExpectedCharges":
        await removeRepeatedRows(
          session,
          EXPECTED_CHARGES_TABLE,
          await addMissingRows(
            session,
            EXPECTED_CHARGES_TABLE,
            op.charges.map((charge) => ({ id: charge.id, record: expectedChargeToRecord(charge) })),
          ),
        );
        break;
      case "upsertShortcut":
        await removeRepeatedRows(
          session,
          SHORTCUTS_TABLE,
          await upsertRows(session, SHORTCUTS_TABLE, [
            { id: op.shortcut.id, record: shortcutToRecord(op.shortcut) },
          ]),
        );
        break;
      case "deleteShortcut":
        await deleteRowsById(session, SHORTCUTS_TABLE, [op.id]);
        break;
      case "savePaymentPlan": {
        // The cell is found by the name of the setting and the "Valor" header: the tab can be rearranged.
        const [rows] = await client.batchGet([quote(SETTINGS_TAB)]);
        const columns = findSettingsColumns(rows);
        const row = findSettingRow(rows, "paymentDay", columns.name);
        if (row === null) throw new SheetLayoutError(SETTINGS_TAB, ["Día de pago"]);
        await client.updateValues([
          {
            range: `${quote(SETTINGS_TAB)}!${columnLetter(columns.value)}${row}`,
            values: paymentPlanToCells(op.plan),
          },
        ]);
        break;
      }
    }
  }
}
