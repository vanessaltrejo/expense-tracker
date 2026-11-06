import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getCardStatus, getCutForDate, getDueDateForCut } from "./billing.ts";
import {
  buildDashboard,
  buildPeriodSummary,
  estimateYield,
  getYieldEarnedBetween,
} from "./dashboard.ts";
import { dateInMonth, formatDayHeader, getTodayInMexico } from "./dates.ts";
import { getHistoryCategories, matchesKind } from "./history.ts";
import { formatPeriodRange, getPeriodForDate, getPeriodsWithData, isInPeriod } from "./periods.ts";
import { APP_USERS, canEdit, findUserById, findUserByUsername, toSessionUser } from "./users.ts";
import { getInitials } from "./profile.ts";
import {
  getLedgerBalances,
  isMomDebtEntry,
  OPENING_BALANCE_CATEGORY,
} from "./ledger.ts";
import { parseMoneyInput, pesos } from "./money.ts";
import { getLoanBalances, LOAN_CATEGORY, personOf } from "./loans.ts";
import { getBreakdowns, parentIdOf } from "./breakdown.ts";
import { getFrequentPlaces, getSentToPeople, getTopPlaces, placeOfNote } from "./places.ts";
import { generateExpectedCharges } from "./recurring.ts";
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
  expenseCategories: [],
  incomeCategories: [],
  places: [],
  placeCategories: [],
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
];

/** Most tests use a 0% cajita so balances are plain sums; the yield tests pass 0.13. */
function appData(movements: Movement[], today = "2026-11-03", cajitaRate = 0): AppData {
  return {
    movements,
    fixedExpenses,
    expectedCharges: generateExpectedCharges(fixedExpenses, [], today),
    statements: [],
    shortcuts: [],
    settings: { ...settings, annualYieldRate: cajitaRate },
    paymentPlan: { plannedDate: null },
  };
}

describe("periods", () => {
  test("a period runs from one cut to the day before the next and is paid on the 1st", () => {
    const period = getPeriodForDate("2026-11-06", settings);
    assert.deepEqual(period, {
      start: "2026-10-22",
      end: "2026-11-21",
      cutDate: "2026-11-22",
      dueDate: "2026-12-01",
    });
    assert.equal(formatPeriodRange(period), "22 oct – 21 nov");
  });

  test("the cut day already belongs to the next period", () => {
    assert.equal(getPeriodForDate("2026-11-21", settings).end, "2026-11-21");
    const next = getPeriodForDate("2026-11-22", settings);
    assert.equal(next.start, "2026-11-22");
    assert.equal(next.dueDate, "2027-01-01");
    assert.equal(isInPeriod("2026-11-22", getPeriodForDate("2026-11-06", settings)), false);
  });

  test("the summary ranks categories by share and lists the biggest expenses", () => {
    const movements = [
      opening("cajita", 1_000),
      row({ date: "2026-10-23", type: "cardExpense", amount: pesos(600), from: "tarjetaNu", category: "escuela", note: "Viaje" }),
      row({ date: "2026-10-30", type: "cardExpense", amount: pesos(300), from: "tarjetaNu", category: "salidas", note: "Salida" }),
      row({ date: "2026-11-01", type: "cardExpense", amount: pesos(100), from: "tarjetaNu", category: "comida", note: "Comida" }),
      row({ date: "2026-11-02", type: "cardExpense", amount: pesos(50), from: "tarjetaNu", category: "comida", note: "Más comida" }),
      row({ date: "2026-10-20", type: "cardExpense", amount: pesos(999), from: "tarjetaNu", category: "otros" }),
      row({ date: "2026-11-03", type: "income", amount: pesos(1_200), to: "banorte", category: "comedor" }),
    ];
    const summary = buildPeriodSummary(appData(movements), "2026-11-05");

    assert.equal(summary.totalSpent, pesos(1_050));
    assert.equal(summary.expenseCount, 4);
    assert.deepEqual(
      summary.categories.map((item) => [item.category, item.amount]),
      [["escuela", pesos(600)], ["salidas", pesos(300)], ["comida", pesos(150)]],
    );
    assert.equal(Math.round(summary.categories[0].share * 100), 57);
    assert.deepEqual(summary.largest.map((item) => item.note), ["Viaje", "Salida", "Comida", "Más comida"]);
    // The 999 from before the cut belongs to the previous period, and income is kept apart.
    assert.equal(summary.income, pesos(1_200));
  });
});

