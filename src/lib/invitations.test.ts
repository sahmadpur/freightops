import { describe, expect, it } from "vitest";
import { invitationStatus, INVITATION_TTL_DAYS } from "./invitations";

const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 1000);

describe("invitationStatus", () => {
  it("is valid when unaccepted and unexpired", () => {
    expect(invitationStatus({ expiresAt: future, acceptedAt: null })).toBe("valid");
  });
  it("is expired when past expiry", () => {
    expect(invitationStatus({ expiresAt: past, acceptedAt: null })).toBe("expired");
  });
  it("is used when already accepted", () => {
    expect(invitationStatus({ expiresAt: future, acceptedAt: new Date() })).toBe("used");
  });
  it("ttl is 7 days", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
  });
});
