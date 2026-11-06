"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import { useFinance } from "../FinanceProvider";
import { SyncCard } from "../sync/SyncCard";
import { Avatar } from "./Avatar";
import { BackupCard } from "./BackupCard";

export function ProfileScreen() {
  const { profile, syncState } = useFinance();
  const isConnected = syncState.status === "synced";
  // The live session wins; the saved profile covers offline and signed-out moments.
  const name = isConnected ? syncState.name : (profile?.name ?? null);
  const email = isConnected ? syncState.email : (profile?.email ?? null);

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Perfil</h1>

      <section className="card items-center gap-3 py-6 text-center">
        <Avatar name={name ?? "?"} size={88} />
        <div className="min-w-0">
          <p className="text-xl font-semibold">{name ?? "Tu perfil"}</p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {email ?? "Conecta tu Google para ver tu nombre y tu correo."}
          </p>
        </div>
        {isConnected ? (
          <span className="pill bg-good-soft text-good">Conectado con Google</span>
        ) : null}
      </section>

      <SyncCard />
      <BackupCard />

      <section className="card gap-0 py-1">
        <Link
          href="/privacidad"
          className="flex min-h-12 items-center justify-between border-b border-line"
        >
          Aviso de privacidad
          <span aria-hidden="true" className="text-ink-soft">
            ›
          </span>
        </Link>
        <Link href="/terminos" className="flex min-h-12 items-center justify-between">
          Términos de uso
          <span aria-hidden="true" className="text-ink-soft">
            ›
          </span>
        </Link>
      </section>

      {isConnected ? (
        <button
          type="button"
          className="btn-secondary min-h-12 text-danger"
          onClick={() => void signOut({ redirectTo: "/perfil" })}
        >
          Cerrar sesión
        </button>
      ) : null}
    </>
  );
}