describe("simple layout (one BBVA account, by month)", () => {
  test("deposits add and spends subtract from the one account", () => {
    const movements = [
      opening("bbva", 1_000),
      row({ date: "2026-11-02", type: "income", amount: pesos(500), to: "bbva", category: "mamá" }),
      row({ date: "2026-11-03", type: "expense", amount: pesos(120), from: "bbva", category: "gym" }),
    ];
    assert.equal(getLedgerBalances(movements, "2026-11-04").bbva, pesos(1_380));
  });

  test("a cut day of 1 makes the period a calendar month", () => {
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    assert.equal(period.start, "2026-11-01");
    assert.equal(period.end, "2026-11-30");
    assert.equal(getPeriodForDate("2026-12-01", { cutDay: 1, dueDay: 1 }).start, "2026-12-01");
  });
});

describe("places and sent money (simple layout)", () => {
  const placeSettings: Settings = {
    ...settings,
    places: ["Shake Shack", "Wingstop", "Cinépolis"],
    placeCategories: ["salidas", "dates"],
  };
  const spend = (date: string, note: string, category = "salidas", amount = 100) =>
    row({ date, type: "expense", amount: pesos(amount), from: "bbva", category, note });

  test("buttons come from the Sheet, most used first, and only for categories that ask for a place", () => {
    const movements = [
      spend("2026-11-01", "Wingstop"),
      spend("2026-11-02", "Wingstop"),
      spend("2026-11-03", "Shake Shack"),
    ];
    assert.deepEqual(getFrequentPlaces(movements, placeSettings, "salidas"), [
      "Wingstop",
      "Shake Shack",
      "Cinépolis",
    ]);
    assert.deepEqual(getFrequentPlaces(movements, placeSettings, "gym"), []);
    assert.deepEqual(getFrequentPlaces(movements, placeSettings, null), []);
  });

  test("a place typed twice in a category becomes a button there, once does not", () => {
    const movements = [
      spend("2026-11-01", "Carl's Jr"),
      spend("2026-11-02", "carl's jr"),
      spend("2026-11-03", "Tacos del Tec"),
    ];
    const places = getFrequentPlaces(movements, placeSettings, "salidas");
    assert.ok(places.includes("Carl's Jr"));
    assert.ok(!places.includes("Tacos del Tec"));
    // What was learned in Salidas isn't offered in Dates.
    assert.ok(!getFrequentPlaces(movements, placeSettings, "dates").includes("Carl's Jr"));
  });

  test("top places add up what was spent at each, ignoring other categories", () => {
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    const movements = [
      spend("2026-11-01", "Wingstop", "salidas", 200),
      spend("2026-11-05", "wingstop", "dates", 150),
      spend("2026-11-06", "Shake Shack", "salidas", 90),
      spend("2026-11-07", "Day pass", "gym", 120),
    ];
    const top = getTopPlaces(movements, placeSettings, period, 5);
    assert.deepEqual(top.map((item) => [item.place, item.amount, item.count]), [
      ["Wingstop", pesos(350), 2],
      ["Shake Shack", pesos(90), 1],
    ]);
  });

  test("money sent to a person leaves the account but is not spending", () => {
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    const movements = [
      opening("bbva", 1_000),
      row({ date: "2026-11-03", type: "transfer", amount: pesos(300), from: "bbva", note: "A Vanessa" }),
      row({ date: "2026-11-04", type: "transfer", amount: pesos(100), from: "bbva", note: "A Mamá" }),
    ];
    assert.equal(getLedgerBalances(movements, "2026-11-05").bbva, pesos(600));
    const sent = getSentToPeople(movements, period);
    assert.equal(sent.total, pesos(400));
    assert.deepEqual(sent.people.map((item) => item.place), ["A Vanessa", "A Mamá"]);
    assert.equal(buildPeriodSummary(appData(movements, "2026-11-05"), "2026-11-05").totalSpent, 0);
  });
});

