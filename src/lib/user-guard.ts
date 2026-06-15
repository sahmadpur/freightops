import type { Role } from "@/lib/roles";

/**
 * Prevent an admin from locking themselves out: an admin may not deactivate
 * their own account, nor demote themselves off the admin role.
 */
export function selfMutationBlocked(
  actorId: string,
  targetId: string,
  change: { active?: boolean; role?: Role },
): boolean {
  if (actorId !== targetId) return false;
  if (change.active === false) return true;
  if (change.role !== undefined && change.role !== "admin") return true;
  return false;
}
