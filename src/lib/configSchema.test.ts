import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  boolOr,
  migrate,
  oneOf,
  stringList,
  stringOr,
} from "./configSchema";

describe("oneOf", () => {
  const positions = ["topCenter", "bottomCenter"] as const;

  it("keeps a value that belongs to the union", () => {
    expect(oneOf("topCenter", positions, "bottomCenter")).toBe("topCenter");
  });

  it("falls back for a value outside the union", () => {
    // A hand-edited config.json used to reach the backend unchecked.
    expect(oneOf("middle", positions, "bottomCenter")).toBe("bottomCenter");
  });

  it("falls back for non-strings", () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(oneOf(bad, positions, "bottomCenter")).toBe("bottomCenter");
    }
  });
});

describe("boolOr / stringOr", () => {
  it("only accepts the right primitive", () => {
    expect(boolOr(true, false)).toBe(true);
    expect(boolOr(false, true)).toBe(false);
    // "true" as a string is not a boolean.
    expect(boolOr("true", false)).toBe(false);
    expect(boolOr(undefined, true)).toBe(true);

    expect(stringOr("Ctrl+Alt+M", "X")).toBe("Ctrl+Alt+M");
    expect(stringOr(null, "X")).toBe("X");
    expect(stringOr(7, "X")).toBe("X");
  });
});

describe("stringList", () => {
  it("keeps only string entries", () => {
    expect(stringList(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });

  it("returns an empty list for anything that is not an array", () => {
    for (const bad of [undefined, null, "a", 3, {}]) {
      expect(stringList(bad)).toEqual([]);
    }
  });
});

describe("migrate", () => {
  it("stamps an unversioned document", () => {
    const migrated = migrate({ startMinimized: true });
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    // Existing settings survive.
    expect(migrated.startMinimized).toBe(true);
  });

  it("leaves a current document untouched", () => {
    const current = { schemaVersion: SCHEMA_VERSION, showDeviceIcon: false };
    expect(migrate(current)).toBe(current);
  });

  it("does not downgrade a document from a newer version", () => {
    const future = { schemaVersion: SCHEMA_VERSION + 1 };
    expect(migrate(future)).toBe(future);
  });
});
