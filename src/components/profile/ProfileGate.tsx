"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useSyncExternalStore } from "react";

import { getProfileById } from "@/domain/appProfiles";
import {
  getActiveProfileId,
  subscribeToActiveProfile,
} from "@/services/activeProfile";
import { AppShell } from "../AppShell";
import { FinanceProvider } from "../FinanceProvider";
import { EmptyProfileScreen } from "./EmptyProfileScreen";
import { ProfilePicker } from "./ProfilePicker";

/** Public pages: Google and anyone else must be able to read them without choosing a profile. */
const PUBLIC_PATHS = ["/privacidad", "/terminos"];

// On the server nobody has chosen yet, so the first paint is empty and the real answer
// arrives once the page runs in the browser.
const getServerSnapshot = (): string | null | undefined => undefined;

/**
 * Decides what to show: the picker, a profile with no data, or the full app for the owner.
 * The app (and its data loading and syncing) only starts for the owner.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeId = useSyncExternalStore(
    subscribeToActiveProfile,
    getActiveProfileId,
    getServerSnapshot,
  );

  if (PUBLIC_PATHS.includes(pathname)) {
    return (
      <div
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
        }}
      >
        <Link href="/" className="text-sm font-medium text-accent">
          ← Volver
        </Link>
        {children}
      </div>
    );
  }

  if (activeId === undefined) {
    return <div className="min-h-dvh" aria-hidden="true" />;
  }

  const profile = getProfileById(activeId);
  if (!profile) return <ProfilePicker />;
  if (profile.role !== "owner") return <EmptyProfileScreen profile={profile} />;

  return (
    <FinanceProvider>
      <AppShell>{children}</AppShell>
    </FinanceProvider>
  );
}
