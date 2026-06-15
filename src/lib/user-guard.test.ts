import { describe, expect, it } from "vitest";
import { selfMutationBlocked } from "./user-guard";

describe("selfMutationBlocked", () => {
  it("blocks deactivating yourself", () => {
    expect(selfMutationBlocked("u1", "u1", { active: false })).toBe(true);
  });
  it("blocks demoting yourself off admin", () => {
    expect(selfMutationBlocked("u1", "u1", { role: "operator" })).toBe(true);
    expect(selfMutationBlocked("u1", "u1", { role: "client" })).toBe(true);
  });
  it("allows keeping yourself admin / activating yourself", () => {
    expect(selfMutationBlocked("u1", "u1", { role: "admin" })).toBe(false);
    expect(selfMutationBlocked("u1", "u1", { active: true })).toBe(false);
  });
  it("never blocks actions on a different user", () => {
    expect(selfMutationBlocked("u1", "u2", { active: false })).toBe(false);
    expect(selfMutationBlocked("u1", "u2", { role: "client" })).toBe(false);
  });
});
