export type Role = "admin" | "operator" | "client";
export type Area = "staff" | "portal" | "admin";

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
