# Nostr Point - Custom Event Kinds

This document describes the custom Nostr event kinds used by the Nostr Point application.

## Kind 36387: Slide Presentation

An addressable event representing a slide presentation with timed slides composed of freely-positioned canvas elements.

### Event Structure

```json
{
  "kind": 36387,
  "content": "<JSON string containing slides array>",
  "tags": [
    ["d", "<unique-presentation-slug>"],
    ["title", "<presentation title>"],
    ["image", "<cover image URL>"],
    ["summary", "<brief description>"],
    ["duration", "<total duration in seconds>"],
    ["t", "<topic tag>"],
    ["alt", "Slide presentation: <title> (<duration>)"]
  ]
}
```

### Content Schema (v2 — canvas elements)

The `content` field contains a JSON-encoded object. Each slide is a free canvas
in a **1280×720 virtual coordinate space**; clients scale this canvas to fit the
display while preserving the aspect ratio.

```typescript
interface PresentationContent {
  slides: Slide[];
}

interface Slide {
  elements?: SlideElement[];   // Positioned canvas elements
  duration: number;            // Planned duration in seconds
  background?: string;         // Background color (hex) or image URL
  notes?: string;              // Speaker notes (not shown to audience)
}

interface SlideElement {
  id: string;                  // Unique id within the slide
  type: 'text' | 'image' | 'shape';

  // Position & size in 1280x720 canvas units
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;           // Degrees
  zIndex?: number;             // Stacking order
  opacity?: number;            // 0-1

  // type: 'text'
  content?: string;            // Markdown (headings, lists, bold, italic)
  fontSize?: number;           // In canvas units
  color?: string;              // Hex color
  align?: 'left' | 'center' | 'right';
  bold?: boolean;

  // type: 'image'
  src?: string;                // Image URL (Blossom or external)
  fit?: 'contain' | 'cover' | 'fill';

  // type: 'shape'
  shape?: 'rect' | 'ellipse' | 'line';
  fill?: string;               // Hex color
  radius?: number;             // Corner radius for rects
}
```

### Legacy v1 Slides

Earlier events may contain v1 slides using fixed layouts:

```typescript
interface SlideV1 {
  title?: string;
  content?: string;            // Markdown
  image?: string;
  duration: number;
  layout?: 'default' | 'title' | 'image-left' | 'image-right' | 'image-full';
  background?: string;
  notes?: string;
}
```

Clients SHOULD migrate v1 slides to v2 elements on read by converting the
title/content/image fields into positioned text and image elements according
to the layout. Nostr Point performs this migration automatically when parsing.

### Required Tags

| Tag | Description |
|-----|-------------|
| `d` | Opaque random identifier for the presentation (addressable). Generated once (e.g. a UUID) and never derived from the title, so the title can change freely without affecting the identifier or its link. |
| `title` | Human-readable presentation title (freely editable) |
| `duration` | Total presentation duration in seconds (sum of all slide durations) |
| `alt` | Human-readable description (NIP-31 compatibility) |

### Optional Tags

| Tag | Description |
|-----|-------------|
| `image` | Cover/thumbnail image URL |
| `summary` | Brief description of the presentation |
| `t` | Topic/hashtag for categorization (can have multiple) |

### Example Event

```json
{
  "kind": 36387,
  "pubkey": "...",
  "created_at": 1780925428,
  "content": "{\"slides\":[{\"elements\":[{\"id\":\"a1b2c3d4\",\"type\":\"text\",\"x\":80,\"y\":250,\"width\":1120,\"height\":140,\"content\":\"# Introduction to Nostr\",\"fontSize\":72,\"align\":\"center\"},{\"id\":\"e5f6g7h8\",\"type\":\"image\",\"x\":340,\"y\":420,\"width\":600,\"height\":240,\"src\":\"https://blossom.example/abc.jpg\",\"fit\":\"contain\"}],\"duration\":60,\"notes\":\"Welcome everyone\"}]}",
  "tags": [
    ["d", "f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    ["title", "Introduction to Nostr"],
    ["summary", "A 1-minute introduction to the Nostr protocol"],
    ["duration", "60"],
    ["t", "nostr"],
    ["alt", "Slide presentation: Introduction to Nostr (1m)"]
  ],
  "id": "...",
  "sig": "..."
}
```

### Presenter Mode

This kind is designed to support presenter mode with timing assistance:

1. Each slide has a `duration` field indicating planned time
2. The `duration` tag contains the total presentation time
3. Clients can show progress bars comparing:
   - **Expected progress**: Based on slide durations
   - **Actual progress**: Based on elapsed time
4. Speaker `notes` are shown only in presenter view, not audience view

### Security Considerations

Presentation events are signed by arbitrary pubkeys. Clients MUST sanitize:

- **All URLs** (`src`, `background`, `image` tag) — only `http(s):` (and
  `blob:` for local caches) should be rendered
- **All color values** (`color`, `fill`, `background`) — only valid CSS color
  literals (hex, rgb(), hsl(), named) should be interpolated into styles
- **Markdown content** — render via a safe parser; never use raw HTML injection

### Offline Support

Clients implementing this kind SHOULD support offline caching:

1. Cache the presentation event in IndexedDB
2. Pre-fetch and cache all referenced media URLs (element images, backgrounds, cover)
3. Allow users to explicitly "download" presentations for offline use
4. Indicate cached/offline-ready status in the UI

### Querying

```typescript
// Get a specific presentation by author and slug
nostr.query([{
  kinds: [36387],
  authors: [pubkey],
  '#d': [slug]
}]);

// Get all presentations by an author
nostr.query([{
  kinds: [36387],
  authors: [pubkey]
}]);

// Get presentations by topic
nostr.query([{
  kinds: [36387],
  '#t': ['nostr']
}]);
```

### Addressing

Presentations can be referenced using NIP-19 `naddr` encoding:

```
naddr1<...kind=36387&pubkey=...&d=f47ac10b-58cc-4372-a567-0e02b2c3d479...>
```

This allows sharing direct links to presentations that work across clients.
