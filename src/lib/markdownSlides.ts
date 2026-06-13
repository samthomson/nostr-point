import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  generateElementId,
  type Slide,
  type SlideElement,
} from './types';

/**
 * Convert a markdown document into slides.
 *
 * Conventions (reveal.js / Marp style):
 * - Slides are separated by a line containing only `---`
 * - `# Heading` lines become heading text elements
 * - `![alt](url)` image lines become image elements
 * - `Note:` / `Notes:` lines (and everything after) become speaker notes
 * - `<!-- duration: 90 -->` sets the slide duration in seconds
 * - Everything else is body text
 *
 * Auto-layout: heading at top, body below, image to the side/below.
 */
export function markdownToSlides(markdown: string): Slide[] {
  const slideChunks = markdown
    .split(/^\s*---\s*$/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (slideChunks.length === 0) {
    return [];
  }

  return slideChunks.map(parseSlideChunk);
}

const IMAGE_RE = /^!\[[^\]]*\]\(([^)]+)\)\s*$/;
const NOTE_RE = /^notes?:\s*(.*)$/i;
const DURATION_RE = /^<!--\s*duration:\s*(\d+)\s*-->\s*$/i;

function parseSlideChunk(chunk: string): Slide {
  const lines = chunk.split('\n');

  const headingLines: string[] = [];
  const bodyLines: string[] = [];
  const noteLines: string[] = [];
  const imageUrls: string[] = [];
  let duration = 60;
  let inNotes = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const durationMatch = trimmed.match(DURATION_RE);
    if (durationMatch) {
      duration = parseInt(durationMatch[1], 10);
      continue;
    }

    const noteMatch = trimmed.match(NOTE_RE);
    if (noteMatch) {
      inNotes = true;
      if (noteMatch[1]) noteLines.push(noteMatch[1]);
      continue;
    }

    if (inNotes) {
      noteLines.push(line);
      continue;
    }

    const imageMatch = trimmed.match(IMAGE_RE);
    if (imageMatch) {
      imageUrls.push(imageMatch[1]);
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed) && headingLines.length === 0 && bodyLines.length === 0) {
      headingLines.push(trimmed);
      continue;
    }

    bodyLines.push(line);
  }

  const heading = headingLines.join('\n').trim();
  const body = bodyLines.join('\n').trim();
  const notes = noteLines.join('\n').trim();

  const elements: SlideElement[] = [];
  const hasImage = imageUrls.length > 0;
  const isTitleOnly = heading && !body && !hasImage;

  if (isTitleOnly) {
    // Centered title slide
    elements.push({
      id: generateElementId(),
      type: 'text',
      x: 80, y: 280, width: 1120, height: 160,
      content: heading,
      fontSize: 72,
      align: 'center',
      heading: true,
    });
  } else {
    let cursorY = 60;

    if (heading) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 60, y: cursorY, width: 1160, height: 100,
        content: heading,
        fontSize: 48,
        align: 'left',
        heading: true,
      });
      cursorY += 130;
    }

    if (hasImage && body) {
      // Body left, image right
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 60, y: cursorY, width: 580, height: CANVAS_HEIGHT - cursorY - 60,
        content: body,
        fontSize: 28,
      });
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 680, y: cursorY, width: 540, height: CANVAS_HEIGHT - cursorY - 60,
        src: imageUrls[0],
        fit: 'contain',
      });
    } else if (hasImage) {
      // Image fills the remaining space
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 160, y: cursorY, width: 960, height: CANVAS_HEIGHT - cursorY - 60,
        src: imageUrls[0],
        fit: 'contain',
      });
    } else if (body) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 60, y: cursorY, width: 1160, height: CANVAS_HEIGHT - cursorY - 60,
        content: body,
        fontSize: 28,
      });
    }

    // Extra images stacked (rare) — append below as additional image elements
    for (let i = 1; i < imageUrls.length; i++) {
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 60 + (i - 1) * 60, y: cursorY + 40, width: 400, height: 260,
        src: imageUrls[i],
        fit: 'contain',
      });
    }
  }

  return {
    elements,
    duration,
    notes: notes || undefined,
  };
}

/**
 * Convert slides back into markdown. This is a best-effort serialization
 * (round-tripping is approximate since the canvas has more expressive power
 * than markdown). Used to populate the markdown editor from existing slides.
 */
export function slidesToMarkdown(slides: Slide[]): string {
  return slides
    .map((slide) => {
      const parts: string[] = [];
      const elements = (slide.elements ?? [])
        .slice()
        .sort((a, b) => a.y - b.y);

      for (const el of elements) {
        if (el.type === 'text' && el.content) {
          parts.push(el.content.trim());
        } else if (el.type === 'image' && el.src) {
          parts.push(`![](${el.src})`);
        }
      }

      if (slide.duration && slide.duration !== 60) {
        parts.push(`<!-- duration: ${slide.duration} -->`);
      }

      if (slide.notes) {
        parts.push(`Note: ${slide.notes}`);
      }

      return parts.join('\n\n');
    })
    .join('\n\n---\n\n');
}
