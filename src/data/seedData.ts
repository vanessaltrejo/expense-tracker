import { pesos } from "@/domain/money";
import type {
  FixedExpense,
  PaymentPlan,
  Settings,
  Shortcut,
  StatementRecord,
} from "@/domain/types";

/**
 * Real data taken from the proposal, loaded the first time the app opens.
 * Balances are not here on purpose: the setup screen asks for today's real ones.
 */

export const seedFixedExpenses: FixedExpense[] = [
  {
    id: "claude-pro",
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

export const seedStatements: StatementRecord[] = [
  { cutDate: "2026-07-22", dueDate: "2026-08-01", statementAmount: 0 },
  { cutDate: "2026-08-22", dueDate: "2026-09-01", statementAmount: pesos(15_691) },
  { cutDate: "2026-09-22", dueDate: "2026-10-01", statementAmount: pesos(3_873) },
  { cutDate: "2026-10-22", dueDate: "2026-11-01", statementAmount: pesos(5_403) },
];

export const seedShortcuts: Shortcut[] = [
  { id: "s1", name: "Dona del Tims", amount: pesos(27), category: "antojos", paidFrom: "tarjetaNu", fixedExpenseId: null },
  { id: "s2", name: "Dona de Krispy Kreme", amount: null, category: "antojos", paidFrom: "tarjetaNu", fixedExpenseId: null },
  { id: "s3", name: "Chilaquiles de Super Salads", amount: pesos(99), category: "comida", paidFrom: "tarjetaNu", fixedExpenseId: null },
  { id: "s4", name: "Pizza individual", amount: pesos(85), category: "comida", paidFrom: "tarjetaNu", fixedExpenseId: null },
  { id: "s5", name: "Uñas", amount: pesos(555), category: "otros", paidFrom: "tarjetaNu", fixedExpenseId: "nails" },
];

export const seedSettings: Settings = {
  cardLimit: pesos(40_000),
  cutDay: 22,
  dueDay: 1,
  annualYieldRate: 0.13,
  paydayDays: [14, 29],
  expenseCategories: [
    "comida",
    "salidas",
    "transporte",
    "escuela",
    "antojos",
    "pareja",
    "mamá",
    "suscripciones",
    "otros",
    "pendiente",
    "no sé",
  ],
  incomeCategories: ["horno³", "comedor", "mamá", "otros"],
};

/** Category for something to review later. The app reminds about these on Home. */
export const PENDING_CATEGORY = "pendiente";

export const emptyPaymentPlan: PaymentPlan = {
  fromCajita: 0,
  fromCash: 0,
  momGift: 0,
  plannedDate: null,
};
