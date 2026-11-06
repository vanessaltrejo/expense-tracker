import type {
  ExpectedCharge,
  FixedExpense,
  Movement,
  PaymentPlan,
  Shortcut,
} from "./types.ts";

/** A change made in the app that still has to be written to the sheet. */
export type SyncOp =
  | { kind: "upsertMovements"; movements: Movement[] }
  | { kind: "deleteMovements"; ids: string[] }
  | { kind: "upsertExpectedCharges"; charges: ExpectedCharge[] }
  | { kind: "upsertFixedExpense"; expense: FixedExpense }
  | { kind: "upsertShortcut"; shortcut: Shortcut }
  | { kind: "deleteShortcut"; id: string }
  | { kind: "savePaymentPlan"; plan: PaymentPlan };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

function isDate(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMovement(value: unknown): value is Movement {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isDate(value.date) &&
    isString(value.type) &&
    isNumber(value.amount) &&
    isNullableString(value.from) &&
    isNullableString(value.to) &&
    isNullableString(value.category) &&
    isString(value.note) &&
    isString(value.dataKind)
  );
}

function isExpectedCharge(value: unknown): value is ExpectedCharge {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.fixedExpenseId) &&
    isString(value.name) &&
    isDate(value.date) &&
    isNumber(value.amount) &&
    isString(value.category) &&
    isString(value.status)
  );
}

function isFixedExpense(value: unknown): value is FixedExpense {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNumber(value.normalAmount) &&
    isRecord(value.schedule) &&
    isString(value.schedule.kind) &&
    isString(value.category) &&
    isDate(value.startDate) &&
    (value.endDate === null || isDate(value.endDate)) &&
    typeof value.active === "boolean"
  );
}

function isShortcut(value: unknown): value is Shortcut {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    (value.amount === null || isNumber(value.amount)) &&
    isString(value.category) &&
    isString(value.paidFrom) &&
    isNullableString(value.fixedExpenseId)
  );
}

function isPaymentPlan(value: unknown): value is PaymentPlan {
  return (
    isRecord(value) &&
    isNumber(value.fromCajita) &&
    isNumber(value.fromCash) &&
    isNumber(value.momGift) &&
    (value.plannedDate === null || isDate(value.plannedDate))
  );
}

/** The server receives these from the browser, so every field is checked before use. */
export function parseSyncOps(value: unknown): SyncOp[] | null {
  if (!Array.isArray(value)) return null;
  const ops: SyncOp[] = [];

  for (const item of value) {
    if (!isRecord(item)) return null;
    switch (item.kind) {
      case "upsertMovements":
        if (!Array.isArray(item.movements) || !item.movements.every(isMovement)) return null;
        ops.push({ kind: "upsertMovements", movements: item.movements });
        break;
      case "deleteMovements":
        if (!Array.isArray(item.ids) || !item.ids.every(isString)) return null;
        ops.push({ kind: "deleteMovements", ids: item.ids });
        break;
      case "upsertExpectedCharges":
        if (!Array.isArray(item.charges) || !item.charges.every(isExpectedCharge)) return null;
        ops.push({ kind: "upsertExpectedCharges", charges: item.charges });
        break;
      case "upsertFixedExpense":
        if (!isFixedExpense(item.expense)) return null;
        ops.push({ kind: "upsertFixedExpense", expense: item.expense });
        break;
      case "upsertShortcut":
        if (!isShortcut(item.shortcut)) return null;
        ops.push({ kind: "upsertShortcut", shortcut: item.shortcut });
        break;
      case "deleteShortcut":
        if (!isString(item.id)) return null;
        ops.push({ kind: "deleteShortcut", id: item.id });
        break;
      case "savePaymentPlan":
        if (!isPaymentPlan(item.plan)) return null;
        ops.push({ kind: "savePaymentPlan", plan: item.plan });
        break;
      default:
        return null;
    }
  }

  return ops;
}
