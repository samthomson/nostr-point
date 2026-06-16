import type { NostrEvent } from "@nostrify/nostrify";
import type { BlossomServerMetadata } from "@/contexts/AppContext";

/** Normalize a Blossom server URL for deduplication (lowercase, strip trailing slashes). */
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, "");
}

/** Parse a kind 10063 Blossom server list event into validated server URLs. */
export function parseBlossomServerList(event: NostrEvent): string[] {
  return event.tags
    .filter(([name]) => name === "server")
    .map(([, url]) => url)
    .filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
}

/**
 * App default Blossom servers used as a fallback when the user has no kind 10063
 * server list, and optionally merged with user servers via `useAppBlossomServers`.
 */
export const APP_BLOSSOM_SERVERS: BlossomServerMetadata = {
  servers: [
    "https://blossom.ditto.pub/",
    "https://blossom.dreamith.to/",
    "https://blossom.primal.net/",
  ],
  updatedAt: 0,
};

/**
 * Get the effective Blossom server list based on user settings, in PRIORITY
 * order (first = most preferred).
 *
 * - The user's own servers always come FIRST (their chosen primary is the
 *   intended home for uploads).
 * - If `useAppBlossomServers` is true, the app's default servers are appended
 *   AFTER the user's servers as fallbacks only.
 * - If `useAppBlossomServers` is false, only the user's servers are used.
 *
 * Uploads should try these in order and only move to the next on actual
 * failure — not race them.
 */
export function getEffectiveBlossomServers(
  userMeta: BlossomServerMetadata,
  useAppBlossomServers: boolean,
): string[] {
  const ordered = useAppBlossomServers
    ? [...userMeta.servers, ...APP_BLOSSOM_SERVERS.servers]
    : userMeta.servers;

  return deduplicateServers(ordered);
}

/** Deduplicate servers by normalized URL, preserving order. */
function deduplicateServers(servers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of servers) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(url);
    }
  }
  return result;
}
