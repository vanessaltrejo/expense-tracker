"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import { forgetCachedUser } from "@/services/currentUser";
import { useFinance } from "../FinanceProvider";
import { SyncCard } from "../sync/SyncCard";
import { Avatar } from "./Avatar";
import { BackupCard } from "./BackupCard";

async function leave() {
  forgetCachedUser();
  await signOut({ redirect: false });
  // A full reload clears everything this person had in memory and shows the login.
  window.location.reload();
}

export function ProfileScreen() {
  const { user, canEdit } = useFinance();

  return (
    <>
      <h1 className="px-1 text-2xl font-semibold">Perfil</h1>

      <section className="card items-center gap-3 py-6 text-center">
        <Avatar name={user.name} tone={user.tone} size={88} />
        <p className="text-xl font-semibold">{user.name}</p>
        {canEdit ? null : <span className="pill bg-muted-soft text-ink-soft">Solo lectura</span>}
      </section>

      <SyncCard />
      {canEdit ? <BackupCard /> : null}

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

      <button
        type="button"
        className="btn-secondary min-h-12 text-danger"
        onClick={() => void leave()}
      >
        Cerrar sesión
      </button>
    </>
  );
}
