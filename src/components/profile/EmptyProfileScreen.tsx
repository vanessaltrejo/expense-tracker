"use client";

import type { AppProfile } from "@/domain/appProfiles";
import { setActiveProfileId } from "@/services/activeProfile";
import { Avatar } from "./Avatar";

const MESSAGES: Record<Exclude<AppProfile["role"], "owner">, string> = {
  viewer: "Aquí vas a ver la información de Vanessa, solo para consultar. Todavía no está habilitado.",
  own: "Este espacio todavía está vacío. Pronto lo dejamos listo para ti.",
};

/** A profile with no data yet: says so, and lets the person go back to the picker. */
export function EmptyProfileScreen({ profile }: { profile: AppProfile }) {
  const message = profile.role === "owner" ? "" : MESSAGES[profile.role];

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center"
      style={{
        paddingTop: "calc(2rem + env(safe-area-inset-top))",
        paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
      }}
    >
      <Avatar name={profile.name} initials={profile.initials} tone={profile.tone} size={96} />
      <div>
        <h1 className="text-2xl font-semibold">{profile.name}</h1>
        <p className="mt-2 text-ink-soft">{message}</p>
      </div>
      <button
        type="button"
        className="btn-secondary min-h-12 w-full"
        onClick={() => setActiveProfileId(null)}
      >
        Cambiar de perfil
      </button>
    </main>
  );
}
