import type { MovementEndpoint, MovementType } from "@/domain/types";

/** Tailwind classes need full literal names, so every color combination is spelled out. */
export const POCKET_STYLES: Record<
  MovementEndpoint,
  { text: string; soft: string; bar: string }
> = {
  cajita: { text: "text-cajita", soft: "bg-cajita-soft", bar: "bg-cajita" },
  banorte: { text: "text-banorte", soft: "bg-banorte-soft", bar: "bg-banorte" },
  efectivo: { text: "text-efectivo", soft: "bg-efectivo-soft", bar: "bg-efectivo" },
  porCobrarMama: { text: "text-cobrar", soft: "bg-cobrar-soft", bar: "bg-cobrar" },
  tarjetaNu: { text: "text-tarjeta", soft: "bg-tarjeta-soft", bar: "bg-tarjeta" },
};

const CATEGORY_ICONS: Record<string, string> = {
  comida: "🍽️",
  salidas: "🎉",
  transporte: "🚗",
  escuela: "📚",
  antojos: "🍩",
  pareja: "💞",
  mamá: "👩",
  suscripciones: "🔁",
  otros: "📦",
  pendiente: "⏳",
  "no sé": "❓",
  "horno³": "💼",
  comedor: "🍲",
  Rendimiento: "📈",
  "Saldo inicial": "🏁",
};

/**
 * Categories are stored in lowercase ("antojos") so the sheet stays easy to type in,
 * and shown with a capital letter. A native dropdown can't style its text with CSS.
 */
export function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function getCategoryIcon(category: string | null): string {
  return (category && CATEGORY_ICONS[category]) ?? "•";
}

export const TYPE_STYLES: Record<
  MovementType,
  { label: string; icon: string; soft: string; text: string }
> = {
  income: { label: "Ingreso", icon: "↓", soft: "bg-good-soft", text: "text-good" },
  expense: { label: "Gasto", icon: "↑", soft: "bg-danger-soft", text: "text-danger" },
  cardExpense: {
    label: "Gasto con tarjeta",
    icon: "▭",
    soft: "bg-tarjeta-soft",
    text: "text-tarjeta",
  },
  transfer: { label: "Transferencia", icon: "⇄", soft: "bg-muted-soft", text: "text-ink-soft" },
  adjustment: { label: "Ajuste", icon: "≈", soft: "bg-cajita-soft", text: "text-cajita" },
};

export type ChargeTone = "expected" | "charged" | "skipped" | "overdue";

export const STATUS_STYLES: Record<ChargeTone, { label: string; classes: string }> = {
  expected: { label: "Esperado", classes: "bg-warning-soft text-warning" },
  charged: { label: "Cobrado", classes: "bg-good-soft text-good" },
  skipped: { label: "Omitido", classes: "bg-muted-soft text-ink-soft" },
  overdue: { label: "Atrasado", classes: "bg-danger-soft text-danger" },
};

/** Green while usage is low, amber in the middle, red when close to the limit. */
export function getUsageTone(percent: number): { bar: string; text: string } {
  if (percent >= 70) return { bar: "bg-danger", text: "text-danger" };
  if (percent >= 30) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-good", text: "text-good" };
}
