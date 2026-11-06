import type { RowIssue } from "@/domain/sheetMapping";
import type { SyncOp } from "@/domain/syncOps";
import type { AppData } from "@/domain/types";
import { getFinanceRepository } from "./financeRepository";

export type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "synced"; at: string; email: string; name: string; issues: RowIssue[] }
  | { status: "offline"; pending: number }
  | { status: "signedOut"; pending: number }
  | { status: "error"; pending: number };

interface SyncResponse {
  data: AppData;
  issues: RowIssue[];
  email: string;
  name: string;
}

function isSyncResponse(value: unknown): value is SyncResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "issues" in value &&
    "email" in value &&
    "name" in value
  );
}

let inFlight: Promise<SyncState> | null = null;

async function runSync(): Promise<SyncState> {
  const repository = getFinanceRepository();
  const pending = await repository.pendingOps();

  // The first time this device connects, its own movements go up before the sheet wins.
  const { linkedAt } = await repository.getSyncInfo();
  const ops: SyncOp[] = pending.map((item) => item.op);
  if (!linkedAt) {
    const local = await repository.load();
    ops.unshift({ kind: "upsertMovements", movements: local.movements });
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { status: "offline", pending: pending.length };
  }

  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
    });
  } catch {
    return { status: "offline", pending: pending.length };
  }

  if (response.status === 401) return { status: "signedOut", pending: pending.length };
  if (!response.ok) return { status: "error", pending: pending.length };

  const body: unknown = await response.json();
  if (!isSyncResponse(body)) return { status: "error", pending: pending.length };

  await repository.replaceWithSheet(
    body.data,
    pending.map((item) => item.seq),
  );
  await repository.saveProfile({ name: body.name, email: body.email });

  return {
    status: "synced",
    at: new Date().toISOString(),
    email: body.email,
    name: body.name,
    issues: body.issues,
  };
}

/** Sends pending changes and pulls the sheet. Calls made while one runs share its result. */
export function syncWithSheet(): Promise<SyncState> {
  inFlight ??= runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
