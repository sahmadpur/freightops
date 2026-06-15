import { describe, expect, it } from "vitest";
import { clientMayDownload } from "./document-access";

const visibleOrderDoc = { parentType: "order" as const, visibleToClient: true };

describe("clientMayDownload", () => {
  it("allows a client to download a visible order doc owned by their account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-1", "acc-1")).toBe(true);
  });
  it("denies when the order belongs to a different account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-2", "acc-1")).toBe(false);
  });
  it("denies when the doc is not client-visible", () => {
    expect(clientMayDownload({ parentType: "order", visibleToClient: false }, "acc-1", "acc-1")).toBe(false);
  });
  it("denies non-order documents (e.g. transport_mode)", () => {
    expect(clientMayDownload({ parentType: "transport_mode", visibleToClient: true }, "acc-1", "acc-1")).toBe(false);
  });
  it("denies when the client has no account", () => {
    expect(clientMayDownload(visibleOrderDoc, "acc-1", null)).toBe(false);
  });
});
