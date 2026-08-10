export type Role = "admin" | "operator" | "supervisor" | "client";
export type Area = "staff" | "portal" | "admin";

const ROLES: readonly string[] = ["admin", "operator", "supervisor", "client"];

/** Everyone who works the desk, as opposed to a portal client. */
const STAFF_ROLES: readonly Role[] = ["admin", "operator", "supervisor"];

/** True when `value` is one of the roles we know about. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value);
}

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function canAccess(area: Area, role: Role): boolean {
  switch (area) {
    case "staff":
      return isStaffRole(role);
    case "portal":
      return role === "client";
    case "admin":
      return role === "admin";
  }
}

/**
 * Team-wide visibility and the right to reassign another manager's work
 * (spec §25). Operators see and own their own records.
 */
export function canSuperviseTeam(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

export function homeFor(role: Role): string {
  return role === "client" ? "/portal" : "/orders";
}
