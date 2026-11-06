import {
  type CardStatus,
  getCardStatus,
  getCutForDate,
  getRecentStatements,
} from "./billing.ts";
import {
  addDays,
  daysBetween,
  endOfMonth,
  monthKey,
  previousMonthKey,
} from "./dates.ts";
import { dailyGrowth, getLedgerBalances, YIELD_CATEGORY } from "./ledger.ts";
import { getIntervalReminders, type IntervalReminder } from "./recurring.ts";
import type {
  AppData,
  Cents,
  ExpectedCharge,
  IsoDate,
  Movement,
  PaymentPlan,
  PocketId,
  StatementRecord,
} from "./types.ts";

/** Interest the balance will earn in `days` days, compounded daily. */
export function estimateYield(
  balance: Cents,
  annualRate: number,
  days: number,
): Cents {
  if (balance <= 0 || days <= 0) return 0;
  return Math.round(balance * (dailyGrowth(annualRate, days) - 1));
}

/**
 * Interest earned inside a month: what the cajita grew on its own, plus the corrections
 * the user made when comparing with Nu. `asOf` cuts the current month at today.
 */
export function getYieldEarnedInMonth(
  movements: Movement[],
  annualRate: number,
  key: string,
  asOf: IsoDate,
): Cents {
  const monthStart = `${key}-01`;
  const end = endOfMonth(monthStart) < asOf ? endOfMonth(monthStart) : asOf;
  const before = addDays(monthStart, -1);

  const interestUntil = (date: IsoDate): number =>
    getLedgerBalances(movements, date, annualRate).cajita -
    getLedgerBalances(movements, date).cajita;

  const grown = end < monthStart ? 0 : interestUntil(end) - interestUntil(before);
  return grown + getYieldForMonth(movements, key);
}

export function getYieldForMonth(movements: Movement[], key: string): Cents {
  return movements
    .filter(
      (movement) =>
        movement.dataKind === "real" &&
        movement.type === "adjustment" &&
        movement.category === YIELD_CATEGORY &&
        monthKey(movement.date) === key,
    )
    .reduce(
      (total, movement) =>
        total + (movement.to === "cajita" ? movement.amount : -movement.amount),
      0,
    );
}

export interface PlanView {
  plan: PaymentPlan;
  reserved: Cents;
  /** How much of the amount to pay still has no money reserved for it. */
  unassigned: Cents;
  /** A reserved source that is bigger than what its pocket holds right now. */
  cajitaShort: Cents;
  cashShort: Cents;
  plannedDate: IsoDate;
  daysUntilPayment: number;
}

export interface Dashboard {
  today: IsoDate;
  balances: Record<PocketId, Cents>;
  realMoney: Cents;
  debt: Cents;
  /** Real money plus what mom owes, minus the card debt. */
  free: Cents;
  /** Card debt not yet covered by real money. Mom's loan doesn't pay the card until it comes back. */
  toCoverDebt: Cents;
  /** The same, counting the expected charges of this month. */
  expectedThisPeriod: Cents;
  upcomingCharges: ExpectedCharge[];
  creditLeft: Cents;
  card: CardStatus;
  /** Amount owed by the due date, including expected charges that will enter this cut. */
  projectedDue: Cents;
  plan: PlanView;
  estimatedYield: Cents;
  cajitaOnPaymentDay: Cents;
  yieldThisMonth: Cents;
  intervalReminders: IntervalReminder[];
}

function buildPlanView(
  plan: PaymentPlan,
  balances: Record<PocketId, Cents>,
  projectedDue: Cents,
  dueDate: IsoDate,
  today: IsoDate,
): PlanView {
  const reserved = plan.fromCajita + plan.fromCash + plan.momGift;
  const plannedDate = plan.plannedDate ?? addDays(dueDate, -1);

  return {
    plan,
    reserved,
    unassigned: Math.max(0, projectedDue - reserved),
    cajitaShort: Math.max(0, plan.fromCajita - balances.cajita),
    cashShort: Math.max(0, plan.fromCash - balances.efectivo),
    plannedDate,
    daysUntilPayment: Math.max(0, daysBetween(today, plannedDate)),
  };
}

