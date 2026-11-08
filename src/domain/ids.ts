import type { IsoDate } from "./types.ts";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Random characters keep IDs unique across devices: the phone and the laptop can both create
 * movements offline, so a simple counter would give the same number to two different ones.
 */
function randomChars(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/** "261108-k3f9": the day of the movement (year, month, day) and four random characters. */
export function createMovementId(date: IsoDate): string {
  return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-${randomChars(4)}`;
}

/** "sk3f9": an "s" and four random characters, like the "s1", "s2" of the Atajos tab. */
export function createShortcutId(): string {
  return `s${randomChars(4)}`;
}
