import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getCardStatus, getCutForDate, getDueDateForCut } from "./billing.ts";
import { buildDashboard, buildMonthlySummary, estimateYield } from "./dashboard.ts";
import { dateInMonth, getTodayInMexico } from "./dates.ts";
import {
  buildPaymentMovements,
  buildYieldAdjustment,
  getLedgerBalances,
  OPENING_BALANCE_CATEGORY,
} from "./ledger.ts";
import { parseMoneyInput, pesos } from "./money.ts";
import { generateExpectedCharges, getIntervalReminders } from "./recurring.ts";
import type {
  AppData,
  FixedExpense,
  Movement,
  MovementDraft,
  MovementEndpoint,
  Settings,
} from "./types.ts";

const settings: Settings = {
  cardLimit: pesos(40_000),
  cutDay: 22,
  dueDay: 1,
  annualYieldRate: 0.13,
  paydayDays: [14, 29],
  expenseCategories: [],
  incomeCategories: [],
};

function row(draft: Partial<MovementDraft> & Pick<MovementDraft, "date" | "type" | "amount">, id = "x"): Movement {
  return {
    id,
    from: null,
    to: null,
    category: null,
    note: "",
    dataKind: "real",
    ...draft,
  };
}

function opening(pocket: MovementEndpoint, amount: number, date = "2026-11-01"): Movement {
  const isDebt = pocket === "tarjetaNu";
  return row({
    date,
    type: "adjustment",
    amount: pesos(amount),
    from: isDebt ? pocket : null,
    to: isDebt ? null : pocket,
    category: OPENING_BALANCE_CATEGORY,
  });
}

function fromDrafts(drafts: MovementDraft[]): Movement[] {
  return drafts.map((draft, index) => ({ ...draft, id: `d${index}` }));
}

const fixedExpenses: FixedExpense[] = [
  {
    id: "claude",
    name: "Claude Pro",
    normalAmount: pesos(400),
    schedule: { kind: "monthly", dayOfMonth: 18 },
    category: "suscripciones",
    startDate: "2026-08-01",
    endDate: null,
    active: true,
  },
  {
    id: "spotify",
    name: "Spotify Premium",
    normalAmount: pesos(74),
    schedule: { kind: "monthly", dayOfMonth: 5 },
    category: "suscripciones",
    startDate: "2026-09-01",
    endDate: null,
    active: true,
  },
  {
    id: "icloud",
    name: "iCloud",
    normalAmount: pesos(180),
    schedule: { kind: "monthly", dayOfMonth: 27 },
    category: "suscripciones",
    startDate: "2026-09-01",
    endDate: null,
    active: true,
  },
  {
    id: "parallels",
    name: "Parallels",
    normalAmount: pesos(1_999),
    schedule: { kind: "yearly", month: 5, dayOfMonth: 26 },
    category: "suscripciones",
    startDate: "2026-05-26",
    endDate: null,
    active: true,
  },
  {
    id: "nails",
    name: "Uñas",
    normalAmount: pesos(555),
    schedule: { kind: "everyNDays", days: 21, lastDate: "2026-11-01" },
    category: "otros",
    startDate: "2026-07-01",
    endDate: null,
    active: true,
  },
];

function appData(movements: Movement[], today = "2026-11-03"): AppData {
  return {
    movements,
    fixedExpenses,
    expectedCharges: generateExpectedCharges(fixedExpenses, [], today),
    statements: [],
    shortcuts: [],
    settings,
    paymentPlan: { fromCajita: 0, fromCash: 0, momGift: 0, plannedDate: null },
  };
}

describe("money", () => {
  test("reads typed amounts exactly", () => {
    assert.equal(parseMoneyInput("99"), 9_900);
    assert.equal(parseMoneyInput("$1,000.50"), 100_050);
    assert.equal(parseMoneyInput("0.1"), 10);
    assert.equal(parseMoneyInput(".5"), null);
    assert.equal(parseMoneyInput("abc"), null);
    assert.equal(parseMoneyInput("1.234"), null);
  });
});

