/** Money stored as an integer number of centavos, which avoids float rounding errors. */
export type Cents = number;

/** Calendar date formatted as YYYY-MM-DD. Plain strings have no timezone to shift. */
export type IsoDate = string;

export type PocketId =
  | "cajita"
  | "banorte"
  | "efectivo"
  | "porCobrarMama"
  | "tarjetaNu";

/** Mom can pay for something without any of the user's pockets being involved. */
export type MovementEndpoint = PocketId | "mama";

export type MovementType =
  | "income"
  | "expense"
  | "cardExpense"
  | "transfer"
  | "adjustment";

/** real: counts everywhere. dummy: placeholder, counts nowhere. */
export type DataKind = "real" | "dummy";

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
  | { kind: "yearly"; month: number; dayOfMonth: number }
  /** No fixed day: the app only reminds once `days` have passed since `lastDate`. */
  | { kind: "everyNDays"; days: number; lastDate: IsoDate };

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

export interface StatementRecord {
  cutDate: IsoDate;
  dueDate: IsoDate;
  statementAmount: Cents;
}

export interface Shortcut {
  id: string;
  name: string;
  /** Null until the real price is known: the first tap asks for it. */
  amount: Cents | null;
  category: string;
  paidFrom: MovementEndpoint;
  /** Links a shortcut to an interval expense, so using it restarts that reminder. */
  fixedExpenseId: string | null;
}

export interface Settings {
  cardLimit: Cents;
  cutDay: number;
  dueDay: number;
  /** Yearly rate as a fraction: 0.13 means 13%. */
  annualYieldRate: number;
  paydayDays: number[];
  expenseCategories: string[];
  incomeCategories: string[];
}

export interface PaymentPlan {
  fromCajita: Cents;
  fromCash: Cents;
  momGift: Cents;
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
