import { emptyPaymentPlan, seedSettings } from "@/data/seedData";
import { createId } from "@/domain/ids";
import {
  type Cell,
  expectedChargeToRow,
  movementToRow,
  parseExpectedChargeRow,
  parseFixedExpenseRow,
  parseMovementRow,
  parseRows,
  parseSettings,
  parseShortcutRow,
  parseStatementRow,
  paymentPlanToCells,
  type RowIssue,
  shortcutToRow,
} from "@/domain/sheetMapping";
import type { SyncOp } from "@/domain/syncOps";
import type { AppData } from "@/domain/types";
import type { SheetsClient } from "./sheetsClient";

const TAB = {
  movements: "Movimientos",
  fixedExpenses: "Gastos fijos",
  expectedCharges: "Pagos esperados",
  statements: "Cortes",
  shortcuts: "Atajos",
  settings: "Ajustes",
} as const;

type TabName = (typeof TAB)[keyof typeof TAB];

const LAST_COLUMN: Record<TabName, string> = {
  Movimientos: "I",
  "Gastos fijos": "J",
  "Pagos esperados": "G",
  Cortes: "C",
  Atajos: "E",
  Ajustes: "K",
};

function quote(tab: TabName): string {
  return `'${tab}'`;
}

export interface SheetSnapshot {
  data: AppData;
  issues: RowIssue[];
}

/** Reads every data tab. Rows with mistakes are reported and left out, never guessed. */
export async function readSnapshot(client: SheetsClient): Promise<SheetSnapshot> {
  const [movementRows, fixedRows, expectedRows, statementRows, shortcutRows, settingsRows] =
    await client.batchGet([
      `${quote(TAB.movements)}!A2:I`,
      `${quote(TAB.fixedExpenses)}!A2:J`,
      `${quote(TAB.expectedCharges)}!A2:G`,
      `${quote(TAB.statements)}!A2:C`,
      `${quote(TAB.shortcuts)}!A2:E`,
      `${quote(TAB.settings)}!A1:N40`,
    ]);

  const movements = parseRows(movementRows, parseMovementRow, TAB.movements, 2);
  const fixedExpenses = parseRows(fixedRows, parseFixedExpenseRow, TAB.fixedExpenses, 2);
  const expectedCharges = parseRows(expectedRows, parseExpectedChargeRow, TAB.expectedCharges, 2);
  const statements = parseRows(statementRows, parseStatementRow, TAB.statements, 2);
  const shortcuts = parseRows(shortcutRows, parseShortcutRow, TAB.shortcuts, 2);
  const { settings, plan } = parseSettings(settingsRows, seedSettings);

  // Rows added by hand with an empty ID get one, written back so it stays the same.
  const idUpdates: { range: string; values: Cell[][] }[] = [];
  movements.items.forEach((movement, index) => {
    if (movement.id !== "") return;
    movement.id = createId("m");
    idUpdates.push({
      range: `${quote(TAB.movements)}!A${movements.rowNumbers[index]}`,
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

async function readRowNumbersById(
  client: SheetsClient,
  tab: TabName,
): Promise<Map<string, number>> {
  const [rows] = await client.batchGet([`${quote(tab)}!A2:A`]);
  const map = new Map<string, number>();
  rows.forEach((row, index) => {
    const id = row[0];
    if (id !== undefined && id !== null && String(id) !== "") map.set(String(id), index + 2);
  });
  return map;
}

/** Updates the rows whose ID already exists and appends the rest. */
async function upsertRows(
  client: SheetsClient,
  tab: TabName,
  items: { id: string; row: Cell[] }[],
): Promise<void> {
  const rowNumbers = await readRowNumbersById(client, tab);
  const updates: { range: string; values: Cell[][] }[] = [];
  const appends: Cell[][] = [];

  for (const item of items) {
    const rowNumber = rowNumbers.get(item.id);
    if (rowNumber) {
      updates.push({
        range: `${quote(tab)}!A${rowNumber}:${LAST_COLUMN[tab]}${rowNumber}`,
        values: [item.row],
      });
    } else {
      appends.push(item.row);
    }
  }

  await client.updateValues(updates);
  await client.appendRows(`${quote(tab)}!A:${LAST_COLUMN[tab]}`, appends);
}

/** Appends only the rows whose ID isn't in the sheet yet. Existing rows are never touched. */
async function addMissingRows(
  client: SheetsClient,
  tab: TabName,
  items: { id: string; row: Cell[] }[],
): Promise<void> {
  const rowNumbers = await readRowNumbersById(client, tab);
  const missing = items.filter((item) => !rowNumbers.has(item.id));
  await client.appendRows(
    `${quote(tab)}!A:${LAST_COLUMN[tab]}`,
    missing.map((item) => item.row),
  );
}

async function deleteRowsById(
  client: SheetsClient,
  tab: TabName,
  ids: string[],
): Promise<void> {
  const rowNumbers = await readRowNumbersById(client, tab);
  const sheetId = await client.getSheetId(tab);
  const targets = ids
    .map((id) => rowNumbers.get(id))
    .filter((rowNumber): rowNumber is number => rowNumber !== undefined)
    // From the bottom up, so deleting one row doesn't move the next one.
    .sort((a, b) => b - a);

  await client.batchUpdate(
    targets.map((rowNumber) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
      },
    })),
  );
}

/** Applies the app's pending changes in order. Each one can safely run twice. */
export async function applyOps(client: SheetsClient, ops: SyncOp[]): Promise<void> {
  for (const op of ops) {
    switch (op.kind) {
      case "upsertMovements":
        await upsertRows(
          client,
          TAB.movements,
          op.movements.map((movement) => ({ id: movement.id, row: movementToRow(movement) })),
        );
        break;
      case "deleteMovements":
        await deleteRowsById(client, TAB.movements, op.ids);
        break;
      case "upsertExpectedCharges":
        await upsertRows(
          client,
          TAB.expectedCharges,
          op.charges.map((charge) => ({ id: charge.id, row: expectedChargeToRow(charge) })),
        );
        break;
      case "addExpectedCharges":
        await addMissingRows(
          client,
          TAB.expectedCharges,
          op.charges.map((charge) => ({ id: charge.id, row: expectedChargeToRow(charge) })),
        );
        break;
      case "upsertShortcut":
        await upsertRows(client, TAB.shortcuts, [
          { id: op.shortcut.id, row: shortcutToRow(op.shortcut) },
        ]);
        break;
      case "deleteShortcut":
        await deleteRowsById(client, TAB.shortcuts, [op.id]);
        break;
      case "savePaymentPlan":
        await client.updateValues([
          { range: `${quote(TAB.settings)}!B6`, values: paymentPlanToCells(op.plan) },
        ]);
        break;
    }
  }
}
