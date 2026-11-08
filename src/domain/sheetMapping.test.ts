import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canonicalColumns,
  cellRuns,
  columnLetter,
  findColumns,
  rowFromRecord,
  SheetLayoutError,
} from "./sheetColumns.ts";
import {
  cellToCents,
  cellToIsoDate,
  dropDuplicateIds,
  EXPECTED_CHARGES_TABLE,
  expectedChargeToRecord,
  FIXED_EXPENSES_TABLE,
  findSettingRow,
  MOVEMENTS_TABLE,
  movementToRecord,
  parseExpectedChargeRow,
  parseFixedExpenseRow,
  parseMovementRow,
  parseRows,
  parseSettings,
  parseShortcutRow,
  parseStatementRow,
  readTable,
  SHORTCUTS_TABLE,
  shortcutToRecord,
  STATEMENTS_TABLE,
} from "./sheetMapping.ts";
import type { SheetRow } from "./sheetColumns.ts";
import { compactSyncOps, parseSyncOps } from "./syncOps.ts";
import type { Movement, Settings } from "./types.ts";

// The columns of a Sheet built from scratch, in the order they are declared.
const movementColumns = canonicalColumns(MOVEMENTS_TABLE.columns);
const fixedColumns = canonicalColumns(FIXED_EXPENSES_TABLE.columns);
const chargeColumns = canonicalColumns(EXPECTED_CHARGES_TABLE.columns);
const statementColumns = canonicalColumns(STATEMENTS_TABLE.columns);
const shortcutColumns = canonicalColumns(SHORTCUTS_TABLE.columns);

const parseMovement = (row: SheetRow) => parseMovementRow(row, movementColumns);
const parseFixedExpense = (row: SheetRow) => parseFixedExpenseRow(row, fixedColumns);
const parseExpectedCharge = (row: SheetRow) => parseExpectedChargeRow(row, chargeColumns);
const parseStatement = (row: SheetRow) => parseStatementRow(row, statementColumns);
const parseShortcut = (row: SheetRow) => parseShortcutRow(row, shortcutColumns);

const fallback: Settings = {
  cardLimit: 4_000_000,
  cutDay: 22,
  dueDay: 1,
  annualYieldRate: 0.13,
  expenseCategories: ["comida"],
  incomeCategories: ["horno³"],
  places: [],
  placeCategories: [],
};

describe("sheet cells", () => {
  test("serial dates and typed dates both become ISO dates", () => {
    // 46331 is 2026-11-05 in Google Sheets.
    assert.equal(cellToIsoDate(46331), "2026-11-05");
    assert.equal(cellToIsoDate("2026-11-05"), "2026-11-05");
    assert.equal(cellToIsoDate("ayer"), null);
  });

  test("pesos become centavos without rounding errors", () => {
    assert.equal(cellToCents(1307.06), 130_706);
    assert.equal(cellToCents("$1,307.06"), 130_706);
    assert.equal(cellToCents(""), null);
    assert.equal(cellToCents("cien"), null);
  });
});

