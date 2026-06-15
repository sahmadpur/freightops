import { describe, expect, it } from "vitest";
import { commentInputSchema } from "./schema";

describe("commentInputSchema", () => {
  it("accepts a non-empty trimmed body", () => {
    const r = commentInputSchema.safeParse({ body: "  hello team  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hello team");
  });
  it("rejects an empty/whitespace body", () => {
    expect(commentInputSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(commentInputSchema.safeParse({ body: "" }).success).toBe(false);
  });
  it("rejects an over-long body", () => {
    expect(commentInputSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });
});