describe("places by category and notes with detail", () => {
  const scoped: Settings = {
    ...settings,
    places: ["Shake Shack", "Bread", "12 Rounds", "Estación"],
    placeCategories: ["dates", "antojos míos", "gym", "aparte"],
    placeScopes: { bread: ["Dates", "antojos míos"], "12 rounds": ["gym"], estación: ["aparte"] },
  };

  test("each place is offered only in its categories, and places without one go everywhere", () => {
    assert.deepEqual(getFrequentPlaces([], scoped, "dates"), ["Shake Shack", "Bread"]);
    assert.deepEqual(getFrequentPlaces([], scoped, "antojos míos"), ["Shake Shack", "Bread"]);
    assert.deepEqual(getFrequentPlaces([], scoped, "gym"), ["Shake Shack", "12 Rounds"]);
    assert.deepEqual(getFrequentPlaces([], scoped, "aparte"), ["Shake Shack", "Estación"]);
  });

  test("a note with detail still names its place, and only at a word edge", () => {
    const places = ["Bread", "12 Rounds"];
    assert.equal(placeOfNote("Bread · pain aux chocolat", places), "Bread");
    assert.equal(placeOfNote("12 rounds (day pass)", places), "12 Rounds");
    assert.equal(placeOfNote("Breadsticks", places), "Breadsticks");
    assert.equal(placeOfNote("Tacos", places), "Tacos");
  });

  test("the top places group notes with detail under their place", () => {
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    const gymRow = (date: string, note: string, amount: number) =>
      row({ date, type: "expense", amount: pesos(amount), from: "bbva", category: "gym", note });
    const top = getTopPlaces(
      [gymRow("2026-11-02", "12 Rounds (day pass)", 180), gymRow("2026-11-03", "12 Rounds", 180)],
      { ...scoped, placeCategories: ["gym"] },
      period,
      5,
    );
    assert.deepEqual(top.map((item) => [item.place, item.amount, item.count]), [["12 Rounds", pesos(360), 2]]);
  });
});

describe("earlier periods with data", () => {
  const monthly = { cutDay: 1, dueDay: 1 };

  test("lists the current month and every earlier month with real movements, newest first", () => {
    const movements = [
      opening("bbva", 30, "2026-11-06"),
      row({ date: "2026-10-31", type: "expense", amount: pesos(100), from: "bbva", category: "salidas" }),
      row({ date: "2026-10-30", type: "income", amount: pesos(3_200), to: "bbva", category: "mesada" }),
      row({ date: "2026-08-02", type: "expense", amount: pesos(50), from: "bbva", category: "otros" }),
    ];
    const periods = getPeriodsWithData(movements, monthly, "2026-11-06");
    assert.deepEqual(periods.map((period) => period.start), ["2026-11-01", "2026-10-01", "2026-08-01"]);
  });

  test("an opening balance alone, a dummy row or a future row don't open a period", () => {
    const movements = [
      opening("bbva", 30, "2026-09-10"),
      row({ date: "2026-10-05", type: "expense", amount: pesos(10), from: "bbva", dataKind: "dummy" }),
      row({ date: "2026-12-05", type: "expense", amount: pesos(10), from: "bbva" }),
    ];
    assert.deepEqual(getPeriodsWithData(movements, monthly, "2026-11-06").map((period) => period.start), ["2026-11-01"]);
  });

  test("the summary of an earlier month adds up only that month", () => {
    const movements = [
      row({ date: "2026-10-31", type: "expense", amount: pesos(700), category: "salidas" }),
      row({ date: "2026-11-03", type: "expense", amount: pesos(585), category: "salidas" }),
    ];
    const data = appData(movements, "2026-11-06");
    const october = getPeriodForDate("2026-10-31", monthly);
    assert.equal(buildPeriodSummary({ ...data, settings: { ...data.settings, ...monthly } }, "2026-11-06", october).totalSpent, pesos(700));
  });
});

