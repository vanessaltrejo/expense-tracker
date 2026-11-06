import { type CardStatus, getCardStatus, getCutForDate } from "./billing.ts";
import { addDays, daysBetween } from "./dates.ts";
import { dailyGrowth, getLedgerBalances, YIELD_CATEGORY } from "./ledger.ts";
import { getPeriodForDate, isInPeriod, type Period } from "./periods.ts";
import type {
  AppData,
  Cents,
  ExpectedCharge,
  IsoDate,
  Movement,
  PaymentPlan,
  PocketId,
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
 * Interest earned between two dates: what the cajita grew on its own, plus the corrections
 * the user made when comparing with Nu. The range is cut at `asOf`, so today ends it early.
 */
export function getYieldEarnedBetween(
  movements: Movement[],
  annualRate: number,
  start: IsoDate,
  end: IsoDate,
  asOf: IsoDate,
): Cents {
  const last = end < asOf ? end : asOf;
  if (last < start) return 0;

  const interestUntil = (date: IsoDate): number =>
    getLedgerBalances(movements, date, annualRate).cajita -
    getLedgerBalances(movements, date).cajita;

  const grown = interestUntil(last) - interestUntil(addDays(start, -1));
  return grown + getYieldCorrections(movements, start, last);
}

function getYieldCorrections(movements: Movement[], start: IsoDate, end: IsoDate): Cents {
  return movements
    .filter(
      (movement) =>
        movement.dataKind === "real" &&
        movement.type === "adjustment" &&
        movement.category === YIELD_CATEGORY &&
        movement.date >= start &&
        movement.date <= end,
    )
    .reduce(
      (total, movement) =>
        total + (movement.to === "cajita" ? movement.amount : -movement.amount),
      0,
    );
}

export interface PlanView {
  plannedDate: IsoDate;
  daysUntilPayment: number;
}

export interface Dashboard {
  today: IsoDate;
  /** The card period that contains today. */
  period: Period;
  balances: Record<PocketId, Cents>;
  realMoney: Cents;
  debt: Cents;
  /** Real money plus what mom owes, minus the card debt. */
  free: Cents;
  /** Card debt not yet covered by real money. Mom's loan doesn't pay the card until it comes back. */
  toCoverDebt: Cents;
  upcomingCharges: ExpectedCharge[];
  creditLeft: Cents;
  card: CardStatus;
  /** Amount owed by the due date, including expected charges that will enter this cut. */
  projectedDue: Cents;
  plan: PlanView;
  estimatedYield: Cents;
  cajitaOnPaymentDay: Cents;
  yieldThisPeriod: Cents;
}

function buildPlanView(plan: PaymentPlan, dueDate: IsoDate, today: IsoDate): PlanView {
  const plannedDate = plan.plannedDate ?? addDays(dueDate, -1);
  return { plannedDate, daysUntilPayment: Math.max(0, daysBetween(today, plannedDate)) };
}

export function buildDashboard(data: AppData, today: IsoDate): Dashboard {
  const { movements, settings, statements, expectedCharges } = data;
  const period = getPeriodForDate(today, settings);
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

  const card = getCardStatus(movements, statements, settings, today);

  // Only charges that land before the cut are paid on the card's next due date.
  const expectedInThisCut =
    card.phase === "open"
      ? upcomingCharges
          .filter((charge) => getCutForDate(charge.date, settings) <= card.cutDate)
          .reduce((total, charge) => total + charge.amount, 0)
      : 0;

  const projectedDue = card.remaining + expectedInThisCut;
  const plan = buildPlanView(data.paymentPlan, card.dueDate, today);
  const estimatedYield = estimateYield(
    balances.cajita,
    settings.annualYieldRate,
    plan.daysUntilPayment,
  );

  return {
    today,
    period,
    balances,
    realMoney,
    debt,
    free,
    toCoverDebt,
    upcomingCharges,
    creditLeft: settings.cardLimit - debt,
    card,
    projectedDue,
    plan,
    estimatedYield,
    cajitaOnPaymentDay: balances.cajita + estimatedYield,
    yieldThisPeriod: getYieldEarnedBetween(
      movements,
      settings.annualYieldRate,
      period.start,
      period.end,
      today,
    ),
  };
}

export interface CategoryShare {
  category: string;
  amount: Cents;
  /** Fraction of everything spent in the period, from 0 to 1. */
  share: number;
}

export interface PeriodSummary {
  period: Period;
  /** Everything the period cost. */
  totalSpent: Cents;
  income: Cents;
  expenseCount: number;
  categories: CategoryShare[];
  /** The biggest single expenses, largest first. */
  largest: Movement[];
}

const LARGEST_COUNT = 3;

function isSpending(movement: Movement): boolean {
  return movement.type === "expense" || movement.type === "cardExpense";
}

export function buildPeriodSummary(data: AppData, today: IsoDate): PeriodSummary {
  const period = getPeriodForDate(today, data.settings);
  // Rows older than an opening balance still count here: only balances ignore them.
  const inPeriod = data.movements.filter(
    (movement) =>
      movement.dataKind !== "dummy" &&
      movement.date <= today &&
      isInPeriod(movement.date, period),
  );

  const spending = inPeriod.filter(isSpending);
  const byCategory = new Map<string, Cents>();
  let totalSpent = 0;

  for (const movement of spending) {
    const category = movement.category ?? "otros";
    byCategory.set(category, (byCategory.get(category) ?? 0) + movement.amount);
    totalSpent += movement.amount;
  }

  return {
    period,
    totalSpent,
    income: inPeriod
      .filter((movement) => movement.type === "income")
      .reduce((total, movement) => total + movement.amount, 0),
    expenseCount: spending.length,
    categories: [...byCategory.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        share: totalSpent > 0 ? amount / totalSpent : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    largest: [...spending].sort((a, b) => b.amount - a.amount).slice(0, LARGEST_COUNT),
  };
}