describe("dates", () => {
  test("today follows Mexico, not UTC", () => {
    // 03:00 UTC on Nov 4 is still the evening of Nov 3 in Mexico City.
    assert.equal(getTodayInMexico(new Date("2026-11-04T03:00:00Z")), "2026-11-03");
  });

  test("day 29 falls back to the end of February", () => {
    assert.equal(dateInMonth(2027, 2, 29), "2027-02-28");
    assert.equal(dateInMonth(2028, 2, 29), "2028-02-29");
  });
});

describe("balances", () => {
  test("dummy rows and rows before the opening balance don't move saldos", () => {
    const balances = getLedgerBalances(
      [
        opening("cajita", 1_000),
        row({ date: "2026-10-20", type: "transfer", amount: pesos(500), from: "cajita", to: "banorte" }),
        row({ date: "2026-11-02", type: "income", amount: pesos(300), to: "cajita", dataKind: "dummy" }),
        row({ date: "2026-11-02", type: "income", amount: pesos(100), to: "cajita" }),
      ],
      "2026-11-03",
    );
    assert.equal(balances.cajita, pesos(1_100));
  });

  test("a sale paid by mom moves nothing but still counts in the summary", () => {
    const movements = [
      opening("cajita", 1_000),
      row({ date: "2026-11-02", type: "expense", amount: pesos(555), from: "mama", category: "otros" }),
    ];
    const dashboard = buildDashboard(appData(movements), "2026-11-03");
    const summary = buildMonthlySummary(appData(movements), "2026-11-03");

    assert.equal(dashboard.free, pesos(1_000));
    assert.equal(summary.categories[0].thisMonth, pesos(555));
    assert.equal(summary.outflowThisMonth, 0);
    assert.equal(summary.paidByMomThisMonth, pesos(555));
  });

  test("older rows count in the summary even if they don't move saldos", () => {
    const movements = [
      opening("cajita", 1_000),
      opening("tarjetaNu", 0),
      row({ date: "2026-10-20", type: "cardExpense", amount: pesos(99), from: "tarjetaNu", category: "comida" }),
    ];
    const summary = buildMonthlySummary(appData(movements), "2026-11-03");
    assert.equal(summary.categories[0].lastMonth, pesos(99));
    assert.equal(buildDashboard(appData(movements), "2026-11-03").debt, 0);
  });

  test("mom's loan counts in free money but can't pay the card yet", () => {
    const dashboard = buildDashboard(
      appData([
        opening("cajita", 10_000),
        opening("banorte", 500),
        opening("efectivo", 200),
        opening("porCobrarMama", 400),
        opening("tarjetaNu", 3_000),
      ]),
      "2026-11-03",
    );
    assert.equal(dashboard.realMoney, pesos(10_700));
    assert.equal(dashboard.debt, pesos(3_000));
    assert.equal(dashboard.free, pesos(8_100));
    assert.equal(dashboard.toCoverDebt, 0);
    assert.equal(dashboard.creditLeft, pesos(37_000));
  });

  test("a reserved plan does not lower free money twice", () => {
    const data = appData([opening("cajita", 1_000), opening("tarjetaNu", 600)]);
    const withPlan: AppData = {
      ...data,
      paymentPlan: { fromCajita: pesos(100), fromCash: pesos(500), momGift: 0, plannedDate: null },
    };
    assert.equal(buildDashboard(withPlan, "2026-11-03").free, pesos(400));
  });
});

test("Vanessa's real case: 7,534 still to cover and -2,534 free", () => {
  const dashboard = buildDashboard(
    appData([
      opening("cajita", 3_664),
      opening("banorte", 0),
      opening("efectivo", 420),
      opening("porCobrarMama", 5_000),
      opening("tarjetaNu", 11_618),
    ]),
    "2026-11-05",
  );
  assert.equal(dashboard.toCoverDebt, pesos(7_534));
  assert.equal(dashboard.free, pesos(-2_534));
});

