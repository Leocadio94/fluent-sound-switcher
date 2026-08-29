import type { BrandVariants } from "@fluentui/react-components";

import type { AccentPalette } from "../lib/tauri";

/** The sixteen shades a Fluent brand ramp is made of, darkest to lightest. */
const BRAND_STOPS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
] as const;

/**
 * Where each Windows accent shade sits on the sixteen-stop ramp.
 *
 * Windows hands us seven shades it derived itself, so the ramp is interpolated
 * between those rather than computed from the accent colour alone — they are
 * the shades the OS uses, already tuned, and using them is what makes the app
 * look like it belongs next to everything else on the desktop.
 *
 * The accent proper is pinned to index 7 (stop 80) because that is the shade
 * Fluent uses for `colorBrandBackground` — the buttons, the active device row.
 * That one has to be *exactly* the colour the user picked, not an interpolation
 * near it.
 */
const ANCHORS: { index: number; key: keyof AccentPalette }[] = [
  { index: 0, key: "dark3" },
  { index: 2, key: "dark2" },
  { index: 5, key: "dark1" },
  { index: 7, key: "accent" },
  { index: 9, key: "light1" },
  { index: 11, key: "light2" },
  { index: 13, key: "light3" },
];

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Builds a Fluent brand ramp from the Windows accent shades.
 *
 * Returns `null` if any shade is unreadable, so the caller can fall back to the
 * default palette instead of rendering something half-derived.
 */
export function paletteToBrand(palette: AccentPalette): BrandVariants | null {
  const anchors = ANCHORS.map(({ index, key }) => {
    const rgb = parseHex(palette[key]);
    return rgb ? { index, rgb } : null;
  });
  if (anchors.some((a) => a === null)) return null;
  const points = anchors as { index: number; rgb: Rgb }[];

  const ramp = BRAND_STOPS.map((_, i) => {
    // Below the first anchor or on it.
    if (i <= points[0].index) return points[0].rgb;

    // Between two anchors: straight interpolation.
    for (let k = 0; k < points.length - 1; k++) {
      const low = points[k];
      const high = points[k + 1];
      if (i >= low.index && i <= high.index) {
        const t = (i - low.index) / (high.index - low.index);
        return mix(low.rgb, high.rgb, t);
      }
    }

    // Above the last anchor (stops 150 and 160): Windows stops at light3, so
    // carry on toward white at the same pace rather than repeating a shade.
    const last = points[points.length - 1];
    const steps = BRAND_STOPS.length - 1 - last.index;
    const t = (i - last.index) / (steps + 1);
    return mix(last.rgb, WHITE, t);
  });

  return Object.fromEntries(
    BRAND_STOPS.map((stop, i) => [stop, toHex(ramp[i])]),
  ) as BrandVariants;
}