describe("Movimientos rows", () => {
  const movement: Movement = {
    id: "H22",
    date: "2026-10-31",
    type: "cardExpense",
    amount: 130_706,
    from: "tarjetaNu",
    to: null,
    category: "salidas",
    note: "Salida Panorama",
    dataKind: "real",
  };

  test("a row written by the app reads back the same", () => {
    const row = rowFromRecord(movementColumns, movementToRecord(movement));
    assert.deepEqual(row, ["H22", "2026-10-31", "Gasto con tarjeta", 1307.06, "Tarjeta Nu crédito", "", "salidas", "Salida Panorama", "Real"]);
    const parsed = parseMovement(row);
    assert.ok("value" in parsed);
    assert.deepEqual(parsed.value, movement);
  });

  test("Dummy no longer exists: a leftover row is flagged instead of counted", () => {
    const parsed = parseMovement(["H1", 46331, "Gasto", 10, "Efectivo", "", "otros", "", "Dummy"]);
    assert.deepEqual(parsed, { issue: 'El dato "Dummy" no existe' });
  });

  test("an old row of 9 cells still reads, and Previo is a data kind of its own", () => {
    const parsed = parseMovement(["H1", 46168, "Gasto con tarjeta", 1138, "Tarjeta Nu crédito", "", "suscripciones", "Parallels", "Previo"]);
    assert.ok("value" in parsed);
    assert.equal(parsed.value.dataKind, "previo");
  });


  test("a row edited by hand with a wrong type or amount is flagged, not counted", () => {
    const badType = parseMovement(["H1", 46331, "Compra", 10, "Tarjeta Nu crédito", "", "", "", "Real"]);
    assert.ok("issue" in badType);
    const badAmount = parseMovement(["H1", 46331, "Gasto", "diez", "Efectivo", "", "", "", "Real"]);
    assert.ok("issue" in badAmount);
  });

  test("an empty Dato means Real, and an empty ID is kept for the app to fill", () => {
    const parsed = parseMovement(["", 46331, "Ingreso", 500, "", "Banorte", "mamá", "", ""]);
    assert.ok("value" in parsed);
    assert.equal(parsed.value.id, "");
    assert.equal(parsed.value.dataKind, "real");
    assert.equal(parsed.value.to, "banorte");
  });

  test("a row with only an unchecked checkbox counts as empty", () => {
    const result = parseRows(
      [["", "", "", "", "", "", "", "", "", "", "", false]],
      parseFixedExpense,
      "Gastos fijos",
      7,
    );
    assert.equal(result.items.length, 0);
    assert.equal(result.issues.length, 0);
  });

  test("the BBVA account reads and writes with its own label", () => {
    const parsed = parseMovement(["1", 46331, "Gasto", 50, "BBVA", "", "gym", "Day pass", "Real"]);
    assert.ok("value" in parsed);
    assert.equal(parsed.value.from, "bbva");
    assert.equal(rowFromRecord(movementColumns, movementToRecord(parsed.value))[4], "BBVA");
  });

  test("blank rows are skipped and bad rows are reported with their row number", () => {
    const result = parseRows(
      [["H1", 46331, "Gasto", 10, "Efectivo", "", "otros", "", "Real"], [], ["H2", "x", "Gasto", 10, "Efectivo"]],
      parseMovement,
      "Movimientos",
      2,
    );
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.issues, [{ tab: "Movimientos", row: 4, reason: "La fecha no es válida" }]);
  });
});

describe("other tabs", () => {
  test("fixed expenses read as monthly or yearly, and a bad one is reported", () => {
    const monthly = parseFixedExpense(["spotify", "Spotify Premium", 74, "Mensual", 5, "", "suscripciones", 46266, "", true]);
    assert.ok("value" in monthly);
    assert.deepEqual(monthly.value, { id: "spotify", name: "Spotify Premium", normalAmount: 7_400, schedule: { kind: "monthly", dayOfMonth: 5 }, category: "suscripciones", startDate: "2026-09-01", endDate: null, active: true });

    const yearly = parseFixedExpense(["parallels", "Parallels", 1999, "Anual", 26, 5, "suscripciones", 46168, "", true]);
    assert.ok("value" in yearly);
    assert.deepEqual(yearly.value.schedule, { kind: "yearly", month: 5, dayOfMonth: 26 });

    assert.ok("issue" in parseFixedExpense(["x", "Algo", 10, "Cada N días", "", "", "otros", 46266, "", true]));
  });

  test("expected charges and shortcuts round-trip, and a shortcut can have no price", () => {
    const charge = { id: "spotify:2026-11-05", fixedExpenseId: "spotify", name: "Spotify Premium", date: "2026-11-05", amount: 7_400, category: "suscripciones", status: "charged" as const };
    const parsedCharge = parseExpectedCharge(rowFromRecord(chargeColumns, expectedChargeToRecord(charge)));
    assert.ok("value" in parsedCharge);
    assert.deepEqual(parsedCharge.value, charge);

    const shortcut = { id: "s2", name: "Dona de Krispy Kreme", amount: null, category: "antojos", paidFrom: "tarjetaNu" as const };
    const parsedShortcut = parseShortcut(rowFromRecord(shortcutColumns, shortcutToRecord(shortcut)));
    assert.ok("value" in parsedShortcut);
    assert.deepEqual(parsedShortcut.value, shortcut);
  });

  test("the simple layout's Sheet can list places and the categories that ask for one", () => {
    const rows: (string | number | null)[][] = [
      ["Ajuste", "Valor", "Nota", null, "Categorías de gasto", "Categorías de ingreso", "Bolsas", "Lugares frecuentes", "Categorías con lugar"],
      ["x", 0, "", null, "salidas", "mamá", "BBVA", "Shake Shack", "salidas"],
      ["x", 1, "", null, "dates", "papá", "", "Cinépolis", "dates"],
    ];
    const { settings } = parseSettings(rows, fallback);
    assert.deepEqual(settings.places, ["Shake Shack", "Cinépolis"]);
    assert.deepEqual(settings.placeCategories, ["salidas", "dates"]);
  });

  test("'Dónde sale cada lugar' says where each place is offered, with commas for several categories", () => {
    const rows = [
      ["Ajuste", "Valor", "Lugares frecuentes", "Categorías con lugar", "Dónde sale cada lugar"],
      ["x", 0, "Shake Shack", "dates", "dates, Salidas"],
      ["x", 1, "", "salidas", ""],
      ["x", 2, "Wingstop", "", ""],
    ];
    const { settings } = parseSettings(rows, fallback);
    assert.deepEqual(settings.places, ["Shake Shack", "Wingstop"]);
    assert.deepEqual(settings.placeScopes, { "shake shack": ["dates", "Salidas"] });
  });

  test("Ajustes gives the settings, the category lists and the payment day", () => {
    const rows = [
      ["Ajuste", "Valor", "Nota", null, "Categorías de gasto", "Categorías de ingreso"],
      ["Límite de la tarjeta", 40000, "", null, "comida", "horno³"],
      ["Día de corte", 22, "", null, "pendiente", "comedor"],
      ["Día límite de pago", 1],
      ["Tasa anual de la cajita", 0.13],
      ["Día de pago", 46355],
    ];
    const { settings, plan } = parseSettings(rows, fallback);
    assert.equal(settings.cardLimit, 4_000_000);
    assert.deepEqual(settings.expenseCategories, ["comida", "pendiente"]);
    assert.deepEqual(settings.incomeCategories, ["horno³", "comedor"]);
    assert.deepEqual(plan, { plannedDate: "2026-11-29" });
    // Without the simple layout's columns, there are no places.
    assert.deepEqual(settings.places, []);
    assert.deepEqual(settings.placeCategories, []);
  });
});