test("prior rows count in the summary but never in balances", () => {
  const movements = [
    opening("cajita", 1_000),
    opening("tarjetaNu", 99),
    row({ date: "2026-11-05", type: "cardExpense", amount: pesos(99), from: "tarjetaNu", category: "comida", dataKind: "prior" }),
  ];
  assert.equal(buildDashboard(appData(movements), "2026-11-05").debt, pesos(99));
  assert.equal(buildMonthlySummary(appData(movements), "2026-11-05").categories[0].thisMonth, pesos(99));
});

describe("card payments", () => {
  test("800 in cash plus a 200 gift lowers the debt by 1,000", () => {
    const movements = [
      opening("efectivo", 800),
      opening("tarjetaNu", 1_500),
      ...fromDrafts(
        buildPaymentMovements({
          date: "2026-11-02",
          fromCajita: 0,
          fromCash: pesos(800),
          momGift: pesos(200),
        }),
      ),
    ];
    const balances = getLedgerBalances(movements, "2026-11-03");
    assert.equal(balances.efectivo, 0);
    assert.equal(-balances.tarjetaNu, pesos(500));
  });

  test("100 one day and 200 the next pay a 300 statement in full", () => {
    const movements = [
      row({ date: "2026-10-30", type: "adjustment", amount: 0, category: "x" }),
      row({ date: "2026-11-22", type: "transfer", amount: pesos(100), from: "cajita", to: "tarjetaNu" }),
      row({ date: "2026-11-24", type: "transfer", amount: pesos(200), from: "cajita", to: "tarjetaNu" }),
      row({ date: "2026-11-10", type: "cardExpense", amount: pesos(300), from: "tarjetaNu" }),
      row({ date: "2026-11-22", type: "cardExpense", amount: pesos(50), from: "tarjetaNu" }),
    ];
    const partial = getCardStatus(movements, [], settings, "2026-11-23");
    assert.equal(partial.nextPeriod, pesos(50));
    assert.equal(partial.statementAmount, pesos(300));
    assert.equal(partial.remaining, pesos(200));
    assert.equal(partial.isFullyPaid, false);

    const full = getCardStatus(movements, [], settings, "2026-11-24");
    assert.equal(full.remaining, 0);
    assert.equal(full.isFullyPaid, true);
  });

  test("a purchase on the cut day already goes to the next period, as in Nu", () => {
    assert.equal(getCutForDate("2026-11-21", settings), "2026-11-22");
    assert.equal(getCutForDate("2026-11-22", settings), "2026-12-22");
    assert.equal(getDueDateForCut("2026-11-22", settings), "2026-12-01");
    assert.equal(getDueDateForCut("2026-12-22", settings), "2027-01-01");
  });

  test("a purchase after the cut goes to the next period while the bill is paid", () => {
    const movements = [
      row({ date: "2026-11-10", type: "cardExpense", amount: pesos(300), from: "tarjetaNu" }),
      row({ date: "2026-11-25", type: "cardExpense", amount: pesos(99), from: "tarjetaNu" }),
    ];
    const status = getCardStatus(movements, [], settings, "2026-11-26");
    assert.equal(status.phase, "closed");
    assert.equal(status.remaining, pesos(300));
    assert.equal(status.nextPeriod, pesos(99));
    assert.equal(status.dueDate, "2026-12-01");
    assert.equal(status.daysLeft, 5);
  });

  test("the due date itself still counts as payable", () => {
    const movements = [row({ date: "2026-11-10", type: "cardExpense", amount: pesos(300), from: "tarjetaNu" })];
    assert.equal(getCardStatus(movements, [], settings, "2026-12-01").phase, "closed");
    assert.equal(getCardStatus(movements, [], settings, "2026-12-02").phase, "open");
  });

  test("a recorded statement wins over the calculation", () => {
    const status = getCardStatus(
      [],
      [{ cutDate: "2026-10-22", dueDate: "2026-11-01", statementAmount: pesos(5_403) }],
      settings,
      "2026-10-25",
    );
    assert.equal(status.statementAmount, pesos(5_403));
  });
});

