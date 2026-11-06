"use client";

import type { ReactNode } from "react";

import { ConnectScreen } from "./ConnectScreen";
import { useLoadState, useOptionalFinance } from "./FinanceProvider";

/**
 * Lives inside each page, so the navigation renders right away and is never held back
 * by data that only exists on the device.
 */
export function FinanceGate({ children }: { children: ReactNode }) {
  const finance = useOptionalFinance();
  const { loadFailed, retry } = useLoadState();

  if (finance) {
    const hasNoData = finance.data.movements.length === 0;
    if (hasNoData && finance.syncState.status === "signedOut") return <ConnectScreen />;
    if (hasNoData && ["idle", "syncing"].includes(finance.syncState.status)) {
      return <LoadingMessage />;
    }
    return children;
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

  return <LoadingMessage />;
}

function LoadingMessage() {
  return (
    <div className="flex flex-1 items-center justify-center text-ink-soft" role="status">
      Cargando…
    </div>
  );
}
