import { getToken } from "next-auth/jwt";

import { isAllowedEmail } from "./allowedEmail";

export interface GoogleAccess {
  accessToken: string;
  email: string;
}

const REFRESH_MARGIN_SECONDS = 60;

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("access_token" in body)) return null;
  return asString(body.access_token);
}

/**
 * Reads the signed-in user's Google token from the encrypted session cookie.
 * Returns null when nobody is signed in, the account isn't allowed, or access expired.
 */
export async function getGoogleAccess(request: Request): Promise<GoogleAccess | null> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(request.url).protocol === "https:",
  });
  if (!token) return null;

  const email = asString(token.email);
  if (!email || !isAllowedEmail(email)) return null;

  const accessToken = asString(token.googleAccessToken);
  const expiresAt = typeof token.googleExpiresAt === "number" ? token.googleExpiresAt : 0;
  const now = Math.floor(Date.now() / 1000);

  if (accessToken && expiresAt - REFRESH_MARGIN_SECONDS > now) {
    return { accessToken, email };
  }

  const refreshToken = asString(token.googleRefreshToken);
  const refreshed = refreshToken ? await refreshAccessToken(refreshToken) : null;
  return refreshed ? { accessToken: refreshed, email } : null;
}
