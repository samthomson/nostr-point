import {
  type Slide,
  type Theme,
  type PresentationContent,
  calculateTotalDuration,
  formatDuration,
} from './types';

export interface PresentationStats {
  /** Number of slides */
  slideCount: number;
  /** Total number of elements across all slides */
  elementCount: number;
  /** Counts by element type */
  textCount: number;
  imageCount: number;
  shapeCount: number;
  /** Number of distinct external media URLs referenced */
  mediaCount: number;
  /** Total planned duration in seconds */
  durationSeconds: number;
  /** Human-readable duration */
  durationLabel: string;
  /** Estimated serialized event size in bytes */
  byteSize: number;
  /** Human-readable size */
  sizeLabel: string;
  /** Relay-acceptance verdict */
  verdict: SizeVerdict;
}

export type SizeVerdictLevel = 'great' | 'ok' | 'caution' | 'risky';

export interface SizeVerdict {
  level: SizeVerdictLevel;
  title: string;
  detail: string;
}

/** Reference relay size limits (max_event_length / max_content_length, bytes). */
const RELAY_THRESHOLDS = {
  /** Comfortably accepted nearly everywhere */
  universal: 64 * 1024, // 64 KB
  /** Accepted by most relays */
  common: 128 * 1024, // 128 KB
  /** Accepted by generous relays only */
  generous: 256 * 1024, // 256 KB
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Byte length of a UTF-8 string */
function utf8Bytes(str: string): number {
  // TextEncoder gives an accurate UTF-8 byte count
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Fallback (approximate)
  return unescape(encodeURIComponent(str)).length;
}

function verdictFor(byteSize: number): SizeVerdict {
  if (byteSize <= RELAY_THRESHOLDS.universal) {
    return {
      level: 'great',
      title: 'Accepted everywhere',
      detail: 'Under 64 KB — comfortably within the limits of virtually all relays.',
    };
  }
  if (byteSize <= RELAY_THRESHOLDS.common) {
    return {
      level: 'ok',
      title: 'Accepted by most relays',
      detail: 'Between 64–128 KB. Most relays accept this, though a few strict ones may reject it.',
    };
  }
  if (byteSize <= RELAY_THRESHOLDS.generous) {
    return {
      level: 'caution',
      title: 'May be rejected by some relays',
      detail: 'Between 128–256 KB. Generous relays accept this, but many default configs cap below it.',
    };
  }
  return {
    level: 'risky',
    title: 'Likely rejected by many relays',
    detail: 'Over 256 KB. Consider splitting the deck or reducing text. Images don\u2019t count — they\u2019re hosted on Blossom by URL.',
  };
}

/**
 * Estimate the size of the published Nostr event for a presentation.
 * Mirrors the tags/content built in usePublishPresentation, plus the
 * fixed overhead of id, pubkey, sig, created_at, and JSON structure.
 */
export function computePresentationStats(params: {
  slides: Slide[];
  theme: Theme;
  title: string;
  summary?: string;
  image?: string;
  topics?: string[];
}): PresentationStats {
  const { slides, theme, title, summary, image, topics = [] } = params;

  // Element tallies
  let textCount = 0;
  let imageCount = 0;
  let shapeCount = 0;
  const mediaUrls = new Set<string>();

  for (const slide of slides) {
    for (const el of slide.elements ?? []) {
      if (el.type === 'text') textCount++;
      else if (el.type === 'image') {
        imageCount++;
        if (el.src?.startsWith('http')) mediaUrls.add(el.src);
      } else if (el.type === 'shape') shapeCount++;
    }
    if (slide.background?.startsWith('http')) mediaUrls.add(slide.background);
  }
  if (image?.startsWith('http')) mediaUrls.add(image);

  const elementCount = textCount + imageCount + shapeCount;
  const durationSeconds = calculateTotalDuration(slides);

  // Serialize content exactly as the publisher does
  const content: PresentationContent = { slides, theme };
  const contentStr = JSON.stringify(content);

  // Tags as built by usePublishPresentation
  const tags: string[][] = [
    ['d', 'xxxxxxxxxxxx'],
    ['title', title],
    ['duration', durationSeconds.toString()],
    ['alt', `Slide presentation: ${title} (${formatDuration(durationSeconds)})`],
  ];
  if (image) tags.push(['image', image]);
  if (summary) tags.push(['summary', summary]);
  for (const t of topics) tags.push(['t', t.toLowerCase().trim()]);
  tags.push(['client', 'nostr-point']);

  const tagsStr = JSON.stringify(tags);

  // Fixed overhead: id (64) + pubkey (64) + sig (128) + created_at + kind +
  // JSON field names/braces. ~320 bytes is a safe estimate.
  const overhead = 320;

  const byteSize = utf8Bytes(contentStr) + utf8Bytes(tagsStr) + overhead;

  return {
    slideCount: slides.length,
    elementCount,
    textCount,
    imageCount,
    shapeCount,
    mediaCount: mediaUrls.size,
    durationSeconds,
    durationLabel: formatDuration(durationSeconds),
    byteSize,
    sizeLabel: formatBytes(byteSize),
    verdict: verdictFor(byteSize),
  };
}
