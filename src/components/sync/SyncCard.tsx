"use client";

import { signIn, signOut } from "next-auth/react";

import { useFinance } from "../FinanceProvider";
import { SHEET_URL } from "./sheetUrl";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** Where the user connects Google, sees the last sync and any rows with mistakes. */
export function SyncCard() {
  const { syncState, syncNow } = useFinance();

  return (
    <section id="cuenta" className="card">
      <h2 className="card-title">Tu Google Sheets</h2>

      {syncState.status === "synced" ? (
        <>
          <p className="text-sm">
            <span className="pill bg-good-soft text-good">Conectado</span>{" "}
            <span className="text-ink-soft">
              {syncState.email} · sincronizado a las {formatTime(syncState.at)}
            </span>
          </p>
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
          Conecta tu cuenta de Google para que todo se guarde en tu Sheets y lo veas en
          cualquier dispositivo.
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

      <div className="grid grid-cols-2 gap-2">
        {syncState.status === "signedOut" ? (
          <button
            type="button"
            className="btn-primary col-span-2"
            onClick={() => void signIn("google", { redirectTo: "/resumen" })}
          >
            Conectar con Google
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary min-h-12"
              disabled={syncState.status === "syncing"}
              onClick={() => void syncNow()}
            >
              Sincronizar ahora
            </button>
            <a href={SHEET_URL} target="_blank" rel="noreferrer" className="btn-secondary min-h-12">
              Abrir el Sheets
            </a>
          </>
        )}
      </div>

      {syncState.status === "synced" ? (
        <button
          type="button"
          className="min-h-11 text-sm text-ink-soft underline underline-offset-2"
          onClick={() => void signOut({ redirectTo: "/resumen" })}
        >
          Cerrar sesión de Google
        </button>
      ) : null}
    </section>
  );
}
