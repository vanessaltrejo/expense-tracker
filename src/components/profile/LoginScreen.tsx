"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

import { PocketsMark } from "../brand/PocketsMark";

/** Username and password. The password goes straight to the server and is never stored. */
export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "wrong" | "failed">("idle");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setStatus("sending");
    try {
      const result = await signIn("credentials", { username, password, redirect: false });
      if (result?.error) {
        setStatus("wrong");
        setPassword("");
        return;
      }
      setPassword("");
      onSignedIn();
    } catch {
      setStatus("failed");
    }
  };

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6"
      style={{
        paddingTop: "calc(2rem + env(safe-area-inset-top))",
        paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {/* The icon fills its box, so the box sets its size and rounds it like an app icon. */}
        <div className="size-18 overflow-hidden rounded-2xl shadow-md">
          <PocketsMark size={72} />
        </div>
        <h1 className="text-2xl font-semibold">Entra a Pockets</h1>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="card gap-4">
        <label className="field-label">
          Usuario
          <input
            className="field"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field-label">
          Contraseña
          <input
            className="field"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {status === "wrong" ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            El usuario o la contraseña no coinciden.
          </p>
        ) : null}
        {status === "failed" ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            No se pudo entrar. Revisa tu internet e intenta de nuevo.
          </p>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === "sending" || !username.trim() || !password}
        >
          {status === "sending" ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <nav className="flex justify-center gap-4 text-sm text-ink-soft">
        <Link href="/privacidad" className="underline underline-offset-2">
          Aviso de privacidad
        </Link>
        <Link href="/terminos" className="underline underline-offset-2">
          Términos de uso
        </Link>
      </nav>
    </main>
  );
}
