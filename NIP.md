# Nostr Slides - Custom Event Kinds

This document describes the custom Nostr event kinds used by the Nostr Slides application.

## Kind 36387: Slide Presentation

An addressable event representing a slide presentation with timed slides.

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

### Content Schema

The `content` field contains a JSON-encoded object with the following structure:

```typescript
interface PresentationContent {
  slides: Slide[];
}

interface Slide {
  // Content
  title?: string;              // Slide title
  content?: string;            // Markdown content
  image?: string;              // Image/meme URL (Blossom or external)
  
  // Timing
  duration: number;            // Planned duration in seconds
  
  // Optional styling
  layout?: 'default' | 'title' | 'image-left' | 'image-right' | 'image-full';
  background?: string;         // Background color or image URL
  notes?: string;              // Speaker notes (not shown to audience)
}
```

### Required Tags

| Tag | Description |
|-----|-------------|
| `d` | Unique identifier/slug for the presentation (addressable) |
| `title` | Human-readable presentation title |
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
  "created_at": 1717847200,
  "content": "{\"slides\":[{\"title\":\"Welcome\",\"content\":\"# Introduction to Nostr\\n\\nA decentralized social protocol\",\"duration\":60},{\"title\":\"Why Nostr?\",\"content\":\"- Censorship resistant\\n- User-owned identity\\n- Interoperable\",\"image\":\"https://blossom.example/abc123.jpg\",\"duration\":120,\"notes\":\"Mention the Twitter exodus\"},{\"title\":\"Questions?\",\"content\":\"# Thank You!\\n\\nFind me on Nostr\",\"layout\":\"title\",\"duration\":60}]}",
  "tags": [
    ["d", "intro-to-nostr-2026"],
    ["title", "Introduction to Nostr"],
    ["image", "https://blossom.example/cover.jpg"],
    ["summary", "A 4-minute introduction to the Nostr protocol for beginners"],
    ["duration", "240"],
    ["t", "nostr"],
    ["t", "presentation"],
    ["t", "tutorial"],
    ["alt", "Slide presentation: Introduction to Nostr (4 min)"]
  ],
  "id": "...",
  "sig": "..."
}
```

### Slide Layouts

| Layout | Description |
|--------|-------------|
| `default` | Title at top, content below, image on right (if present) |
| `title` | Centered title slide, large text |
| `image-left` | Image on left, content on right |
| `image-right` | Content on left, image on right |
| `image-full` | Full-screen background image with text overlay |

### Presenter Mode

This kind is designed to support presenter mode with timing assistance:

1. Each slide has a `duration` field indicating planned time
2. The `duration` tag contains the total presentation time
3. Clients can show progress bars comparing:
   - **Expected progress**: Based on slide durations
   - **Actual progress**: Based on elapsed time
4. Speaker `notes` are shown only in presenter view, not audience view

### Offline Support

Clients implementing this kind SHOULD support offline caching:

1. Cache the presentation event in IndexedDB
2. Pre-fetch and cache all referenced media URLs (images, backgrounds)
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
naddr1<...kind=36387&pubkey=...&d=intro-to-nostr-2026...>
```

This allows sharing direct links to presentations that work across clients.