describe("breakdowns", () => {
  const transfer = row({ date: "2026-11-04", type: "transfer", amount: pesos(1_000), from: "bbva", to: "efectivo" }, "m1");
  const part = (n: number, amount: number, category: string, note: string) =>
    row({ date: "2026-11-04", type: "expense", amount: pesos(amount), from: "efectivo", category, note }, `m1.${n}`);

  test("a part is named after its movement, and only counts when that movement exists", () => {
    assert.equal(parentIdOf("m1.2"), "m1");
    assert.equal(parentIdOf("m1"), null);
    const { partsByParent, partIds } = getBreakdowns([transfer, part(2, 25, "estacionamiento", "x"), part(1, 420, "dates", "Shake Shack")]);
    assert.deepEqual(partsByParent.get("m1")?.map((item) => item.id), ["m1.1", "m1.2"]);
    assert.equal(partIds.size, 2);
    assert.equal(getBreakdowns([part(1, 10, "dates", "x")]).partIds.size, 0);
  });

  test("the parts count as spending and the bank movement doesn't, with no double count", () => {
    const movements = [opening("bbva", 2_000), opening("efectivo", 0), transfer, part(1, 420, "dates", "Shake Shack"), part(2, 580, "aparte", "Estación")];
    const summary = buildPeriodSummary(appData(movements, "2026-11-05"), "2026-11-05");
    assert.equal(summary.totalSpent, pesos(1_000));
    // The withdrawal moves cash in, the parts take it out: BBVA drops by 1,000 and cash nets to 0.
    const balances = getLedgerBalances(movements, "2026-11-05");
    assert.equal(balances.bbva, pesos(1_000));
    assert.equal(balances.efectivo, 0);
  });

  test("a transfer with a breakdown is not listed as money sent to a person", () => {
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    const spei = row({ date: "2026-10-31", type: "transfer", amount: pesos(1_600), from: "bbva", note: "Se lo debía" }, "m9");
    const parts = [
      row({ date: "2026-10-31", type: "expense", amount: pesos(700), category: "salidas", note: "Cielo Mágico" }, "m9.1"),
      row({ date: "2026-10-31", type: "expense", amount: pesos(900), category: "salidas", note: "Panorama" }, "m9.2"),
    ];
    const october = getPeriodForDate("2026-10-31", { cutDay: 1, dueDay: 1 });
    assert.equal(getSentToPeople([spei], october).total, pesos(1_600));
    assert.equal(getSentToPeople([spei, ...parts], october).total, 0);
    assert.equal(getSentToPeople([spei, ...parts], period).total, 0);
  });
});

describe("loans to relatives", () => {
  const lend = (date: string, amount: number, from: MovementEndpoint, person: string) =>
    row({ date, type: "transfer", amount: pesos(amount), from, category: LOAN_CATEGORY, note: `A ${person}` });
  const repay = (date: string, amount: number, to: MovementEndpoint, person: string) =>
    row({ date, type: "transfer", amount: pesos(amount), to, category: LOAN_CATEGORY, note: `De ${person}` });

  test("what is still owed is what was lent minus what came back, per person", () => {
    const movements = [
      lend("2026-11-01", 500, "efectivo", "Mamá"),
      lend("2026-11-02", 300, "bbva", "Papá"),
      repay("2026-11-05", 200, "bbva", "mamá"),
      repay("2026-11-06", 300, "efectivo", "Papá"),
    ];
    const owed = getLoanBalances(movements);
    assert.deepEqual(owed.map((item) => [item.person, item.owed]), [["Mamá", pesos(300)]]);
    assert.equal(owed[0].lastDate, "2026-11-05");
  });

  test("a loan moves the balance, but is neither spending nor income nor a plain send", () => {
    const movements = [
      opening("bbva", 1_000),
      lend("2026-11-03", 400, "bbva", "Mamá"),
      repay("2026-11-04", 100, "bbva", "Mamá"),
    ];
    const period = getPeriodForDate("2026-11-15", { cutDay: 1, dueDay: 1 });
    assert.equal(getLedgerBalances(movements, "2026-11-05").bbva, pesos(700));
    const summary = buildPeriodSummary(appData(movements, "2026-11-05"), "2026-11-05");
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.income, 0);
    assert.equal(getSentToPeople(movements, period).total, 0);
  });

  test("the person's name is read from the note without its prefix", () => {
    assert.equal(personOf("A Mamá"), "Mamá");
    assert.equal(personOf("De Tía Lupe"), "Tía Lupe");
    assert.equal(personOf("Papá"), "Papá");
  });
});

