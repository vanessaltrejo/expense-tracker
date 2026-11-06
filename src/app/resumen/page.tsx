import type { Metadata } from "next";

import { FinanceGate } from "@/components/FinanceGate";
import { SummaryScreen } from "@/components/summary/SummaryScreen";

export const metadata: Metadata = { title: "Resumen" };

export default function SummaryPage() {
  return (
    <FinanceGate>
      <SummaryScreen />
    </FinanceGate>
  );
}
