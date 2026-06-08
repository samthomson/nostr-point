import type { NostrEvent } from '@nostrify/nostrify';

/** Kind number for slide presentations */
export const PRESENTATION_KIND = 36387;

/** Layout options for individual slides */
export type SlideLayout = 'default' | 'title' | 'image-left' | 'image-right' | 'image-full';

/** A single slide in a presentation */
export interface Slide {
  /** Slide title */
  title?: string;
  /** Markdown content */
  content?: string;
  /** Image/meme URL */
  image?: string;
  /** Planned duration in seconds */
  duration: number;
  /** Slide layout */
  layout?: SlideLayout;
  /** Background color or image URL */
  background?: string;
  /** Speaker notes (not shown to audience) */
  notes?: string;
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
      slides: content.slides,
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
    title: '',
    content: '',
    duration: 60, // Default 1 minute
    layout: 'default',
  };
}

/** Create a new empty presentation content */
export function createEmptyPresentationContent(): PresentationContent {
  return {
    slides: [
      {
        title: 'Welcome',
        content: '# Your Presentation Title\n\nClick to edit',
        duration: 60,
        layout: 'title',
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
