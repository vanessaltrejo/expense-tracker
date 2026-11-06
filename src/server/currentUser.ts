import { getToken } from "next-auth/jwt";

import { type AppUser, findUserById } from "@/domain/users";

/**
 * Reads who is signed in from the encrypted session cookie. Removing someone's password
 * hash from the environment also closes their open sessions.
 */
export async function getCurrentUser(request: Request): Promise<AppUser | null> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(request.url).protocol === "https:",
  });
  const user = findUserById(token?.userId);
  if (!user || !process.env[user.passwordHashEnv]) return null;
  return user;
}

/** The Sheet a user works with, or null while it isn't set up. */
export function getSheetId(user: AppUser): string | null {
  return process.env[user.sheetIdEnv]?.trim() || null;
}
