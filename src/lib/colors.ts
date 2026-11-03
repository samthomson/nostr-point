/**
 * Pure color math for theme gradients and auto-contrast text.
 * No React, no DOM — every function is total over hex strings
 * (returns null for unusable input rather than throwing).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** True for `#rgb` / `#rrggbb` hex strings (the only forms the theme editors emit). */
export function isValidHex(hex: string | undefined): hex is string {
  return Boolean(hex && HEX_RE.test(hex));
}

export function hexToRgb(hex: string): Rgb | null {
  if (!isValidHex(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to2 = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Linear sRGB interpolation between two hex colors; null if either is invalid. */
export function lerpColor(from: string, to: string, t: number): string | null {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b) return null;
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * clamped,
    g: a.g + (b.g - a.g) * clamped,
    b: a.b + (b.b - a.b) * clamped,
  });
}

/** WCAG 2.x relative luminance of a hex color; null if invalid. */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/** WCAG contrast ratio between two hex colors; null if either is invalid. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick whichever of `dark`/`light` contrasts more with `background`.
 * Picking by max contrast keeps the worst case at the flip point ≥ ~4.5:1
 * (WCAG AA). Falls back to `light` when inputs are unusable.
 */
export function pickContrastColor(background: string, dark: string, light: string): string {
  const cd = contrastRatio(background, dark);
  const cl = contrastRatio(background, light);
  if (cd === null || cl === null) return light;
  return cd >= cl ? dark : light;
}
