let sequence = 0;

/**
 * IDs that stay unique across devices: the phone and the laptop can both create
 * movements offline, so a simple counter would give the same number twice.
 */
export function createId(prefix: string): string {
  sequence = (sequence + 1) % 1296;
  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return `${prefix}${time}${sequence.toString(36).padStart(2, "0")}${random}`;
}
