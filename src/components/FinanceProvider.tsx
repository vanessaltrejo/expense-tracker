"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { buildDashboard, type Dashboard } from "@/domain/dashboard";
import { getTodayInMexico } from "@/domain/dates";
import type { AppData, IsoDate } from "@/domain/types";
import { loadFinanceData, type Undo } from "@/services/financeService";
import { type SyncState, syncWithSheet } from "@/services/syncService";

interface Toast {
  message: string;
  undo: Undo | null;
}

interface FinanceContextValue {
  data: AppData;
  today: IsoDate;
  dashboard: Dashboard;
  toast: Toast | null;
  /** Runs a change, reloads the data, and offers to undo it when `undo` comes back. */
  runAction: (
    message: string,
    action: () => Promise<Undo | null | void>,
  ) => Promise<void>;
  undoToast: () => Promise<void>;
  dismissToast: () => void;
  syncState: SyncState;
  syncNow: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);
const LoadStateContext = createContext<{
  loadFailed: boolean;
  retry: () => Promise<void>;
}>({ loadFailed: false, retry: async () => undefined });

const TOAST_DURATION_MS = 6_000;

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<{ data: AppData; today: IsoDate } | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });

  const refresh = useCallback(async () => {
    // "Today" comes from the device, so a server in another timezone can't change it.
    const today = getTodayInMexico();
    try {
      const data = await loadFinanceData(today);
      setLoaded({ data, today });
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  /** Sends pending changes to the sheet and shows what the sheet has now. */
  const syncNow = useCallback(async () => {
    setSyncState((current) =>
      current.status === "synced" ? current : { status: "syncing" },
    );
    const result = await syncWithSheet();
    setSyncState(result);
    if (result.status === "synced") await refresh();
  }, [refresh]);

  useEffect(() => {
    const initialLoad = setTimeout(async () => {
      await refresh();
      await syncNow();
    }, 0);

    // An installed PWA can stay open for days, so reload whenever the user comes back.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh().then(syncNow);
    };
    const handleOnline = () => void syncNow();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(initialLoad);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh, syncNow]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const runAction = useCallback<FinanceContextValue["runAction"]>(
    async (message, action) => {
      try {
        const undo = await action();
        await refresh();
        setToast({ message, undo: undo ?? null });
        void syncNow();
      } catch {
        setToast({ message: "No se pudo guardar. Intenta de nuevo.", undo: null });
      }
    },
    [refresh, syncNow],
  );

  const undoToast = useCallback(async () => {
    if (!toast?.undo) return;
    await toast.undo();
    setToast(null);
    await refresh();
    void syncNow();
  }, [toast, refresh, syncNow]);

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo<FinanceContextValue | null>(() => {
    if (!loaded) return null;
    return {
      data: loaded.data,
      today: loaded.today,
      dashboard: buildDashboard(loaded.data, loaded.today),
      toast,
      runAction,
      undoToast,
      dismissToast,
      syncState,
      syncNow,
    };
  }, [loaded, toast, runAction, undoToast, dismissToast, syncState, syncNow]);

  const loadState = useMemo(
    () => ({ loadFailed, retry: refresh }),
    [loadFailed, refresh],
  );

  return (
    <LoadStateContext.Provider value={loadState}>
      <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
    </LoadStateContext.Provider>
  );
}

/** Loading and retry state, for the gate that each page renders. */
export function useLoadState(): { loadFailed: boolean; retry: () => Promise<void> } {
  return useContext(LoadStateContext);
}

/** For parts of the app that also render before the data has loaded. */
export function useOptionalFinance(): FinanceContextValue | null {
  return useContext(FinanceContext);
}

export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (!value) {
    throw new Error("useFinance must be used inside FinanceProvider");
  }
  return value;
}