export function buildDashboard(data: AppData, today: IsoDate): Dashboard {
  const { movements, settings, statements, expectedCharges } = data;
  const balances = getLedgerBalances(movements, today, settings.annualYieldRate);

  const realMoney = balances.cajita + balances.banorte + balances.efectivo;
  const debt = 0 - balances.tarjetaNu;
  // Reserved money is deliberately not subtracted: the debt it will pay is already counted.
  const free = realMoney + balances.porCobrarMama - debt;
  const toCoverDebt = Math.max(0, debt - realMoney);

  const pending = expectedCharges.filter(
    (charge) => charge.status === "expected",
  );
  // Charges follow the card's periods (cut to cut), not calendar months: only those up to
  // the next cut show, plus any older one still unconfirmed. The rest appears after the cut.
  const periodCut = getCutForDate(today, settings);
  const upcomingCharges = pending
    .filter((charge) => getCutForDate(charge.date, settings) <= periodCut)
    .sort((a, b) => a.date.localeCompare(b.date));
  const expectedThisPeriod = upcomingCharges.reduce(
    (total, charge) => total + charge.amount,
    0,
  );

  const card = getCardStatus(movements, statements, settings, today);

  // Only charges that land before the cut are paid on the card's next due date.
  const expectedInThisCut =
    card.phase === "open"
      ? upcomingCharges
          .filter((charge) => getCutForDate(charge.date, settings) <= card.cutDate)
          .reduce((total, charge) => total + charge.amount, 0)
      : 0;

  const projectedDue = card.remaining + expectedInThisCut;
  const plan = buildPlanView(
    data.paymentPlan,
    balances,
    projectedDue,
    card.dueDate,
    today,
  );
  const estimatedYield = estimateYield(
    balances.cajita,
    settings.annualYieldRate,
    plan.daysUntilPayment,
  );

  return {
    today,
    balances,
    realMoney,
    debt,
    free,
    toCoverDebt,
    expectedThisPeriod,
    upcomingCharges,
    creditLeft: settings.cardLimit - debt,
    card,
    projectedDue,
    plan,
    estimatedYield,
    cajitaOnPaymentDay: balances.cajita + estimatedYield,
    yieldThisMonth: getYieldEarnedInMonth(
      movements,
      settings.annualYieldRate,
      monthKey(today),
      today,
    ),
    intervalReminders: getIntervalReminders(data.fixedExpenses, today),
  };
}

export interface CategoryComparison {
  category: string;
  thisMonth: Cents;
  lastMonth: Cents;
}

export interface MonthlySummary {
  thisMonthKey: string;
  lastMonthKey: string;
  categories: CategoryComparison[];
  incomeThisMonth: Cents;
  incomeLastMonth: Cents;
  outflowThisMonth: Cents;
  outflowLastMonth: Cents;
  yieldThisMonth: Cents;
  yieldLastMonth: Cents;
  paidByMomThisMonth: Cents;
  recentStatements: StatementRecord[];
  cardLimit: Cents;
}

function isSpending(movement: Movement): boolean {
  return movement.type === "expense" || movement.type === "cardExpense";
}

export function buildMonthlySummary(
  data: AppData,
  today: IsoDate,
): MonthlySummary {
  const thisMonthKey = monthKey(today);
  const lastMonthKey = previousMonthKey(today);
  // Rows older than an opening balance still count here: only saldos ignore them.
  const realMovements = data.movements.filter(
    (movement) => movement.dataKind !== "dummy" && movement.date <= today,
  );

  const byCategory = new Map<string, CategoryComparison>();
  let incomeThisMonth = 0;
  let incomeLastMonth = 0;
  let outflowThisMonth = 0;
  let outflowLastMonth = 0;
  let paidByMomThisMonth = 0;

  for (const movement of realMovements) {
    const key = monthKey(movement.date);
    const isThisMonth = key === thisMonthKey;
    if (!isThisMonth && key !== lastMonthKey) continue;

    if (movement.type === "income") {
      if (isThisMonth) incomeThisMonth += movement.amount;
      else incomeLastMonth += movement.amount;
    }

    if (!isSpending(movement)) continue;

    const category = movement.category ?? "otros";
    const row = byCategory.get(category) ?? {
      category,
      thisMonth: 0,
      lastMonth: 0,
    };
    if (isThisMonth) row.thisMonth += movement.amount;
    else row.lastMonth += movement.amount;
    byCategory.set(category, row);

    if (movement.from === "mama") {
      // Counts toward what the category cost, but it never left the user's money.
      if (isThisMonth) paidByMomThisMonth += movement.amount;
    } else if (isThisMonth) {
      outflowThisMonth += movement.amount;
    } else {
      outflowLastMonth += movement.amount;
    }
  }

  return {
    thisMonthKey,
    lastMonthKey,
    categories: [...byCategory.values()].sort(
      (a, b) => b.thisMonth - a.thisMonth || b.lastMonth - a.lastMonth,
    ),
    incomeThisMonth,
    incomeLastMonth,
    outflowThisMonth,
    outflowLastMonth,
    yieldThisMonth: getYieldEarnedInMonth(
      realMovements,
      data.settings.annualYieldRate,
      thisMonthKey,
      today,
    ),
    yieldLastMonth: getYieldEarnedInMonth(
      realMovements,
      data.settings.annualYieldRate,
      lastMonthKey,
      today,
    ),
    paidByMomThisMonth,
    recentStatements: getRecentStatements(
      data.movements,
      data.statements,
      data.settings,
      today,
      2,
    ),
    cardLimit: data.settings.cardLimit,
  };
}
