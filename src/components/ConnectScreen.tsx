"use client";

import { signIn } from "next-auth/react";

/** First time on a device: the data lives in the Sheet, so the first step is to connect Google. */
export function ConnectScreen() {
  return (
    <section className="card items-center gap-4 py-8 text-center">
      <h1 className="text-xl font-semibold">Trae tus datos</h1>
      <p className="text-ink-soft">
        Tus gastos viven en tu Google Sheets. Conecta tu cuenta y llegan solos a este
        dispositivo.
      </p>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => void signIn("google", { redirectTo: "/" })}
      >
        Conectar con Google
      </button>
    </section>
  );
}
