import { createSign } from "node:crypto";

/**
 * The server reaches the Sheets through a Google service account: a "robot" account that
 * only sees the Sheets shared with it. Its private key lives only in environment
 * variables on the server; it never reaches the browser, the code or Git.
 */
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 3600;
const REFRESH_MARGIN_SECONDS = 120;

let cached: { token: string; expiresAt: number } | null = null;

function readKey(): { email: string; privateKey: string } | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  // Pasted from the JSON file, the key keeps its line breaks as "\n": restore them. Quotes
  // pasted around it by mistake (as in Vercel) are removed too.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n");
  if (!email || !privateKey) return null;
  return { email, privateKey };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** A short-lived access token, reused until a couple of minutes before it expires. */
export async function getServiceAccountToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - REFRESH_MARGIN_SECONDS > now) return cached.token;

  const key = readKey();
  if (!key) return null;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + TOKEN_LIFETIME_SECONDS,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  let signature: string;
  try {
    signature = signer.sign(key.privateKey, "base64url");
  } catch {
    // A badly pasted key: report it as not configured instead of exposing details.
    return null;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("access_token" in body)) return null;
  const token = body.access_token;
  if (typeof token !== "string" || token === "") return null;

  const lifetime =
    "expires_in" in body && typeof body.expires_in === "number"
      ? body.expires_in
      : TOKEN_LIFETIME_SECONDS;
  cached = { token, expiresAt: now + lifetime };
  return token;
}
