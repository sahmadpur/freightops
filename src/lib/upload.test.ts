import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, validateUpload, buildS3Key } from "./upload";

describe("validateUpload", () => {
  it("accepts a normal PDF under the size limit", () => {
    expect(validateUpload({ name: "cmr.pdf", type: "application/pdf", size: 1024 })).toEqual({ ok: true });
  });
  it("rejects an empty file", () => {
    expect(validateUpload({ name: "x.pdf", type: "application/pdf", size: 0 })).toEqual({ ok: false, reason: "empty" });
  });
  it("rejects files over the size limit", () => {
    expect(validateUpload({ name: "big.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 })).toEqual({ ok: false, reason: "too_large" });
  });
  it("rejects a disallowed content type", () => {
    expect(validateUpload({ name: "evil.exe", type: "application/x-msdownload", size: 10 })).toEqual({ ok: false, reason: "type" });
  });
  it("accepts common doc/image types", () => {
    for (const type of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      expect(validateUpload({ name: "f", type, size: 10 }).ok).toBe(true);
    }
  });
});

describe("buildS3Key", () => {
  it("namespaces by parent and keeps a sanitized file name", () => {
    const key = buildS3Key("order", "ord-1", "uuid-123", "My CMR (final).pdf");
    expect(key).toBe("order/ord-1/uuid-123-My-CMR-final.pdf");
  });
  it("strips any directory components (no path traversal) and preserves the extension", () => {
    expect(buildS3Key("transport_mode", "tm-9", "abc", "../../etc/passwd")).toBe("transport_mode/tm-9/abc-passwd");
    expect(buildS3Key("order", "o", "k", "weird name!!.PNG")).toBe("order/o/k-weird-name.PNG");
  });
});
