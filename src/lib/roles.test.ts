import { describe, expect, it } from "vitest";
import { canAccess, homeFor } from "./roles";

describe("canAccess", () => {
  it("staff area allows admin and operator", () => {
    expect(canAccess("staff", "admin")).toBe(true);
    expect(canAccess("staff", "operator")).toBe(true);
    expect(canAccess("staff", "client")).toBe(false);
  });

  it("portal area allows only clients", () => {
    expect(canAccess("portal", "client")).toBe(true);
    expect(canAccess("portal", "admin")).toBe(false);
    expect(canAccess("portal", "operator")).toBe(false);
  });

  it("admin area allows only admins", () => {
    expect(canAccess("admin", "admin")).toBe(true);
    expect(canAccess("admin", "operator")).toBe(false);
    expect(canAccess("admin", "client")).toBe(false);
  });
});

describe("homeFor", () => {
  it("sends staff to /orders and clients to /portal", () => {
    expect(homeFor("admin")).toBe("/orders");
    expect(homeFor("operator")).toBe("/orders");
    expect(homeFor("client")).toBe("/portal");
  });
});
