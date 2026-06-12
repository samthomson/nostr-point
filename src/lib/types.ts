import type { NostrEvent } from '@nostrify/nostrify';

/** Kind number for slide presentations */
export const PRESENTATION_KIND = 36387;

/** Virtual canvas dimensions - all element coordinates are in this space */
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** Legacy layout options (v1 slides, migrated on parse) */
export type SlideLayout = 'default' | 'title' | 'image-left' | 'image-right' | 'image-full';

/** Element types that can be placed on a slide canvas */
export type ElementType = 'text' | 'image' | 'shape';

/** Shape variants */
export type ShapeKind = 'rect' | 'ellipse' | 'line';

/** A single positioned element on a slide canvas */
export interface SlideElement {
  /** Unique id within the slide */
  id: string;
  /** Element type */
  type: ElementType;
  /** Position and size in canvas units (1280x720 space) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees */
  rotation?: number;
  /** Stacking order (higher = on top) */
  zIndex?: number;
  /** Opacity 0-1 */
  opacity?: number;

  // Text element properties
  /** Markdown content (text elements) */
  content?: string;
  /** Font size in canvas units */
  fontSize?: number;
  /** Text color (hex) */
  color?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Bold text */
  bold?: boolean;

  // Image element properties
  /** Image URL (image elements) */
  src?: string;
  /** Object fit for images */
  fit?: 'contain' | 'cover' | 'fill';

  // Shape element properties
  /** Shape kind (shape elements) */
  shape?: ShapeKind;
  /** Fill color (hex) */
  fill?: string;
  /** Border radius for rects, in canvas units */
  radius?: number;
}

/** A single slide in a presentation */
export interface Slide {
  /** Canvas elements (v2 format) */
  elements?: SlideElement[];
  /** Planned duration in seconds */
  duration: number;
  /** Background color (hex) or image URL */
  background?: string;
  /** Speaker notes (not shown to audience) */
  notes?: string;

  // Legacy v1 fields (migrated to elements on parse)
  /** @deprecated v1: Slide title */
  title?: string;
  /** @deprecated v1: Markdown content */
  content?: string;
  /** @deprecated v1: Image URL */
  image?: string;
  /** @deprecated v1: Layout */
  layout?: SlideLayout;
}

/** Content structure stored in the event's content field */
export interface PresentationContent {
  slides: Slide[];
}

/** Parsed presentation with metadata from tags */
export interface Presentation {
  /** The raw Nostr event */
  event: NostrEvent;
  /** Unique identifier (d tag) */
  id: string;
  /** Presentation title */
  title: string;
  /** Cover/thumbnail image URL */
  image?: string;
  /** Brief description */
  summary?: string;
  /** Total duration in seconds */
  duration: number;
  /** Topic tags */
  topics: string[];
  /** Parsed slides */
  slides: Slide[];
  /** Author pubkey */
  pubkey: string;
  /** Created/updated timestamp */
  createdAt: number;
}

/** Generate a unique element id */
export function generateElementId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Migrate a legacy v1 slide (title/content/image/layout) to v2 elements.
 * Returns the slide unchanged if it already has elements.
 */
export function migrateSlide(slide: Slide): Slide {
  if (slide.elements && slide.elements.length > 0) {
    return slide;
  }

  const elements: SlideElement[] = [];
  const layout = slide.layout ?? 'default';
  const hasImage = Boolean(slide.image);

  if (layout === 'title') {
    if (slide.title) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 80, y: 240, width: 1120, height: 140,
        content: `# ${slide.title}`,
        fontSize: 72,
        align: 'center',
      });
    }
    if (slide.content) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 160, y: 400, width: 960, height: 200,
        content: slide.content,
        fontSize: 32,
        align: 'center',
      });
    }
  } else {
    if (slide.title) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 60, y: 40, width: 1160, height: 90,
        content: `## ${slide.title}`,
        fontSize: 48,
        align: 'left',
      });
    }

    const contentY = slide.title ? 160 : 60;
    const contentHeight = CANVAS_HEIGHT - contentY - 60;

    if (layout === 'image-full' && hasImage) {
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 160, y: contentY, width: 960, height: contentHeight,
        src: slide.image,
        fit: 'contain',
      });
      if (slide.content) {
        elements.push({
          id: generateElementId(),
          type: 'text',
          x: 160, y: CANVAS_HEIGHT - 100, width: 960, height: 80,
          content: slide.content,
          fontSize: 24,
          align: 'center',
        });
      }
    } else if (hasImage && (layout === 'image-left')) {
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 60, y: contentY, width: 520, height: contentHeight,
        src: slide.image,
        fit: 'contain',
      });
      if (slide.content) {
        elements.push({
          id: generateElementId(),
          type: 'text',
          x: 640, y: contentY, width: 580, height: contentHeight,
          content: slide.content,
          fontSize: 28,
        });
      }
    } else if (hasImage) {
      // default / image-right
      if (slide.content) {
        elements.push({
          id: generateElementId(),
          type: 'text',
          x: 60, y: contentY, width: 580, height: contentHeight,
          content: slide.content,
          fontSize: 28,
        });
      }
      elements.push({
        id: generateElementId(),
        type: 'image',
        x: 700, y: contentY, width: 520, height: contentHeight,
        src: slide.image,
        fit: 'contain',
      });
    } else if (slide.content) {
      elements.push({
        id: generateElementId(),
        type: 'text',
        x: 60, y: contentY, width: 1160, height: contentHeight,
        content: slide.content,
        fontSize: 28,
      });
    }
  }

  return {
    elements,
    duration: slide.duration,
    background: slide.background,
    notes: slide.notes,
  };
}

