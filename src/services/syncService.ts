import type { RowIssue } from "@/domain/sheetMapping";
import { compactSyncOps, type SyncOp } from "@/domain/syncOps";
import type { AppData } from "@/domain/types";
import { getFinanceRepository } from "./financeRepository";

export type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "synced"; at: string; issues: RowIssue[]; sheetUrl: string | null }
  | { status: "offline"; pending: number }
  | { status: "signedOut"; pending: number }
  /** The person's Sheet isn't ready yet (not created or not shared with the app). */
  | { status: "notConfigured"; pending: number }
  /** A column the app needs is missing from a tab of the Sheet; `detail` says which. */
  | { status: "layoutError"; pending: number; detail: string }
  | { status: "error"; pending: number };

interface SyncResponse {
  data: AppData;
  issues: RowIssue[];
  sheetUrl: string | null;
}

function isSyncResponse(value: unknown): value is SyncResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "issues" in value &&
    "sheetUrl" in value
  );
}

let inFlight: Promise<SyncState> | null = null;

/** A read-only person never sends changes: they only receive the Sheet. */
async function runSync(canEdit: boolean): Promise<SyncState> {
  const repository = getFinanceRepository();
  const pending = canEdit ? await repository.pendingOps() : [];

  // The first time this device connects, its own movements go up before the sheet wins.
  const ops: SyncOp[] = pending.map((item) => item.op);
  if (canEdit) {
    const { linkedAt } = await repository.getSyncInfo();
    const local = linkedAt ? null : await repository.load();
    if (local && local.movements.length > 0) {
      ops.unshift({ kind: "upsertMovements", movements: local.movements });
    }
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { status: "offline", pending: pending.length };
  }

  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: compactSyncOps(ops) }),
    });
  } catch {
    return { status: "offline", pending: pending.length };
  }

  if (response.status === 401) return { status: "signedOut", pending: pending.length };
  if (response.status === 503) return { status: "notConfigured", pending: pending.length };
  if (response.status === 422) {
    const failure: unknown = await response.json().catch(() => null);
    const detail =
      typeof failure === "object" && failure !== null && "detail" in failure && typeof failure.detail === "string"
        ? failure.detail
        : "Falta una columna en tu Sheets";
    return { status: "layoutError", pending: pending.length, detail };
  }
  if (!response.ok) return { status: "error", pending: pending.length };

  const body: unknown = await response.json();
  if (!isSyncResponse(body)) return { status: "error", pending: pending.length };

  await repository.replaceWithSheet(
    body.data,
    pending.map((item) => item.seq),
  );

  return {
    status: "synced",
    at: new Date().toISOString(),
    issues: body.issues,
    sheetUrl: body.sheetUrl,
  };
}

/** How many more times to send what was changed while a request was already on its way. */
const MAX_EXTRA_PASSES = 3;

async function runSyncUntilEmpty(canEdit: boolean): Promise<SyncState> {
  let state = await runSync(canEdit);
  // A change made while a sync runs is not part of it and would wait in the outbox until
  // the next time the app opens, so a gasto added and deleted quickly could linger in the
  // Sheet. Send it right away.
  for (let pass = 0; pass < MAX_EXTRA_PASSES && canEdit && state.status === "synced"; pass++) {
    if ((await getFinanceRepository().pendingOps()).length === 0) break;
    state = await runSync(canEdit);
  }
  return state;
}

/** Sends pending changes and pulls the sheet. Calls made while one runs share its result. */
export function syncWithSheet(canEdit: boolean): Promise<SyncState> {
  inFlight ??= runSyncUntilEmpty(canEdit).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