describe("users", () => {
  test("Vanessa and Francisco own their data; Mami only reads Vanessa's Sheet", () => {
    assert.deepEqual(APP_USERS.map((user) => [user.id, user.role]), [
      ["vanessa", "owner"],
      ["mami", "viewer"],
      ["francisco", "owner"],
    ]);
    assert.equal(canEdit("owner"), true);
    assert.equal(canEdit("viewer"), false);
    assert.equal(findUserById("mami")?.sheetIdEnv, findUserById("vanessa")?.sheetIdEnv);
    assert.notEqual(findUserById("francisco")?.sheetIdEnv, findUserById("vanessa")?.sheetIdEnv);
  });

  test("the username ignores uppercase and spaces, and unknown names find nobody", () => {
    assert.equal(findUserByUsername("  Vanessa ")?.id, "vanessa");
    assert.equal(findUserByUsername("desconocido"), null);
    assert.equal(findUserByUsername(42), null);
    assert.equal(findUserById(null), null);
  });

  test("the browser only learns the id, name, role and color", () => {
    const vanessa = findUserById("vanessa");
    assert.ok(vanessa);
    assert.deepEqual(Object.keys(toSessionUser(vanessa)).sort(), ["id", "layout", "name", "role", "tone"]);
  });
});

describe("profile", () => {
  test("initials are the first letters of the first and last name", () => {
    assert.equal(getInitials("Vanessa Trejo"), "VT");
    assert.equal(getInitials("  vanessa   trejo "), "VT");
    assert.equal(getInitials("Ana María López Ruiz"), "AR");
    assert.equal(getInitials("Vanessa"), "V");
    assert.equal(getInitials(""), "?");
  });
});

