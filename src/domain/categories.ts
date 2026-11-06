import type { Movement } from "./types.ts";

/**
 * The categories to offer, without the hidden ones. With `byUse` the most used come first,
 * so a long list opens on what the person picks most.
 */
export function getCategoryOptions(
  categories: string[],
  movements: Movement[],
  byUse: boolean,
  hidden: string[] = [],
): string[] {
  const shown = categories.filter((option) => !hidden.includes(option));
  if (!byUse) return shown;

  const usage = new Map<string, number>();
  for (const movement of movements) {
    if (movement.category) usage.set(movement.category, (usage.get(movement.category) ?? 0) + 1);
  }
  return [...shown].sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0));
}