describe("expected charges", () => {
  test("November matches the proposal: 654 expected, 474 on Dec 1 and 180 on Jan 1", () => {
    const dashboard = buildDashboard(appData([opening("cajita", 10_000)]), "2026-11-03");
    assert.equal(dashboard.expectedThisMonth, pesos(654));
    assert.equal(dashboard.freeAfterExpected, pesos(10_000 - 654));
    assert.equal(dashboard.projectedDue, pesos(474));
    assert.equal(dashboard.projectedNext, pesos(180));
    assert.equal(dashboard.card.dueDate, "2026-12-01");
  });

  test("generating again keeps a one-month amount change and a skip", () => {
    const first = generateExpectedCharges(fixedExpenses, [], "2026-11-03");
    const edited = first.map((charge) => {
      if (charge.id === "spotify:2026-11-05") return { ...charge, amount: pesos(90) };
      if (charge.id === "claude:2026-11-18") return { ...charge, status: "skipped" as const };
      return charge;
    });
    const second = generateExpectedCharges(fixedExpenses, edited, "2026-11-04");

    assert.equal(second.length, first.length);
    assert.equal(second.find((c) => c.id === "spotify:2026-11-05")?.amount, pesos(90));
    assert.equal(second.find((c) => c.id === "claude:2026-11-18")?.status, "skipped");
  });

  test("a skipped charge doesn't count against free money", () => {
    const data = appData([opening("cajita", 1_000)]);
    const skipped: AppData = {
      ...data,
      expectedCharges: data.expectedCharges.map((charge) =>
        charge.id === "claude:2026-11-18" ? { ...charge, status: "skipped" } : charge,
      ),
    };
    assert.equal(buildDashboard(skipped, "2026-11-03").expectedThisMonth, pesos(254));
  });

  test("an end date stops future charges and yearly ones only appear in their month", () => {
    const ended = fixedExpenses.map((expense) =>
      expense.id === "spotify" ? { ...expense, endDate: "2026-11-01" } : expense,
    );
    const ids = generateExpectedCharges(ended, [], "2026-11-03").map((c) => c.id);
    assert.ok(!ids.some((id) => id.startsWith("spotify")));
    assert.ok(!ids.some((id) => id.startsWith("parallels")));
    assert.ok(generateExpectedCharges(fixedExpenses, [], "2027-05-01").some((c) => c.id === "parallels:2027-05-26"));
  });

  test("nails come due on Nov 22, three weeks after Nov 1", () => {
    const [before] = getIntervalReminders(fixedExpenses, "2026-11-21");
    const [after] = getIntervalReminders(fixedExpenses, "2026-11-22");
    assert.equal(before.isDue, false);
    assert.equal(after.isDue, true);
    assert.equal(after.dueDate, "2026-11-22");
  });
});

describe("yield", () => {
  test("matches the table in the proposal", () => {
    assert.equal(estimateYield(pesos(100), 0.13, 10), 36);
    assert.equal(estimateYield(pesos(5_000), 0.13, 10), 1_781);
    assert.equal(estimateYield(pesos(20_000), 0.13, 10), 7_123);
  });

  test("defaults to the day before the due date and recalculates when money moves", () => {
    const dashboard = buildDashboard(appData([opening("cajita", 20_000)]), "2026-11-20");
    assert.equal(dashboard.plan.plannedDate, "2026-11-30");
    assert.equal(dashboard.estimatedYield, 7_123);
  });

  test("a balance check stores the difference as yield", () => {
    const up = buildYieldAdjustment(pesos(1_000), pesos(1_005), "2026-11-03");
    assert.equal(up?.to, "cajita");
    assert.equal(up?.amount, pesos(5));

    const down = buildYieldAdjustment(pesos(1_000), pesos(998), "2026-11-03");
    assert.equal(down?.from, "cajita");
    assert.equal(buildYieldAdjustment(pesos(10), pesos(10), "2026-11-03"), null);
  });
});
