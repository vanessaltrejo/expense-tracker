"use client";

import { useFinance } from "../FinanceProvider";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** The last sync, any rows with mistakes, and (for owners) a link to the Sheet. */
export function SyncCard() {
  const { syncState, syncNow, canEdit } = useFinance();
  // Only owners receive the link from the server; the read-only view never gets it.
  const sheetUrl = syncState.status === "synced" ? syncState.sheetUrl : null;

  return (
    <section id="cuenta" className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="card-title">{canEdit ? "Tu Google Sheets" : "Google Sheets"}</h2>
        {syncState.status === "synced" ? (
          <p className="text-xs text-ink-soft">Sincronizado a las {formatTime(syncState.at)}</p>
        ) : null}
      </div>

      {syncState.status === "synced" ? (
        <>
          {syncState.issues.length > 0 ? (
            <div className="rounded-xl bg-danger-soft p-3 text-sm">
              <p className="font-semibold text-danger">
                {syncState.issues.length === 1
                  ? "1 fila del Sheets tiene un error y no se cuenta"
                  : `${syncState.issues.length} filas del Sheets tienen errores y no se cuentan`}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-ink-soft">
                {syncState.issues.slice(0, 5).map((issue) => (
                  <li key={`${issue.tab}-${issue.row}`}>
                    {issue.tab}, fila {issue.row}: {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {syncState.status === "syncing" || syncState.status === "idle" ? (
        <p className="text-sm text-ink-soft">Sincronizando…</p>
      ) : null}

      {syncState.status === "signedOut" ? (
        <p className="text-sm text-ink-soft">
          Tu sesión terminó. Cierra sesión y vuelve a entrar para seguir sincronizando.
        </p>
      ) : null}

      {syncState.status === "notConfigured" ? (
        <p className="text-sm text-ink-soft">
          {canEdit
            ? "Tu Sheets todavía no está listo. Lo que registres se queda guardado aquí."
            : "Todavía no hay información para ver."}
        </p>
      ) : null}

      {syncState.status === "offline" || syncState.status === "error" ? (
        <p className="text-sm text-ink-soft">
          {syncState.status === "offline"
            ? "Sin internet. Todo está guardado en este dispositivo."
            : "No se pudo hablar con tu Sheets. Tus datos siguen guardados aquí."}
          {syncState.pending > 0
            ? ` ${syncState.pending} ${syncState.pending === 1 ? "cambio espera" : "cambios esperan"} para subirse.`
            : ""}
        </p>
      ) : null}

      <div className={`grid gap-2 ${sheetUrl ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          className="btn-secondary min-h-12"
          disabled={syncState.status === "syncing"}
          onClick={() => void syncNow()}
        >
          Sincronizar ahora
        </button>
        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn-secondary min-h-12">
            Abrir el Sheets
          </a>
        ) : null}
      </div>
    </section>
  );
}
