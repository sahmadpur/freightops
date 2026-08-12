import { describe, expect, it } from "vitest";
import { taskInputSchema, taskParentSchema } from "./schema";

describe("taskInputSchema", () => {
  it("needs only a title", () => {
    const r = taskInputSchema.safeParse({ title: "Call the carrier" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.type).toBe("other");
  });
  it("rejects an empty title", () => {
    expect(taskInputSchema.safeParse({ title: "  " }).success).toBe(false);
  });
  it("rejects an unknown type and a malformed due date", () => {
    expect(taskInputSchema.safeParse({ title: "x", type: "nap" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", dueDate: "12.08.2026" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", dueDate: "2026-08-12" }).success).toBe(true);
  });
});

describe("taskParentSchema", () => {
  it("accepts only the two records a task can hang off", () => {
    expect(taskParentSchema.safeParse("request").success).toBe(true);
    expect(taskParentSchema.safeParse("order").success).toBe(true);
    expect(taskParentSchema.safeParse("account").success).toBe(false);
  });
});
