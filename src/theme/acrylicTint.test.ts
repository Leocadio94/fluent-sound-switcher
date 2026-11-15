import { describe, expect, it } from "vitest";

import { ACRYLIC_TINT_PERCENT, acrylicTint } from "./acrylicTint";

describe("acrylicTint", () => {
  it("mixes the surface with transparent, so the blur still shows through", () => {
    expect(acrylicTint("var(--colorNeutralBackground1)")).toBe(
      `color-mix(in srgb, var(--colorNeutralBackground1) ${ACRYLIC_TINT_PERCENT}%, transparent)`,
    );
  });

  it("is neither clear glass nor an opaque fill", () => {
    expect(ACRYLIC_TINT_PERCENT).toBeGreaterThan(0);
    expect(ACRYLIC_TINT_PERCENT).toBeLessThan(100);
  });
});
