import { describe, expect, it } from "vitest";

import { autostartAction } from "./autostart";

describe("autostartAction", () => {
  it("restores the entry a reinstall removed", () => {
    expect(autostartAction(true, false)).toBe("enable");
  });

  it("leaves a registered entry alone when the preference agrees", () => {
    expect(autostartAction(true, true)).toBe("none");
  });

  it("records an entry that exists with no preference on file", () => {
    // Someone who enabled it before the preference was stored.
    expect(autostartAction(null, true)).toBe("remember");
    expect(autostartAction(false, true)).toBe("remember");
  });

  it("does nothing when the user never turned it on, or turned it off", () => {
    expect(autostartAction(null, false)).toBe("none");
    expect(autostartAction(false, false)).toBe("none");
  });
});