describe("Ajustes can be rearranged", () => {
  test("deleting the empty column between the settings and the lists changes nothing", () => {
    const rows = [
      ["Ajuste", "Valor", "Nota", "Categorías de gasto", "Categorías de ingreso", "Bolsas (fija)", "Todas las categorías (automática)"],
      ["Límite de la tarjeta", 40000, "", "comida", "horno³", "Banorte", "comida"],
      ["Día de corte", 22, "", "salidas", "comedor", "Efectivo", "salidas"],
      ["Día límite de pago", 1],
      ["Tasa anual de la cajita", 0.13],
      ["Día de pago", ""],
    ];
    const { settings } = parseSettings(rows, fallback);
    assert.deepEqual(settings.expenseCategories, ["comida", "salidas"]);
    assert.deepEqual(settings.incomeCategories, ["horno³", "comedor"]);
    assert.equal(settings.cutDay, 22);
  });

  test("a setting is found by its name even if its row moved, and the Valor column can move too", () => {
    const rows = [
      ["Nota", "Ajuste", "Valor"],
      ["x", "Nota para mí", "x"],
      ["x", "Día de corte", 15],
      ["x", "Límite de la tarjeta", 20000],
      ["x", "Día de pago", 46355],
    ];
    assert.equal(findSettingRow(rows, "cutDay", 1), 3);
    assert.equal(findSettingRow(rows, "paymentDay", 1), 5);
    const { settings, plan } = parseSettings(rows, fallback);
    assert.equal(settings.cardLimit, 2_000_000);
    assert.equal(settings.cutDay, 15);
    assert.deepEqual(plan, { plannedDate: "2026-11-29" });
  });

  test("a setting that isn't there is not guessed from a position: the app's default is used", () => {
    const rows = [
      ["Ajuste", "Valor"],
      ["Día de corte", 15],
    ];
    assert.equal(findSettingRow(rows, "yieldRate"), null);
    const { settings, plan } = parseSettings(rows, fallback);
    assert.equal(settings.annualYieldRate, fallback.annualYieldRate);
    assert.equal(settings.cardLimit, fallback.cardLimit);
    assert.deepEqual(plan, { plannedDate: null });
  });

  test("a category list that was renamed is not read from whatever sits in its old column", () => {
    const rows = [
      ["Ajuste", "Valor", "Gastos", "Categorías de ingreso"],
      ["Día de corte", 22, "horno³", "mamá"],
    ];
    const { settings } = parseSettings(rows, fallback);
    assert.deepEqual(settings.expenseCategories, fallback.expenseCategories);
    assert.deepEqual(settings.incomeCategories, ["mamá"]);
  });

  test("without the Ajuste and Valor columns the tab can't be read", () => {
    assert.throws(() => parseSettings([["Nombre", "Cantidad"]], fallback), SheetLayoutError);
  });
});

