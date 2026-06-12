import { describe, expect, it } from "vitest";
import { auditDiff } from "./audit";

describe("auditDiff", () => {
  it("reports changed fields with stringified old/new values", () => {
    const changes = auditDiff(
      { title: "Old Co", taxId: 123 },
      { title: "New Co", taxId: 123 },
      ["title", "taxId"],
    );
    expect(changes).toEqual([{ field: "title", oldValue: "Old Co", newValue: "New Co" }]);
  });

  it("ignores fields not listed", () => {
    expect(auditDiff({ a: 1, b: 1 }, { a: 2, b: 2 }, ["a"])).toHaveLength(1);
  });

  it("treats null, undefined and empty string as the same null", () => {
    expect(auditDiff({ notes: null }, { notes: "" }, ["notes"])).toEqual([]);
    expect(auditDiff({ notes: undefined }, { notes: null }, ["notes"])).toEqual([]);
    expect(auditDiff({ notes: null }, { notes: "hi" }, ["notes"])).toEqual([
      { field: "notes", oldValue: null, newValue: "hi" },
    ]);
  });

  it("stringifies numbers", () => {
    expect(auditDiff({ weight: 100 }, { weight: 200 }, ["weight"])).toEqual([
      { field: "weight", oldValue: "100", newValue: "200" },
    ]);
  });
});
