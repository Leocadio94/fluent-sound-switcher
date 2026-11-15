/**
 * How much of the theme's surface colour is laid over the Acrylic, in percent.
 * The system Acrylic has no tint to adjust, so legibility over a bright
 * background comes from this layer; the rest still blurs through.
 */
export const ACRYLIC_TINT_PERCENT = 60;

/** `surface` (a Fluent colour token) made translucent, for painting over Acrylic. */
export function acrylicTint(surface: string): string {
  return `color-mix(in srgb, ${surface} ${ACRYLIC_TINT_PERCENT}%, transparent)`;
}
