import { pesos } from "@/domain/money";
import type { PaymentPlan, Settings } from "@/domain/types";

/**
 * Defaults for a device that hasn't synced yet. Real data (fixed expenses, shortcuts,
 * card statements) only comes from each person's Google Sheet, never from the code.
 */

export const seedSettings: Settings = {
  cardLimit: pesos(40_000),
  cutDay: 22,
  dueDay: 1,
  annualYieldRate: 0.13,
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
  places: [],
  placeCategories: [],
};

/** Category for something to review later. The app reminds about these on Home. */
export const PENDING_CATEGORY = "pendiente";

export const emptyPaymentPlan: PaymentPlan = { plannedDate: null };
