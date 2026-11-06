import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  cellToCents,
  cellToIsoDate,
  expectedChargeToRow,
  fixedExpenseToRow,
  movementToRow,
  parseExpectedChargeRow,
  parseFixedExpenseRow,
  parseMovementRow,
  parseRows,
  parseSettings,
  parseShortcutRow,
  shortcutToRow,
} from "./sheetMapping.ts";
import { parseSyncOps } from "./syncOps.ts";
import type { FixedExpense, Movement, Settings } from "./types.ts";

const fallback: Settings = {
  cardLimit: 4_000_000,
  cutDay: 22,
  dueDay: 1,
  annualYieldRate: 0.13,
  paydayDays: [14, 29],
  expenseCategories: ["comida"],
  incomeCategories: ["horno³"],
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
    dataKind: "dummy",
  };

  test("a row written by the app reads back the same", () => {
    const row = movementToRow(movement);
    assert.deepEqual(row, ["H22", "2026-10-31", "Gasto con tarjeta", 1307.06, "Tarjeta Nu", "", "salidas", "Salida Panorama", "Dummy"]);
    const parsed = parseMovementRow(row);
    assert.ok("value" in parsed);
    assert.deepEqual(parsed.value, movement);
  });

  test("a row edited by hand with a wrong type or amount is flagged, not counted", () => {
    const badType = parseMovementRow(["H1", 46331, "Compra", 10, "Tarjeta Nu", "", "", "", "Real"]);
    assert.ok("issue" in badType);
    const badAmount = parseMovementRow(["H1", 46331, "Gasto", "diez", "Efectivo", "", "", "", "Real"]);
    assert.ok("issue" in badAmount);
  });

  test("rows written before the Deuda mami rename still read as the same pocket", () => {
    const oldName = parseMovementRow(["4", 46331, "Ajuste", 5000, "", "Por cobrar (mamá)", "Saldo inicial", "", "Real"]);
    const newName = parseMovementRow(["4", 46331, "Ajuste", 5000, "", "Deuda mami", "Saldo inicial", "", "Real"]);
    assert.ok("value" in oldName && "value" in newName);
    assert.equal(oldName.value.to, "porCobrarMama");
    assert.equal(newName.value.to, "porCobrarMama");
  });

  test("an empty Dato means Real, and an empty ID is kept for the app to fill", () => {
    const parsed = parseMovementRow(["", 46331, "Ingreso", 500, "", "Banorte", "mamá", "", ""]);
    assert.ok("value" in parsed);
    assert.equal(parsed.value.id, "");
    assert.equal(parsed.value.dataKind, "real");
    assert.equal(parsed.value.to, "banorte");
  });

  test("a row with only an unchecked checkbox counts as empty", () => {
    const result = parseRows(
      [["", "", "", "", "", "", "", "", "", "", "", false]],
      parseFixedExpenseRow,
      "Gastos fijos",
      7,
    );
    assert.equal(result.items.length, 0);
    assert.equal(result.issues.length, 0);
  });

  test("blank rows are skipped and bad rows are reported with their row number", () => {
    const result = parseRows(
      [["H1", 46331, "Gasto", 10, "Efectivo", "", "otros", "", "Real"], [], ["H2", "x", "Gasto", 10, "Efectivo"]],
      parseMovementRow,
      "Movimientos",
      2,
    );
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.issues, [{ tab: "Movimientos", row: 4, reason: "La fecha no es válida" }]);
  });
});

describe("other tabs", () => {
  test("fixed expenses round-trip for each kind of schedule", () => {
    const expenses: FixedExpense[] = [
      { id: "spotify", name: "Spotify Premium", normalAmount: 7_400, schedule: { kind: "monthly", dayOfMonth: 5 }, category: "suscripciones", startDate: "2026-09-01", endDate: null, active: true },
      { id: "parallels", name: "Parallels", normalAmount: 199_900, schedule: { kind: "yearly", month: 5, dayOfMonth: 26 }, category: "suscripciones", startDate: "2026-05-26", endDate: null, active: true },
      { id: "nails", name: "Uñas", normalAmount: 55_500, schedule: { kind: "everyNDays", days: 21, lastDate: "2026-11-01" }, category: "otros", startDate: "2026-07-01", endDate: "2027-01-01", active: false },
    ];
    for (const expense of expenses) {
      const parsed = parseFixedExpenseRow(fixedExpenseToRow(expense));
      assert.ok("value" in parsed);
      assert.deepEqual(parsed.value, expense);
    }
  });

  test("expected charges and shortcuts round-trip, and a shortcut can have no price", () => {
    const charge = { id: "spotify:2026-11-05", fixedExpenseId: "spotify", name: "Spotify Premium", date: "2026-11-05", amount: 7_400, category: "suscripciones", status: "charged" as const };
    const parsedCharge = parseExpectedChargeRow(expectedChargeToRow(charge));
    assert.ok("value" in parsedCharge);
    assert.deepEqual(parsedCharge.value, charge);

    const shortcut = { id: "s2", name: "Dona de Krispy Kreme", amount: null, category: "antojos", paidFrom: "tarjetaNu" as const, fixedExpenseId: null };
    const parsedShortcut = parseShortcutRow(shortcutToRow(shortcut));
    assert.ok("value" in parsedShortcut);
    assert.deepEqual(parsedShortcut.value, shortcut);
  });

  test("Ajustes gives the settings, the category lists and the payment plan", () => {
    const rows = [
      ["Ajuste", "Valor", "Nota", null, "Categorías", "Categorías de ingreso"],
      ["Límite de la tarjeta", 40000, "", null, "comida", "horno³"],
      ["Día de corte", 22, "", null, "pendiente", "comedor"],
      ["Día límite de pago", 1],
      ["Tasa anual de la cajita", 0.13],
      ["Días de quincena", "14, 29"],
      ["Aviso de cobros", 3],
      ["Aviso de pago", 2],
      ["Plan: de la cajita", 100],
      ["Plan: en efectivo", 500],
      ["Plan: regalo de mamá", 0],
      ["Plan: día de pago", 46355],
    ];
    const { settings, plan } = parseSettings(rows, fallback);
    assert.equal(settings.cardLimit, 4_000_000);
    assert.deepEqual(settings.paydayDays, [14, 29]);
    assert.deepEqual(settings.expenseCategories, ["comida", "pendiente"]);
    assert.deepEqual(settings.incomeCategories, ["horno³", "comedor"]);
    assert.deepEqual(plan, { fromCajita: 10_000, fromCash: 50_000, momGift: 0, plannedDate: "2026-11-29" });
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
