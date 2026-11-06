import { toSessionUser } from "@/domain/users";
import { getCurrentUser } from "@/server/currentUser";

/** GET /api/me: who is signed in, or 401. Only the safe parts of the user leave the server. */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: toSessionUser(user) });
}
