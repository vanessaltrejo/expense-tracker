import type { Movement } from "./types.ts";

/**
 * A breakdown ("desglose") shows what a bank movement was used for, like a receipt under
 * it: a cash withdrawal split into what the cash paid for, or a transfer split into the
 * things it settled. The bank movement stays one row with the bank's exact amount.
 *
 * Nothing extra is stored in the Sheet: a part's ID is its movement's ID plus a dot and a
 * number ("m1abc.2"), which is how the app knows which movement it hangs from.
 */
const PART_ID = /^(.+)\.(\d+)$/;

/** The ID of the movement a part belongs to, or null when the ID isn't a part's. */
export function parentIdOf(id: string): string | null {
  return PART_ID.exec(id)?.[1] ?? null;
}

export function partId(parentId: string, position: number): string {
  return `${parentId}.${position}`;
}

export interface Breakdowns {
  /** Parts of each movement that has a breakdown, in the order they were listed. */
  partsByParent: Map<string, Movement[]>;
  /** Movements that are a part of another one that exists. */
  partIds: Set<string>;
}

export function getBreakdowns(movements: Movement[]): Breakdowns {
  const known = new Set(movements.map((movement) => movement.id));
  const partsByParent = new Map<string, Movement[]>();
  const partIds = new Set<string>();

  for (const movement of movements) {
    const parent = parentIdOf(movement.id);
    if (parent === null || !known.has(parent)) continue;
    partIds.add(movement.id);
    const parts = partsByParent.get(parent) ?? [];
    parts.push(movement);
    partsByParent.set(parent, parts);
  }

  for (const parts of partsByParent.values()) {
    parts.sort((a, b) => numberOf(a.id) - numberOf(b.id));
  }
  return { partsByParent, partIds };
}

function numberOf(id: string): number {
  return Number(PART_ID.exec(id)?.[2] ?? 0);
}