/** Parse a Nostr event into a Presentation object */
export function parsePresentation(event: NostrEvent): Presentation | null {
  if (event.kind !== PRESENTATION_KIND) {
    return null;
  }

  try {
    const content: PresentationContent = JSON.parse(event.content);

    const getTag = (name: string): string | undefined =>
      event.tags.find(([n]) => n === name)?.[1];

    const getTags = (name: string): string[] =>
      event.tags.filter(([n]) => n === name).map(([, v]) => v);

    const id = getTag('d');
    const title = getTag('title');

    if (!id || !title) {
      return null;
    }

    const durationTag = getTag('duration');
    const duration = durationTag ? parseInt(durationTag, 10) :
      content.slides.reduce((sum, s) => sum + s.duration, 0);

    return {
      event,
      id,
      title,
      image: getTag('image'),
      summary: getTag('summary'),
      duration,
      topics: getTags('t'),
      slides: content.slides.map(migrateSlide),
      pubkey: event.pubkey,
      createdAt: event.created_at,
    };
  } catch {
    return null;
  }
}

/** Create a new empty slide */
export function createEmptySlide(): Slide {
  return {
    elements: [],
    duration: 60, // Default 1 minute
  };
}

/** Create a new text element with sensible defaults */
export function createTextElement(partial?: Partial<SlideElement>): SlideElement {
  return {
    id: generateElementId(),
    type: 'text',
    x: 240, y: 280, width: 800, height: 160,
    content: 'New text',
    fontSize: 32,
    align: 'left',
    ...partial,
  };
}

/** Create a new image element with sensible defaults */
export function createImageElement(src: string, partial?: Partial<SlideElement>): SlideElement {
  return {
    id: generateElementId(),
    type: 'image',
    x: 340, y: 160, width: 600, height: 400,
    src,
    fit: 'contain',
    ...partial,
  };
}

/** Create a new shape element with sensible defaults */
export function createShapeElement(shape: ShapeKind, partial?: Partial<SlideElement>): SlideElement {
  return {
    id: generateElementId(),
    type: 'shape',
    x: 440, y: 230, width: 400, height: 260,
    shape,
    fill: '#3b82f6',
    ...partial,
  };
}

/** Create a new empty presentation content */
export function createEmptyPresentationContent(): PresentationContent {
  return {
    slides: [
      {
        elements: [
          createTextElement({
            x: 80, y: 250, width: 1120, height: 140,
            content: '# Your Presentation Title',
            fontSize: 72,
            align: 'center',
          }),
          createTextElement({
            x: 240, y: 420, width: 800, height: 80,
            content: 'Click to edit',
            fontSize: 32,
            align: 'center',
            color: '#94a3b8',
          }),
        ],
        duration: 60,
      },
    ],
  };
}

/** Format duration in seconds to human-readable string */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  if (secs === 0) {
    return `${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

/** Format duration as MM:SS */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Calculate total duration of all slides */
export function calculateTotalDuration(slides: Slide[]): number {
  return slides.reduce((sum, slide) => sum + slide.duration, 0);
}

/** Calculate expected progress at a given elapsed time */
export function calculateExpectedSlideIndex(slides: Slide[], elapsedSeconds: number): {
  slideIndex: number;
  slideProgress: number;
  expectedTime: number;
} {
  let accumulatedTime = 0;

  for (let i = 0; i < slides.length; i++) {
    const slideEnd = accumulatedTime + slides[i].duration;

    if (elapsedSeconds < slideEnd) {
      const slideProgress = (elapsedSeconds - accumulatedTime) / slides[i].duration;
      return {
        slideIndex: i,
        slideProgress: Math.min(1, Math.max(0, slideProgress)),
        expectedTime: accumulatedTime,
      };
    }

    accumulatedTime = slideEnd;
  }

  // Past the end
  return {
    slideIndex: slides.length - 1,
    slideProgress: 1,
    expectedTime: accumulatedTime,
  };
}

/** Get the expected elapsed time for a given slide index */
export function getExpectedTimeForSlide(slides: Slide[], slideIndex: number): number {
  return slides.slice(0, slideIndex).reduce((sum, s) => sum + s.duration, 0);
}

/** Get a short text summary of a slide (for thumbnails/lists) */
export function getSlideLabel(slide: Slide, index: number): string {
  const firstText = slide.elements?.find(el => el.type === 'text' && el.content);
  if (firstText?.content) {
    // Strip markdown heading markers
    const text = firstText.content.replace(/^#+\s*/, '').split('\n')[0];
    if (text.trim()) return text.trim().slice(0, 40);
  }
  return `Slide ${index + 1}`;
}
