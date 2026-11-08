import { parseSyncOps } from "@/domain/syncOps";
import { canEdit, toSessionUser } from "@/domain/users";
import { getCurrentUser, getSheetId } from "@/server/currentUser";
import { SheetLayoutError } from "@/domain/sheetColumns";
import { getServiceAccountToken } from "@/server/serviceAccount";
import { SheetsClient, SheetsError } from "@/server/sheetsClient";
import { withSheetLock } from "@/server/sheetLock";
import { applyOps, readSnapshot, sortMovementsByDate } from "@/server/sheetSync";

/**
 * POST /api/sync: writes the app's pending changes to the user's sheet, then returns the
 * whole sheet. The sheet is the source of truth, so the app replaces its copy with this.
 * A read-only user may only read: any change they send is refused here, on the server.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ error: "signedOut" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const ops = parseSyncOps(
    typeof body === "object" && body !== null && "ops" in body ? body.ops : null,
  );
  if (!ops) return Response.json({ error: "badRequest" }, { status: 400 });
  if (ops.length > 0 && !canEdit(user.role)) {
    return Response.json({ error: "readOnly" }, { status: 403 });
  }

  const spreadsheetId = getSheetId(user);
  const accessToken = spreadsheetId ? await getServiceAccountToken() : null;
  if (!spreadsheetId || !accessToken) {
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const client = new SheetsClient(accessToken, spreadsheetId);
  try {
    // One sync at a time per Sheet: rows are found by position, and sorting or deleting moves them.
    const snapshot = await withSheetLock(spreadsheetId, async () => {
      await applyOps(client, ops);
      if (ops.some((op) => op.kind === "upsertMovements")) await sortMovementsByDate(client);
      return readSnapshot(client);
    });
    return Response.json({
      ...snapshot,
      user: toSessionUser(user),
      // Only owners get the link: the read-only view can't open the Sheet.
      sheetUrl: canEdit(user.role)
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        : null,
    });
  } catch (error) {
    // A column the app needs was renamed or deleted: nothing is written, and the message says which.
    if (error instanceof SheetLayoutError) {
      return Response.json({ error: "sheetLayout", detail: error.message }, { status: 422 });
    }
    const status = error instanceof SheetsError ? error.status : 500;
    // 403/404 from Google: the Sheet isn't shared with the service account (or doesn't exist).
    const code = status === 403 || status === 404 ? "notConfigured" : "sheetsError";
    return Response.json({ error: code }, { status: code === "notConfigured" ? 503 : 502 });
  }
}
