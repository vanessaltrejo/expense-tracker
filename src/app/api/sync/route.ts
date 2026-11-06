import { parseSyncOps } from "@/domain/syncOps";
import { getGoogleAccess } from "@/server/googleAccess";
import { SheetsClient, SheetsError } from "@/server/sheetsClient";
import { applyOps, readSnapshot } from "@/server/sheetSync";

/**
 * POST /api/sync: writes the app's pending changes to the sheet, then returns the whole
 * sheet. The sheet is the source of truth, so the app replaces its copy with this answer.
 */
export async function POST(request: Request): Promise<Response> {
  const access = await getGoogleAccess(request);
  if (!access) return Response.json({ error: "signedOut" }, { status: 401 });

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) return Response.json({ error: "notConfigured" }, { status: 500 });

  const body: unknown = await request.json().catch(() => null);
  const ops = parseSyncOps(
    typeof body === "object" && body !== null && "ops" in body ? body.ops : null,
  );
  if (!ops) return Response.json({ error: "badRequest" }, { status: 400 });

  const client = new SheetsClient(access.accessToken, spreadsheetId);
  try {
    await applyOps(client, ops);
    const snapshot = await readSnapshot(client);
    return Response.json({ ...snapshot, email: access.email, name: access.name });
  } catch (error) {
    const status = error instanceof SheetsError ? error.status : 500;
    // 401/403 from Google mean the permission was revoked: the app asks to sign in again.
    const code = status === 401 || status === 403 ? "signedOut" : "sheetsError";
    return Response.json({ error: code }, { status: code === "signedOut" ? 401 : 502 });
  }
}
