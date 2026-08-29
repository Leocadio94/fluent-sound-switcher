import { describe, expect, it } from "vitest";

import { paletteToBrand, parseHex } from "./accentTheme";
import type { AccentPalette } from "../lib/tauri";

/** A real palette, as Windows reported it on a machine with a muted accent. */
const PALETTE: AccentPalette = {
  dark3: "#0f1224",
  dark2: "#292f40",
  dark1: "#454e5e",
  accent: "#515c6b",
  light1: "#657486",
  light2: "#a0aeb7",
  light3: "#d7e2e4",
};

describe("parseHex", () => {
  it("accepts six-digit hex with or without the hash", () => {
    expect(parseHex("#0f6cbd")).toEqual({ r: 15, g: 108, b: 189 });
    expect(parseHex("0F6CBD")).toEqual({ r: 15, g: 108, b: 189 });
  });

  it("rejects anything else", () => {
    for (const bad of ["", "#fff", "#12345g", "rgb(1,2,3)", "#1234567"]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe("paletteToBrand", () => {
  it("produces all sixteen stops", () => {
    const brand = paletteToBrand(PALETTE)!;
    expect(Object.keys(brand)).toHaveLength(16);
    expect(brand[10]).toBeDefined();
    expect(brand[160]).toBeDefined();
  });

  it("puts the accent colour itself at stop 80", () => {
    // Stop 80 is what Fluent uses for colorBrandBackground — the buttons and
    // the active device row. It has to be exactly what the user picked.
    const brand = paletteToBrand(PALETTE)!;
    expect(brand[80]).toBe(PALETTE.accent);
  });

  it("anchors the Windows shades at their stops", () => {
    const brand = paletteToBrand(PALETTE)!;
    expect(brand[10]).toBe(PALETTE.dark3);
    expect(brand[30]).toBe(PALETTE.dark2);
    expect(brand[60]).toBe(PALETTE.dark1);
    expect(brand[100]).toBe(PALETTE.light1);
    expect(brand[120]).toBe(PALETTE.light2);
    expect(brand[140]).toBe(PALETTE.light3);
  });

  it("gets lighter from one end to the other", () => {
    const brand = paletteToBrand(PALETTE)!;
    const luminance = (hex: string) => {
      const { r, g, b } = parseHex(hex)!;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const stops = Object.keys(brand)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => luminance(brand[k as keyof typeof brand]));
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    }
  });

  it("keeps going past the lightest Windows shade instead of repeating it", () => {
    // Windows stops at light3 (stop 140); 150 and 160 have to come from
    // somewhere, and a flat top would make the lightest surfaces indistinct.
    const brand = paletteToBrand(PALETTE)!;
    expect(brand[150]).not.toBe(brand[140]);
    expect(brand[160]).not.toBe(brand[150]);
  });

  it("returns null when a shade is unreadable", () => {
    expect(paletteToBrand({ ...PALETTE, accent: "not a colour" })).toBeNull();
  });
});