describe("day headers", () => {
  test("read like Nu: weekday, day and short month", () => {
    assert.equal(formatDayHeader("2026-11-05"), "Jueves 5 nov");
    assert.equal(formatDayHeader("2026-10-22"), "Jueves 22 oct");
    assert.equal(formatDayHeader("2026-11-01"), "Domingo 1 nov");
  });
});

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

  test("rows before an opening balance still count in their period's summary", () => {
    const movements = [
      opening("cajita", 1_000),
      opening("tarjetaNu", 0),
      row({ date: "2026-10-25", type: "cardExpense", amount: pesos(99), from: "tarjetaNu", category: "comida" }),
    ];
    const summary = buildPeriodSummary(appData(movements), "2026-11-03");
    assert.equal(summary.categories[0].amount, pesos(99));
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

test("card debt and Deuda mami come from movements, with no opening balance", () => {
  const movements = [
    opening("cajita", 1_000),
    row({ date: "2026-10-22", type: "cardExpense", amount: pesos(5_000), from: "tarjetaNu", category: "escuela", note: "Viaje EGS" }),
    row({ date: "2026-10-23", type: "cardExpense", amount: pesos(156.1), from: "tarjetaNu", category: "escuela" }),
    row({ date: "2026-10-22", type: "adjustment", amount: pesos(5_000), to: "porCobrarMama", category: "Deuda mami", note: "Viaje EGS" }),
  ];
  const dashboard = buildDashboard(appData(movements), "2026-11-05");
  assert.equal(dashboard.debt, pesos(5_156.1));
  assert.equal(dashboard.balances.porCobrarMama, pesos(5_000));
  // The charges count in the summary of the period they belong to.
  assert.equal(buildPeriodSummary(appData(movements), "2026-11-05").categories[0].amount, pesos(5_156.1));
});

test("Deuda mami bookkeeping stays out of the history, real money moves don't", () => {
  const bookkeeping = row({ date: "2026-10-22", type: "adjustment", amount: pesos(5_000), to: "porCobrarMama", category: "Deuda mami", note: "Viaje EGS" });
  const lentWithCard = row({ date: "2026-11-05", type: "transfer", amount: pesos(200), from: "tarjetaNu", to: "porCobrarMama" });
  const repayment = row({ date: "2026-11-05", type: "transfer", amount: pesos(200), from: "porCobrarMama", to: "efectivo" });
  assert.equal(isMomDebtEntry(bookkeeping), true);
  assert.equal(isMomDebtEntry(lentWithCard), false);
  assert.equal(isMomDebtEntry(repayment), false);
});

describe("history filters", () => {
  const spending = row({ date: "2026-11-02", type: "cardExpense", amount: pesos(99), from: "tarjetaNu", category: "comida" });
  const income = row({ date: "2026-11-03", type: "income", amount: pesos(1_200), to: "banorte", category: "comedor" });
  const opening1 = opening("cajita", 1_000);
  const momEntry = row({ date: "2026-10-22", type: "adjustment", amount: pesos(5_000), to: "porCobrarMama", category: "Deuda mami" });
  const repayment = row({ date: "2026-11-05", type: "transfer", amount: pesos(500), from: "porCobrarMama", to: "banorte" });

  test("categories come only from real spending and income, split in two", () => {
    const categories = getHistoryCategories([spending, income, opening1, momEntry, repayment]);
    assert.deepEqual(categories.expenses, ["comida"]);
    assert.deepEqual(categories.income, ["comedor"]);
  });

  test("the Gastos and Ingresos switch keeps transfers and adjustments out", () => {
    assert.equal(matchesKind(spending, "expenses"), true);
    assert.equal(matchesKind(income, "expenses"), false);
    assert.equal(matchesKind(income, "income"), true);
    assert.equal(matchesKind(repayment, "income"), false);
    assert.equal(matchesKind(repayment, "all"), true);
  });

  test("what mom pays back lands in Banorte and then moves on to the cajita", () => {
    const movements = [
      opening("cajita", 1_000),
      opening("banorte", 0),
      row({ date: "2026-10-22", type: "adjustment", amount: pesos(5_000), to: "porCobrarMama", category: "Deuda mami" }),
      row({ date: "2026-11-05", type: "transfer", amount: pesos(5_000), from: "porCobrarMama", to: "banorte" }),
    ];
    let balances = getLedgerBalances(movements, "2026-11-05");
    assert.equal(balances.banorte, pesos(5_000));
    assert.equal(balances.porCobrarMama, 0);

    movements.push(row({ date: "2026-11-06", type: "transfer", amount: pesos(5_000), from: "banorte", to: "cajita" }));
    balances = getLedgerBalances(movements, "2026-11-06");
    assert.equal(balances.banorte, 0);
    assert.equal(balances.cajita, pesos(6_000));
  });
});

describe("card payments", () => {
  test("paying with cash is a transfer to the card and lowers the debt", () => {
    const movements = [
      opening("efectivo", 800),
      opening("tarjetaNu", 1_500),
      row({ date: "2026-11-02", type: "transfer", amount: pesos(800), from: "efectivo", to: "tarjetaNu" }),
    ];
    const balances = getLedgerBalances(movements, "2026-11-03");
    assert.equal(balances.efectivo, 0);
    assert.equal(-balances.tarjetaNu, pesos(700));
  });

  test("extra money from mom is an income in Banorte and leaves Deuda mami alone", () => {
    const movements = [
      opening("banorte", 0),
      row({ date: "2026-11-02", type: "income", amount: pesos(2_000), to: "banorte", category: "mamá" }),
    ];
    const balances = getLedgerBalances(movements, "2026-11-03");
    assert.equal(balances.banorte, pesos(2_000));
    assert.equal(balances.porCobrarMama, 0);
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
  test("only charges up to the next cut show: Spotify and Claude Pro, not iCloud on the 27th", () => {
    const dashboard = buildDashboard(appData([opening("cajita", 10_000)]), "2026-11-03");
    assert.deepEqual(
      dashboard.upcomingCharges.map((charge) => charge.name),
      ["Spotify Premium", "Claude Pro"],
    );
    assert.equal(dashboard.projectedDue, pesos(474));
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
    assert.deepEqual(
      buildDashboard(skipped, "2026-11-03").upcomingCharges.map((charge) => charge.name),
      ["Spotify Premium"],
    );
  });

  test("after the cut, the next period's charges appear, including iCloud", () => {
    const data = appData([opening("cajita", 1_000)], "2026-11-23");
    const dashboard = buildDashboard(data, "2026-11-23");
    // The unconfirmed November ones stay (overdue); the new period adds iCloud, Spotify and
    // Claude of December. January's charges are still out of the period.
    assert.deepEqual(
      dashboard.upcomingCharges.map((charge) => charge.date),
      ["2026-11-05", "2026-11-18", "2026-11-27", "2026-12-05", "2026-12-18"],
    );
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
});

describe("yield", () => {
  test("the estimate compounds daily, a few centavos above the simple interest table", () => {
    assert.equal(estimateYield(pesos(100), 0.13, 10), 36);
    assert.equal(estimateYield(pesos(5_000), 0.13, 10), 1_784);
    assert.equal(estimateYield(pesos(20_000), 0.13, 10), 7_135);
  });

  test("the cajita balance grows by itself every day", () => {
    const movements = [opening("cajita", 10_000, "2026-11-01")];
    const day0 = getLedgerBalances(movements, "2026-11-01", 0.13).cajita;
    const day30 = getLedgerBalances(movements, "2026-12-01", 0.13).cajita;
    assert.equal(day0, pesos(10_000));
    assert.equal(day30, 1_010_740);
    // Without a rate, nothing grows.
    assert.equal(getLedgerBalances(movements, "2026-12-01").cajita, pesos(10_000));
  });

  test("money added later earns only from the day it arrives", () => {
    const movements = [
      opening("cajita", 10_000, "2026-11-01"),
      row({ date: "2026-11-11", type: "transfer", amount: pesos(5_000), from: "banorte", to: "cajita" }),
    ];
    assert.equal(getLedgerBalances(movements, "2026-12-01", 0.13).cajita, 1_514_314);
  });

  test("tomorrow's balance is a little higher, not lower", () => {
    const movements = [opening("cajita", 3_664, "2026-11-05")];
    const today = getLedgerBalances(movements, "2026-11-06", 0.13).cajita;
    const tomorrow = getLedgerBalances(movements, "2026-11-07", 0.13).cajita;
    assert.ok(tomorrow > today);
    assert.ok(tomorrow - today <= 200);
  });

  test("interest earned in a range counts the growth plus the user's corrections", () => {
    const movements = [
      opening("cajita", 10_000, "2026-11-01"),
      row({ date: "2026-11-15", type: "adjustment", amount: pesos(2), to: "cajita", category: "Rendimiento" }),
    ];
    const earned = getYieldEarnedBetween(movements, 0.13, "2026-11-01", "2026-11-30", "2026-11-30");
    const growth = getLedgerBalances(movements, "2026-11-30", 0.13).cajita - pesos(10_000) - pesos(2);
    assert.equal(earned, growth + pesos(2));
    assert.ok(earned > pesos(100));
  });

  test("defaults to the day before the due date and estimates from the grown balance", () => {
    const data = appData([opening("cajita", 20_000)], "2026-11-20", 0.13);
    const dashboard = buildDashboard(data, "2026-11-20");
    assert.equal(dashboard.plan.plannedDate, "2026-11-30");
    // The balance already grew for 19 days, and the estimate compounds from there.
    assert.ok(dashboard.balances.cajita > pesos(20_000));
    assert.equal(
      dashboard.estimatedYield,
      estimateYield(dashboard.balances.cajita, 0.13, 10),
    );
  });
});
