import type { Metadata } from "next";

import { FinanceGate } from "@/components/FinanceGate";
import { SummaryScreen } from "@/components/summary/SummaryScreen";

// The app only draws these pages after someone signs in, which is checked in the
// browser, so the server can't prove the page navigates instantly. Opting out keeps the
// dev warning quiet; it does not change how the page works.
export const instant = false;

export const metadata: Metadata = { title: "Resumen" };

export default function SummaryPage() {
  return (
    <FinanceGate>
      <SummaryScreen />
    </FinanceGate>
  );
}
