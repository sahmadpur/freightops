import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSessionMock(...args) } },
}));

import { requireArea } from "./session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const staffSession = (role: string, active = true): any => ({
  user: { id: "u1", role, active },
  session: { id: "s1" },
});

beforeEach(() => getSessionMock.mockReset());

describe("requireArea", () => {
  it("redirects to /sign-in when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireArea("staff")).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("redirects to /sign-in when the user is deactivated", async () => {
    getSessionMock.mockResolvedValue(staffSession("admin", false));
    await expect(requireArea("staff")).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("redirects a client away from the staff area to /portal", async () => {
    getSessionMock.mockResolvedValue(staffSession("client"));
    await expect(requireArea("staff")).rejects.toThrow("REDIRECT:/portal");
  });

  it("redirects an operator away from the admin area to /orders", async () => {
    getSessionMock.mockResolvedValue(staffSession("operator"));
    await expect(requireArea("admin")).rejects.toThrow("REDIRECT:/orders");
  });

  it("returns session and role for an authorized user", async () => {
    getSessionMock.mockResolvedValue(staffSession("operator"));
    const result = await requireArea("staff");
    expect(result.role).toBe("operator");
    expect(result.session.user.id).toBe("u1");
  });
});
