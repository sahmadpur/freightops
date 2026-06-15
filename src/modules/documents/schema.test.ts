import { describe, expect, it } from "vitest";
import { uploadMetaSchema, visibilityInputSchema } from "./schema";

describe("uploadMetaSchema", () => {
  it("accepts valid upload metadata", () => {
    const r = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "cmr", visibleToClient: "true" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibleToClient).toBe(true);
  });
  it("coerces the visibleToClient checkbox value", () => {
    const off = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "other", visibleToClient: "false" });
    expect(off.success && off.data.visibleToClient).toBe(false);
    const missing = uploadMetaSchema.safeParse({ parentType: "order", parentId: "ord-1", docType: "other" });
    expect(missing.success && missing.data.visibleToClient).toBe(false);
  });
  it("rejects unknown parentType or docType", () => {
    expect(uploadMetaSchema.safeParse({ parentType: "spaceship", parentId: "x", docType: "cmr" }).success).toBe(false);
    expect(uploadMetaSchema.safeParse({ parentType: "order", parentId: "x", docType: "nope" }).success).toBe(false);
  });
  it("requires a non-empty parentId", () => {
    expect(uploadMetaSchema.safeParse({ parentType: "order", parentId: "", docType: "cmr" }).success).toBe(false);
  });
});

describe("visibilityInputSchema", () => {
  it("parses a boolean", () => {
    expect(visibilityInputSchema.safeParse({ visibleToClient: true }).success).toBe(true);
    expect(visibilityInputSchema.safeParse({ visibleToClient: "yes" }).success).toBe(false);
  });
});
