"use client";

import type { ReactNode } from "react";

import { getOpeningDates } from "@/domain/ledger";
import { useLoadState, useOptionalFinance } from "./FinanceProvider";
import { SetupScreen } from "./setup/SetupScreen";

/**
 * Lives inside each page, so the navigation renders right away and is never held back
 * by data that only exists on the device. Shows the setup until there are real balances.
 */
export function FinanceGate({ children }: { children: ReactNode }) {
  const finance = useOptionalFinance();
  const { loadFailed, retry } = useLoadState();

  if (finance) {
    const hasOpeningBalances =
      Object.keys(getOpeningDates(finance.data.movements)).length > 0;
    return hasOpeningBalances ? children : <SetupScreen />;
  }

  if (loadFailed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-ink-soft">No pude cargar tus datos.</p>
        <button type="button" className="btn-primary" onClick={() => void retry()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center text-ink-soft" role="status">
      Cargando…
    </div>
  );
}
