import { getBreakdowns } from "./breakdown.ts";
import { isLoan } from "./loans.ts";
import { isInPeriod, type Period } from "./periods.ts";
import type { Cents, Movement, Settings } from "./types.ts";

const MAX_BUTTONS = 12;
const MIN_USES_TO_LEARN = 2;

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The place a note names. A note may carry detail after the place ("12 Rounds (day pass)",
 * "Bread · pain aux chocolat"): it still counts for the place it starts with. The longest
 * known place wins, and it must end at a word edge, so "Bread" doesn't claim "Breadsticks".
 */
export function placeOfNote(note: string, places: string[]): string {
  const text = note.trim();
  const lower = text.toLowerCase();
  let best = "";
  for (const place of places) {
    const wanted = place.trim().toLowerCase();
    if (wanted.length <= best.length || !lower.startsWith(wanted)) continue;
    if (lower.length > wanted.length && /[\p{L}\p{N}]/u.test(lower.charAt(wanted.length))) continue;
    best = place.trim();
  }
  return best || text;
}

function isPlaceSpend(movement: Movement, settings: Settings): boolean {
  return (
    movement.type === "expense" &&
    movement.category !== null &&
    settings.placeCategories.includes(movement.category) &&
    movement.note.trim() !== ""
  );
}

function isOfferedIn(place: string, category: string, settings: Settings): boolean {
  const scope = settings.placeScopes?.[place.trim().toLowerCase()];
  return !scope || scope.length === 0 || scope.some((item) => sameName(item, category));
}

/**
 * The places offered as one-tap buttons in a category: the ones written in the Sheet for
 * it (or for every category) plus any place that was typed twice or more in that category.
 * The most used come first, so the buttons stay relevant. Empty when the category doesn't
 * ask for a place.
 */
export function getFrequentPlaces(
  movements: Movement[],
  settings: Settings,
  category: string | null,
): string[] {
  if (!category || !settings.placeCategories.includes(category)) return [];

  const counts = new Map<string, { name: string; uses: number }>();
  for (const movement of movements) {
    if (!isPlaceSpend(movement, settings) || movement.category !== category) continue;
    const name = placeOfNote(movement.note, settings.places);
    const key = name.toLowerCase();
    const current = counts.get(key);
    if (current) current.uses += 1;
    else counts.set(key, { name, uses: 1 });
  }

  const places: { name: string; uses: number }[] = settings.places
    .filter((name) => isOfferedIn(name, category, settings))
    .map((name) => ({ name, uses: counts.get(name.trim().toLowerCase())?.uses ?? 0 }));
  for (const entry of counts.values()) {
    if (entry.uses >= MIN_USES_TO_LEARN && !places.some((place) => sameName(place.name, entry.name))) {
      places.push(entry);
    }
  }

  // A stable sort keeps the Sheet's order between places with the same number of uses.
  return places
    .map((place, index) => ({ ...place, index }))
    .sort((a, b) => b.uses - a.uses || a.index - b.index)
    .slice(0, MAX_BUTTONS)
    .map((place) => place.name);
}

export interface PlaceTotal {
  place: string;
  amount: Cents;
  count: number;
}

/** Where the money of a period went, biggest first. Only categories that ask for a place. */
export function getTopPlaces(
  movements: Movement[],
  settings: Settings,
  period: Period,
  limit: number,
): PlaceTotal[] {
  const totals = new Map<string, PlaceTotal>();
  for (const movement of movements) {
    if (!isPlaceSpend(movement, settings) || !isInPeriod(movement.date, period)) continue;
    const place = placeOfNote(movement.note, settings.places);
    const key = place.toLowerCase();
    const current = totals.get(key);
    if (current) {
      current.amount += movement.amount;
      current.count += 1;
    } else {
      totals.set(key, { place, amount: movement.amount, count: 1 });
    }
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** What was sent to other people in a period, per person. Transfers are not spending. */
export function getSentToPeople(
  movements: Movement[],
  period: Period,
): { total: Cents; people: PlaceTotal[] } {
  const people = new Map<string, PlaceTotal>();
  const { partsByParent } = getBreakdowns(movements);
  let total = 0;
  for (const movement of movements) {
    if (movement.dataKind !== "real" || movement.type !== "transfer") continue;
    if (movement.from === null || movement.to !== null) continue;
    // Loans have their own list of who owes what.
    if (isLoan(movement)) continue;
    // Its parts are already counted as spending, so it isn't a send to a person.
    if (partsByParent.has(movement.id)) continue;
    if (!isInPeriod(movement.date, period)) continue;
    const name = movement.note.trim() || "Otra persona";
    const key = name.toLowerCase();
    const current = people.get(key);
    if (current) {
      current.amount += movement.amount;
      current.count += 1;
    } else {
      people.set(key, { place: name, amount: movement.amount, count: 1 });
    }
    total += movement.amount;
  }
  return { total, people: [...people.values()].sort((a, b) => b.amount - a.amount) };
}
