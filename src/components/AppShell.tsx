"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useOptionalFinance } from "./FinanceProvider";
import { SyncBanner } from "./sync/SyncBanner";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const leftItems: NavItem[] = [
  {
    href: "/",
    label: "Inicio",
    icon: (
      <NavIcon>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </NavIcon>
    ),
  },
  {
    href: "/historial",
    label: "Historial",
    icon: (
      <NavIcon>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M4 6h.01M4 12h.01M4 18h.01" />
      </NavIcon>
    ),
  },
];

const rightItems: NavItem[] = [
  {
    href: "/resumen",
    label: "Resumen",
    icon: (
      <NavIcon>
        <path d="M5 20V11M12 20V4M19 20v-6" />
      </NavIcon>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (
      <NavIcon>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c.8-3.6 3.4-5.5 7-5.5s6.2 1.9 7 5.5" />
      </NavIcon>
    ),
  },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
        active ? "text-accent" : "text-ink-soft"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function ToastBar() {
  const finance = useOptionalFinance();
  if (!finance?.toast) return null;
  const { toast, undoToast, dismissToast } = finance;

  return (
    <div
      role="status"
      className="fixed inset-x-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-surface shadow-lg"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <span className="min-w-0">{toast.message}</span>
      {toast.undo ? (
        <button
          type="button"
          className="-my-2 min-h-11 shrink-0 px-2 font-semibold underline underline-offset-2"
          onClick={() => void undoToast()}
        >
          Deshacer
        </button>
      ) : (
        <button
          type="button"
          className="-my-2 min-h-11 shrink-0 px-2 font-semibold"
          onClick={dismissToast}
        >
          OK
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div aria-hidden="true" style={{ height: "env(safe-area-inset-top)" }} />
      <SyncBanner />

      <main
        className="flex flex-1 flex-col gap-4 px-4 pt-5"
        style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      <ToastBar />

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-center px-2 py-1.5">
          {leftItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
          <Link
            href="/agregar"
            aria-label="Agregar movimiento"
            aria-current={pathname === "/agregar" ? "page" : undefined}
            className="mx-2 flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
          {rightItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </div>
      </nav>
    </div>
  );
}