describe("data tabs are read by their header", () => {
  const record = (movement: Movement) => movementToRecord(movement);
  const gasto: Movement = {
    id: "261105-ab12",
    date: "2026-11-05",
    type: "expense",
    amount: 5_000,
    from: "efectivo",
    to: null,
    category: "comida",
    note: "Tacos",
    dataKind: "real",
  };

  test("columns that were moved, inserted or renamed with a note still map to the right data", () => {
    const header = ["Mi nota", "Nota", "Dato", "Fecha", "ID", "Monto (pesos)", "Tipo", "De", "A", "Categoría"];
    const row = ["a mano", "Tacos", "Real", 46331, "261105-ab12", 50, "Gasto", "Efectivo", "", "comida"];
    const result = readTable([header, row], MOVEMENTS_TABLE);
    assert.deepEqual(result.items, [gasto]);
    assert.deepEqual(result.rowNumbers, [2]);
    assert.deepEqual(result.issues, []);
  });

  test("a missing column stops the read and names every column that is gone", () => {
    const header = ["ID", "Fecha", "Tipo", "De", "A", "Categoría", "Nota"];
    assert.throws(
      () => readTable([header], MOVEMENTS_TABLE),
      (error: unknown) =>
        error instanceof SheetLayoutError &&
        error.tab === "Movimientos" &&
        error.missing.join() === "Monto,Dato" &&
        /falta.*"Monto", "Dato"/.test(error.message),
    );
    assert.throws(() => readTable([], STATEMENTS_TABLE), SheetLayoutError);
  });

  test("a row that only has the person's own columns filled counts as empty", () => {
    const header = ["Fecha de corte", "Fecha límite", "Estado de cuenta", "Falta", "% del límite"];
    const result = readTable([header, ["", "", "", 1234, 0.5], [46348, 46359, "", 99, 0.1]], STATEMENTS_TABLE);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.rowNumbers, [3]);
  });

  test("a row is written into the columns where they are, leaving the rest blank", () => {
    const header = ["Mi nota", "Nota", "Dato", "Fecha", "ID", "Monto", "Tipo", "De", "A", "Categoría"];
    const columns = findColumns("Movimientos", header, MOVEMENTS_TABLE.columns);
    assert.deepEqual(rowFromRecord(columns, record(gasto)), [null, "Tacos", "Real", "2026-11-05", "261105-ab12", 50, "Gasto", "Efectivo", "", "comida"]);
  });

  test("updating a row writes runs of neighbouring columns and never touches the others", () => {
    const header = ["ID", "Fecha", "Mi nota", "Tipo", "Monto", "De", "A", "Categoría", "Nota", "Dato"];
    const columns = findColumns("Movimientos", header, MOVEMENTS_TABLE.columns);
    const runs = cellRuns(columns, record(gasto));
    assert.deepEqual(
      runs.map((run) => run.first),
      [0, 3],
    );
    assert.deepEqual(runs[0], { first: 0, values: ["261105-ab12", "2026-11-05"] });
    assert.equal(runs[1]?.values.length, 7);
    // Column C ("Mi nota") belongs to the person: no run covers it.
    const written = runs.flatMap((run) => run.values.map((_, offset) => run.first + offset));
    assert.ok(!written.includes(2));
    assert.equal(written.length, 9);
  });

  test("extra columns in the Sheet don't change how many columns the app owns", () => {
    const header = ["ID", "Gasto fijo", "Nombre", "Fecha", "Monto", "Categoría", "Estado", "Se paga el"];
    const result = readTable([header, ["spotify:2026-11-05", "spotify", "Spotify", 46331, 74, "suscripciones", "Esperado", 46335]], EXPECTED_CHARGES_TABLE);
    assert.equal(result.items.length, 1);
    assert.equal(result.columns.status, 6);
  });
});

describe("column letters", () => {
  test("they count like the Sheet does, past Z", () => {
    assert.equal(columnLetter(0), "A");
    assert.equal(columnLetter(8), "I");
    assert.equal(columnLetter(25), "Z");
    assert.equal(columnLetter(26), "AA");
    assert.equal(columnLetter(701), "ZZ");
    assert.equal(columnLetter(702), "AAA");
  });
});

