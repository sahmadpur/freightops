import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess, homeFor, type Area, type Role } from "@/lib/roles";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Use in route-group layouts. Redirects to sign-in or the user's home area. */
export async function requireArea(area: Area) {
  const session = await getSession();
  if (!session || session.user.active === false) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canAccess(area, role)) redirect(homeFor(role));
  return { session, role };
}
