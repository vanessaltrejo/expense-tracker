/** Money stored as an integer number of centavos, which avoids float rounding errors. */
export type Cents = number;

/** Calendar date formatted as YYYY-MM-DD. Plain strings have no timezone to shift. */
export type IsoDate = string;

export type PocketId =
  | "cajita"
  | "banorte"
  | "efectivo"
  | "porCobrarMama"
  | "tarjetaNu"
  /** The single debit account of the simple layout. */
  | "bbva";

/** Where money leaves from or lands in. Mom never appears: what she owes lives in Deuda mami. */
export type MovementEndpoint = PocketId;

export type MovementType =
  | "income"
  | "expense"
  | "cardExpense"
  | "transfer"
  | "adjustment";

/**
 * real: counts everywhere.
 * previo: really happened before the app, so it is already inside the opening balances: it
 * counts in summaries and in the Sheet's views, but never moves a balance or the card debt.
 */
export type DataKind = "real" | "previo";

export interface Movement {
  id: string;
  date: IsoDate;
  type: MovementType;
  /** Always positive. Direction comes from `from` and `to`. */
  amount: Cents;
  from: MovementEndpoint | null;
  to: MovementEndpoint | null;
  category: string | null;
  note: string;
  dataKind: DataKind;
}

export type MovementDraft = Omit<Movement, "id">;

export type FixedExpenseSchedule =
  | { kind: "monthly"; dayOfMonth: number }
  | { kind: "yearly"; month: number; dayOfMonth: number };

export interface FixedExpense {
  id: string;
  name: string;
  normalAmount: Cents;
  schedule: FixedExpenseSchedule;
  category: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  active: boolean;
}

export type ExpectedChargeStatus = "expected" | "charged" | "skipped";

export interface ExpectedCharge {
  id: string;
  fixedExpenseId: string;
  name: string;
  date: IsoDate;
  amount: Cents;
  category: string;
  status: ExpectedChargeStatus;
}

/**
 * One row of Cortes. The due date wins over the usual day of Ajustes, for the months when Nu
 * moves it. The amount can be left empty while the statement isn't out yet: the app then
 * keeps calculating it.
 */
export interface StatementRecord {
  cutDate: IsoDate;
  dueDate: IsoDate;
  statementAmount: Cents | null;
}

export interface Shortcut {
  id: string;
  name: string;
  /** Null until the real price is known: the first tap asks for it. */
  amount: Cents | null;
  category: string;
  paidFrom: MovementEndpoint;
}

export interface Settings {
  cardLimit: Cents;
  cutDay: number;
  dueDay: number;
  /** Yearly rate as a fraction: 0.13 means 13%. */
  annualYieldRate: number;
  expenseCategories: string[];
  incomeCategories: string[];
  /** Frequent places (Shake Shack, Cinépolis…), offered as one-tap buttons. Optional per person. */
  places: string[];
  /** The categories where the place buttons appear. */
  placeCategories: string[];
  /**
   * Where each place is offered: place (lowercase) → its categories. A place without an
   * entry is offered in every category that asks for a place. Missing on older devices.
   */
  placeScopes?: Record<string, string[]>;
}

export interface PaymentPlan {
  /** Day the user intends to pay. Null falls back to the day before the due date. */
  plannedDate: IsoDate | null;
}

export interface AppData {
  movements: Movement[];
  fixedExpenses: FixedExpense[];
  expectedCharges: ExpectedCharge[];
  statements: StatementRecord[];
  shortcuts: Shortcut[];
  settings: Settings;
  paymentPlan: PaymentPlan;
}