describe("sync requests", () => {
  test("only well-formed changes from the browser are accepted", () => {
    assert.deepEqual(parseSyncOps([{ kind: "deleteShortcut", id: "s1" }]), [{ kind: "deleteShortcut", id: "s1" }]);
    assert.equal(parseSyncOps([{ kind: "deleteShortcut", id: 3 }]), null);
    assert.equal(parseSyncOps([{ kind: "dropTable" }]), null);
    assert.equal(parseSyncOps("hola"), null);
  });

  test("generated charges travel as add-only, separate from charges the user changed", () => {
    const charge = { id: "spotify:2026-11-05", fixedExpenseId: "spotify", name: "Spotify Premium", date: "2026-11-05", amount: 7_400, category: "suscripciones", status: "expected" };
    const ops = parseSyncOps([{ kind: "addExpectedCharges", charges: [charge] }]);
    assert.equal(ops?.[0]?.kind, "addExpectedCharges");
  });
});

describe("pending changes", () => {
  const gasto = (id: string, amount = 5_000): Movement => ({
    id,
    date: "2026-11-08",
    type: "cardExpense",
    amount,
    from: "tarjetaNu",
    to: null,
    category: "comida",
    note: "",
    dataKind: "real",
  });

  test("a gasto added and deleted before syncing only leaves the delete", () => {
    const ops = compactSyncOps([
      { kind: "upsertMovements", movements: [gasto("a")] },
      { kind: "deleteMovements", ids: ["a"] },
    ]);
    assert.deepEqual(ops, [{ kind: "deleteMovements", ids: ["a"] }]);
  });

  test("a gasto deleted and then restored by undo ends as a single write", () => {
    const ops = compactSyncOps([
      { kind: "deleteMovements", ids: ["a"] },
      { kind: "upsertMovements", movements: [gasto("a")] },
    ]);
    assert.deepEqual(ops, [{ kind: "upsertMovements", movements: [gasto("a")] }]);
  });

  test("several edits of one gasto keep only the last one", () => {
    const ops = compactSyncOps([
      { kind: "upsertMovements", movements: [gasto("a", 1_000), gasto("b")] },
      { kind: "upsertMovements", movements: [gasto("a", 2_000)] },
    ]);
    assert.deepEqual(ops, [{ kind: "upsertMovements", movements: [gasto("a", 2_000), gasto("b")] }]);
  });

  test("other kinds of change pass through in order", () => {
    const plan = { kind: "savePaymentPlan" as const, plan: { plannedDate: "2026-11-20" } };
    const ops = compactSyncOps([plan, { kind: "deleteShortcut", id: "s1" }]);
    assert.deepEqual(ops, [plan, { kind: "deleteShortcut", id: "s1" }]);
  });
});

describe("Cortes rows", () => {
  test("a due date can be written before the statement amount is known", () => {
    const parsed = parseStatement([46348, 46359, ""]);
    assert.ok("value" in parsed);
    assert.deepEqual(parsed.value, { cutDate: "2026-11-22", dueDate: "2026-12-03", statementAmount: null });
    assert.ok("issue" in parseStatement([46348, 46359, "mucho"]));
    assert.ok("issue" in parseStatement([46348, "", 100]));
  });

  test("deleting generated charges travels as its own change", () => {
    const ops = parseSyncOps([{ kind: "deleteExpectedCharges", ids: ["icloud:2026-11-27"] }]);
    assert.deepEqual(ops, [{ kind: "deleteExpectedCharges", ids: ["icloud:2026-11-27"] }]);
    assert.equal(parseSyncOps([{ kind: "deleteExpectedCharges", ids: [3] }]), null);
  });
});

describe("repeated IDs in the Sheet", () => {
  test("the first row keeps the ID and the copy is reported", () => {
    const gasto = (id: string, amount: number) => ({ id, amount });
    const { items, issues, rowNumbers } = dropDuplicateIds(
      { items: [gasto("a", 1), gasto("b", 2), gasto("a", 1), gasto("", 3)], issues: [], rowNumbers: [2, 3, 4, 5] },
      "Movimientos",
    );
    assert.deepEqual(items.map((item) => item.id), ["a", "b", ""]);
    assert.deepEqual(rowNumbers, [2, 3, 5]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.row, 4);
    assert.match(issues[0]?.reason ?? "", /fila 2/);
  });
});
