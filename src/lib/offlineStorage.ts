import type { NostrEvent } from '@nostrify/nostrify';
import type { Presentation } from './types';
import { parsePresentation } from './types';

const DB_NAME = 'nostr-slides';
const DB_VERSION = 1;
const PRESENTATIONS_STORE = 'presentations';
const MEDIA_STORE = 'media';

/** Open the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for presentation events, keyed by naddr-like key
      if (!db.objectStoreNames.contains(PRESENTATIONS_STORE)) {
        db.createObjectStore(PRESENTATIONS_STORE, { keyPath: 'key' });
      }
      
      // Store for cached media blobs, keyed by URL
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'url' });
      }
    };
  });
}

/** Generate a unique key for a presentation */
function getPresentationKey(pubkey: string, identifier: string): string {
  return `${pubkey}:${identifier}`;
}

/** Save a presentation event to IndexedDB */
export async function savePresentationOffline(event: NostrEvent, identifier: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PRESENTATIONS_STORE, 'readwrite');
  const store = tx.objectStore(PRESENTATIONS_STORE);
  
  const key = getPresentationKey(event.pubkey, identifier);
  
  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      key,
      event,
      identifier,
      cachedAt: Date.now(),
    });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  
  db.close();
}

/** Load a presentation from IndexedDB */
export async function loadPresentationOffline(pubkey: string, identifier: string): Promise<Presentation | null> {
  const db = await openDB();
  const tx = db.transaction(PRESENTATIONS_STORE, 'readonly');
  const store = tx.objectStore(PRESENTATIONS_STORE);
  
  const key = getPresentationKey(pubkey, identifier);
  
  const result = await new Promise<{ event: NostrEvent } | undefined>((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  
  db.close();
  
  if (!result) return null;
  return parsePresentation(result.event);
}

/** Get all cached presentations */
export async function getAllCachedPresentations(): Promise<Presentation[]> {
  const db = await openDB();
  const tx = db.transaction(PRESENTATIONS_STORE, 'readonly');
  const store = tx.objectStore(PRESENTATIONS_STORE);
  
  const results = await new Promise<Array<{ event: NostrEvent }>>((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  
  db.close();
  
  return results
    .map(r => parsePresentation(r.event))
    .filter((p): p is Presentation => p !== null);
}

/** Check if a presentation is cached */
export async function isPresentationCached(pubkey: string, identifier: string): Promise<boolean> {
  const presentation = await loadPresentationOffline(pubkey, identifier);
  return presentation !== null;
}

/** Delete a cached presentation */
export async function deleteCachedPresentation(pubkey: string, identifier: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PRESENTATIONS_STORE, 'readwrite');
  const store = tx.objectStore(PRESENTATIONS_STORE);
  
  const key = getPresentationKey(pubkey, identifier);
  
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
  
  db.close();
}

/** Cache a media file (image) by URL */
export async function cacheMedia(url: string): Promise<void> {
  try {
    // Fetch the media
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    const db = await openDB();
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        url,
        blob,
        cachedAt: Date.now(),
      });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
    
    db.close();
  } catch (error) {
    console.error(`Failed to cache media: ${url}`, error);
    throw error;
  }
}

/** Get a cached media file */
export async function getCachedMedia(url: string): Promise<Blob | null> {
  const db = await openDB();
  const tx = db.transaction(MEDIA_STORE, 'readonly');
  const store = tx.objectStore(MEDIA_STORE);
  
  const result = await new Promise<{ blob: Blob } | undefined>((resolve, reject) => {
    const request = store.get(url);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  
  db.close();
  
  return result?.blob ?? null;
}

/** Check if media is cached */
export async function isMediaCached(url: string): Promise<boolean> {
  const blob = await getCachedMedia(url);
  return blob !== null;
}

/** Get a URL for cached media (creates object URL from blob) */
export async function getCachedMediaUrl(url: string): Promise<string | null> {
  const blob = await getCachedMedia(url);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** Extract all media URLs from a presentation */
export function extractMediaUrls(presentation: Presentation): string[] {
  const urls: string[] = [];
  
  // Cover image
  if (presentation.image) {
    urls.push(presentation.image);
  }
  
  // Slide images and backgrounds
  for (const slide of presentation.slides) {
    if (slide.image) {
      urls.push(slide.image);
    }
    if (slide.background && slide.background.startsWith('http')) {
      urls.push(slide.background);
    }
  }
  
  return [...new Set(urls)]; // Deduplicate
}

/** Cache a presentation and all its media for offline use */
export async function cachePresentationForOffline(
  presentation: Presentation,
  onProgress?: (cached: number, total: number) => void
): Promise<{ success: boolean; failedUrls: string[] }> {
  // Save the event
  await savePresentationOffline(presentation.event, presentation.id);
  
  // Extract and cache all media
  const urls = extractMediaUrls(presentation);
  const failedUrls: string[] = [];
  
  for (let i = 0; i < urls.length; i++) {
    try {
      await cacheMedia(urls[i]);
    } catch {
      failedUrls.push(urls[i]);
    }
    onProgress?.(i + 1, urls.length);
  }
  
  return {
    success: failedUrls.length === 0,
    failedUrls,
  };
}

/** Get offline status for a presentation */
export async function getOfflineStatus(pubkey: string, identifier: string): Promise<{
  eventCached: boolean;
  mediaCached: number;
  mediaTotal: number;
  fullyOffline: boolean;
}> {
  const presentation = await loadPresentationOffline(pubkey, identifier);
  
  if (!presentation) {
    return {
      eventCached: false,
      mediaCached: 0,
      mediaTotal: 0,
      fullyOffline: false,
    };
  }
  
  const urls = extractMediaUrls(presentation);
  let mediaCached = 0;
  
  for (const url of urls) {
    if (await isMediaCached(url)) {
      mediaCached++;
    }
  }
  
  return {
    eventCached: true,
    mediaCached,
    mediaTotal: urls.length,
    fullyOffline: mediaCached === urls.length,
  };
}
