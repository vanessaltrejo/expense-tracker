"use client";

import type { ReactNode } from "react";

import { useLoadState, useOptionalFinance } from "./FinanceProvider";

/**
 * Lives inside each page, so the navigation renders right away and is never held back
 * by data that only exists on the device.
 */
export function FinanceGate({
  children,
  allowEmpty = false,
}: {
  children: ReactNode;
  /** Perfil opens even without data, so there is always a way to sync or sign out. */
  allowEmpty?: boolean;
}) {
  const finance = useOptionalFinance();
  const { loadFailed, retry } = useLoadState();

  if (finance) {
    const hasNoData = !allowEmpty && finance.data.movements.length === 0;
    if (hasNoData && finance.syncState.status === "notConfigured") return <NotReadyMessage />;
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

function NotReadyMessage() {
  return (
    <section className="card items-center gap-2 py-8 text-center">
      <h1 className="text-xl font-semibold">Tu espacio todavía no está listo</h1>
      <p className="text-ink-soft">
        Falta conectar tu Google Sheets con la app. En cuanto esté, tus datos aparecen aquí.
      </p>
    </section>
  );
}

function LoadingMessage() {
  return (
    <div className="flex flex-1 items-center justify-center text-ink-soft" role="status">
      Cargando…
    </div>
  );
}
