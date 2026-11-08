"use client";

import Link from "next/link";

import { useOptionalFinance } from "../FinanceProvider";

/** A thin line at the top, only when something needs attention. */
export function SyncBanner() {
  const finance = useOptionalFinance();
  const state = finance?.syncState;
  if (!state) return null;

  let message: string | null = null;
  if (state.status === "signedOut") message = "Tu sesión terminó, vuelve a entrar";
  if (state.status === "notConfigured") message = "Tu Sheets todavía no está listo";
  if (state.status === "offline" && state.pending > 0) {
    message = `Sin internet · ${state.pending} ${state.pending === 1 ? "cambio" : "cambios"} por subir`;
  }
  if (state.status === "layoutError") message = "Falta una columna en tu Sheets";
  if (state.status === "error") message = "No se pudo sincronizar con tu Sheets";
  if (!message) return null;

  return (
    <Link
      href="/perfil#cuenta"
      className="block bg-warning-soft px-4 py-2 text-center text-xs font-semibold text-warning"
    >
      {message} ›
    </Link>
  );
}
