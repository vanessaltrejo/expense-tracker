/**
 * Who can use the app. This is a picker, like a streaming service: it chooses which space
 * to open, it is not a lock. Each person's data stays in their own Google Sheet.
 *
 * - owner:  the full app, reading and writing the owner's Sheet.
 * - viewer: sees the owner's information in read-only mode (not enabled yet).
 * - own:    a separate space with its own data (not set up yet).
 */
export type ProfileRole = "owner" | "viewer" | "own";

export type AvatarTone = "violet" | "teal" | "orange";

export interface AppProfile {
  id: string;
  name: string;
  /** Two letters at most, shown inside the circle. */
  initials: string;
  role: ProfileRole;
  tone: AvatarTone;
}

export const APP_PROFILES: AppProfile[] = [
  { id: "vanessa", name: "Vanessa", initials: "VT", role: "owner", tone: "violet" },
  { id: "mama", name: "Mamá", initials: "M", role: "viewer", tone: "teal" },
  { id: "novio", name: "Novio", initials: "N", role: "own", tone: "orange" },
];

export function getProfileById(id: string | null | undefined): AppProfile | null {
  return APP_PROFILES.find((profile) => profile.id === id) ?? null;
}
