"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import type { SessionUser } from "@/domain/users";
import { fetchCurrentUser } from "@/services/currentUser";
import { AppShell } from "../AppShell";
import { FinanceProvider } from "../FinanceProvider";
import { LoginScreen } from "./LoginScreen";

/** Public pages: anyone must be able to read them without signing in. */
const PUBLIC_PATHS = ["/privacidad", "/terminos"];

/**
 * Asks the server who is signed in. Nobody: the login screen. Someone: the app, with
 * their own data and their own permissions.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // undefined while asking; null when nobody is signed in.
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const check = useCallback(async () => {
    setUser(await fetchCurrentUser());
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    return () => clearTimeout(first);
  }, [check]);

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

  if (user === undefined) return <div className="min-h-dvh" aria-hidden="true" />;
  if (user === null) return <LoginScreen onSignedIn={() => void check()} />;

  return (
    // The key starts a fresh app when a different person signs in on the same device.
    <FinanceProvider key={user.id} user={user}>
      <AppShell>{children}</AppShell>
    </FinanceProvider>
  );
}
