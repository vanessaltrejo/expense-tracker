/**
 * The people who can sign in. Each one enters with a username and a password.
 *
 * - owner:  the full app over their own Google Sheet.
 * - viewer: reads someone else's Sheet and can't change, open or download anything.
 *
 * Nothing secret lives here: the password hashes and the Sheet IDs come from environment
 * variables, named by `passwordHashEnv` and `sheetIdEnv`.
 */
export type UserRole = "owner" | "viewer";

export type AvatarTone = "violet" | "teal" | "orange";

/**
 * - full:   cajita, Banorte, cash, the Nu credit card and Deuda mami, by card period.
 * - simple: one debit account (BBVA), what comes in and what is spent, by calendar month.
 */
export type UserLayout = "full" | "simple";

export interface AppUser {
  id: string;
  /** What is typed to sign in. Compared without caring about uppercase or spaces. */
  username: string;
  name: string;
  role: UserRole;
  layout: UserLayout;
  tone: AvatarTone;
  passwordHashEnv: string;
  sheetIdEnv: string;
}

export const APP_USERS: AppUser[] = [
  {
    id: "vanessa",
    username: "vanessa",
    name: "Vanessa Trejo",
    role: "owner",
    layout: "full",
    tone: "violet",
    passwordHashEnv: "PASSWORD_HASH_VANESSA",
    sheetIdEnv: "GOOGLE_SHEETS_ID",
  },
  {
    id: "mami",
    username: "mami",
    name: "Mami",
    role: "viewer",
    layout: "full",
    tone: "teal",
    passwordHashEnv: "PASSWORD_HASH_MAMI",
    // She reads Vanessa's Sheet.
    sheetIdEnv: "GOOGLE_SHEETS_ID",
  },
  {
    id: "francisco",
    username: "francisco",
    name: "Francisco Amaya",
    role: "owner",
    layout: "simple",
    tone: "orange",
    passwordHashEnv: "PASSWORD_HASH_FRANCISCO",
    sheetIdEnv: "GOOGLE_SHEETS_ID_FRANCISCO",
  },
];

export function findUserByUsername(username: unknown): AppUser | null {
  if (typeof username !== "string") return null;
  const wanted = username.trim().toLowerCase();
  return APP_USERS.find((user) => user.username === wanted) ?? null;
}

export function findUserById(id: unknown): AppUser | null {
  if (typeof id !== "string") return null;
  return APP_USERS.find((user) => user.id === id) ?? null;
}

/** Only owners change data. Mom's view is read-only, and the server enforces it. */
export function canEdit(role: UserRole): boolean {
  return role === "owner";
}

/** What the browser is allowed to know about the signed-in person. */
export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  layout: UserLayout;
  tone: AvatarTone;
}

export function toSessionUser(user: AppUser): SessionUser {
  return { id: user.id, name: user.name, role: user.role, layout: user.layout, tone: user.tone };
}
