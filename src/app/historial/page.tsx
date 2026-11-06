import type { Metadata } from "next";

import { FinanceGate } from "@/components/FinanceGate";
import { HistoryScreen } from "@/components/history/HistoryScreen";

export const metadata: Metadata = { title: "Historial" };

export default function HistoryPage() {
  return (
    <FinanceGate>
      <HistoryScreen />
    </FinanceGate>
  );
}
