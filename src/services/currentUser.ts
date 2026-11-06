import type { SessionUser } from "@/domain/users";

/**
 * Who is signed in, as the browser knows it. The server answers from the session cookie;
 * the last answer is kept on the device (only name, id, role and color, nothing secret)
 * so the app still opens without internet. The server checks every request anyway.
 */
const STORAGE_KEY = "pockets-user";

function isSessionUser(value: unknown): value is SessionUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "role" in value &&
    (value.role === "owner" || value.role === "viewer") &&
    "layout" in value &&
    (value.layout === "full" || value.layout === "simple") &&
    "tone" in value &&
    typeof value.tone === "string"
  );
}

function readCached(): SessionUser | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isSessionUser(value) ? value : null;
  } catch {
    return null;
  }
}

export function forgetCachedUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; there is nothing to forget then.
  }
}

/** null means nobody is signed in. Offline, it falls back to the last known person. */
export async function fetchCurrentUser(): Promise<SessionUser | null> {
  let response: Response;
  try {
    response = await fetch("/api/me", { cache: "no-store" });
  } catch {
    return readCached();
  }
  if (response.status === 401) {
    forgetCachedUser();
    return null;
  }
  if (!response.ok) return readCached();

  const body: unknown = await response.json().catch(() => null);
  const user =
    typeof body === "object" && body !== null && "user" in body && isSessionUser(body.user)
      ? body.user
      : null;
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Without storage the app still works online.
  }
  return user;
}
