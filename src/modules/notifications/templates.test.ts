import { describe, expect, it } from "vitest";
import { orderCreatedEmail, orderStatusChangedEmail, newCommentEmail, invitationEmail } from "./templates";

describe("email templates", () => {
  it("orderCreatedEmail includes number, title, and url", () => {
    const e = orderCreatedEmail({ orderNumber: "ORD-2026-001", orderTitle: "Steel coils", url: "http://x/orders/1" });
    expect(e.subject).toContain("ORD-2026-001");
    expect(e.body).toContain("Steel coils");
    expect(e.body).toContain("http://x/orders/1");
  });
  it("orderStatusChangedEmail includes the status", () => {
    const e = orderStatusChangedEmail({ orderNumber: "ORD-2026-001", status: "delivered", url: "http://x/orders/1" });
    expect(e.subject).toContain("ORD-2026-001");
    expect(e.body).toContain("delivered");
  });
  it("newCommentEmail includes author and preview", () => {
    const e = newCommentEmail({ orderNumber: "ORD-2026-001", authorName: "Aida", preview: "ready to ship", url: "http://x/orders/1" });
    expect(e.body).toContain("Aida");
    expect(e.body).toContain("ready to ship");
  });
  it("invitationEmail includes the url", () => {
    const e = invitationEmail({ url: "http://x/accept-invitation?token=abc", role: "operator" });
    expect(e.body).toContain("http://x/accept-invitation?token=abc");
  });
});
