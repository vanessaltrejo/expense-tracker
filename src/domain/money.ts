import type { Cents } from "./types.ts";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function pesos(amount: number): Cents {
  return Math.round(amount * 100);
}

export function formatMoney(amount: Cents): string {
  return currencyFormatter.format(amount / 100);
}

/** An amount as it is typed into a field: 14399 becomes "143.99". */
export function centsToInput(amount: Cents): string {
  return (amount / 100).toFixed(2);
}

/** Reads what a person types ("1,000.50", "$99") and returns null if it is not an amount. */
export function parseMoneyInput(rawValue: string): Cents | null {
  const cleaned = rawValue.replace(/[\s$,]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}
