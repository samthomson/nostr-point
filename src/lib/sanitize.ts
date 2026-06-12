/**
 * Sanitization helpers for untrusted event-sourced data.
 * Presentations come from Nostr events signed by arbitrary pubkeys,
 * so every URL and CSS value must be validated before rendering.
 */

/** Allow only http(s) and blob URLs (blob: needed for offline-cached media) */
export function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:') {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return undefined;
}

/**
 * Allow only safe CSS color values: hex colors, rgb()/rgba() with numeric args,
 * and a conservative set of named colors.
 */
const NAMED_COLORS = new Set([
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'pink', 'gray', 'grey', 'cyan', 'magenta', 'transparent', 'navy', 'teal',
  'maroon', 'olive', 'lime', 'aqua', 'silver', 'fuchsia',
]);

export function sanitizeCssColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim().toLowerCase();

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (/^#[0-9a-f]{3,8}$/.test(trimmed)) return trimmed;

  // rgb()/rgba() with only numbers, commas, spaces, dots, percent
  if (/^rgba?\([\d\s,.%/]+\)$/.test(trimmed)) return trimmed;

  // hsl()/hsla()
  if (/^hsla?\([\d\s,.%/deg]+\)$/.test(trimmed)) return trimmed;

  if (NAMED_COLORS.has(trimmed)) return trimmed;

  return undefined;
}
