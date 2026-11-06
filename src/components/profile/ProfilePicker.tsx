"use client";

import Link from "next/link";

import { APP_PROFILES } from "@/domain/appProfiles";
import { setActiveProfileId } from "@/services/activeProfile";
import { Avatar } from "./Avatar";

/** The first screen: who is using Pockets? */
export function ProfilePicker() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-10 px-6"
      style={{
        paddingTop: "calc(2rem + env(safe-area-inset-top))",
        paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
      }}
    >
      <h1 className="whitespace-nowrap text-center text-[clamp(1.05rem,5.6vw,1.5rem)] font-semibold">
        ¿Quién está usando Pockets?
      </h1>

      {/* Always one row: three equal columns that shrink with the screen. */}
      <ul className="grid w-full grid-cols-3 gap-3">
        {APP_PROFILES.map((profile) => (
          <li key={profile.id} className="min-w-0">
            <button
              type="button"
              className="flex min-h-11 w-full flex-col items-center gap-3 active:opacity-70"
              onClick={() => setActiveProfileId(profile.id)}
            >
              <Avatar
                name={profile.name}
                initials={profile.initials}
                tone={profile.tone}
                size={104}
                fluid
              />
              <span className="w-full truncate text-center text-base font-medium">
                {profile.name}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="flex gap-4 text-xs text-ink-soft">
        <Link href="/privacidad" className="underline underline-offset-2">
          Privacidad
        </Link>
        <Link href="/terminos" className="underline underline-offset-2">
          Términos
        </Link>
      </p>
    </main>
  );
}
