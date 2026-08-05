export type Role = "admin" | "operator" | "client";
export type Area = "staff" | "portal" | "admin";

const ROLES: readonly string[] = ["admin", "operator", "client"];

/** True when `value` is one of the roles we know about. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value);
}

export function canAccess(area: Area, role: Role): boolean {
  switch (area) {
    case "staff":
      return role === "admin" || role === "operator";
    case "portal":
      return role === "client";
    case "admin":
      return role === "admin";
  }
}

export function homeFor(role: Role): string {
  return role === "client" ? "/portal" : "/orders";
}
