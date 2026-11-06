import { getProfileById } from "@/domain/appProfiles";

/**
 * Remembers who picked their profile until the app is closed: opening the app again
 * asks again, like a streaming service. Kept in sessionStorage, with a memory fallback
 * for browsers that block it.
 */
const STORAGE_KEY = "pockets-active-profile";

const listeners = new Set<() => void>();
let memoryValue: string | null = null;

export function subscribeToActiveProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The id of the chosen profile, or null when nobody has chosen yet. */
export function getActiveProfileId(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    stored = memoryValue;
  }
  // An id that no longer exists in the list counts as nobody having chosen.
  return getProfileById(stored) ? stored : null;
}

export function setActiveProfileId(id: string | null): void {
  memoryValue = id;
  try {
    if (id === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The memory copy above is enough for this visit.
  }
  listeners.forEach((listener) => listener());
}
