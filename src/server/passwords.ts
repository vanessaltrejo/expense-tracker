import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Passwords are never stored: only a scrypt hash with its own random salt. The format is
 * "scrypt:<salt>:<hash>" in base64url, which has no "$" because Next.js would try to
 * expand it inside .env files.
 */
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return [PREFIX, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

/** Compares in constant time, so the answer time gives no hint about the password. */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [prefix, saltText, hashText] = stored.trim().split(":");
  if (prefix !== PREFIX || !saltText || !hashText) return false;

  const expected = Buffer.from(hashText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = scryptSync(password, Buffer.from(saltText, "base64url"), KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
