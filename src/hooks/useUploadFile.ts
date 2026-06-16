import { useMutation } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useAppContext } from "./useAppContext";
import { getEffectiveBlossomServers } from "@/lib/appBlossom";

/** Result of a successful upload */
export interface UploadResult {
  /** NIP-94-style tags (includes the ['url', ...] tag) */
  tags: string[][];
  /** The server host the file was actually uploaded to (e.g. "bs.samt.st") */
  serverHost: string;
  /** The full server base URL used */
  serverUrl: string;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Uploads files to Blossom servers, trying the user's configured servers in
 * PRIORITY order. The first server is the intended home; we only fall through
 * to the next server on an actual failure (connection/HTTP error) — we never
 * race servers. The returned URL points to whichever server actually accepted
 * the blob, so it reflects where the file really lives.
 */
export function useUploadFile() {
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation<UploadResult, Error, File>({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error("Must be logged in to upload files");
      }

      const servers = getEffectiveBlossomServers(
        config.blossomServerMetadata,
        config.useAppBlossomServers,
      );

      if (servers.length === 0) {
        throw new Error("No Blossom servers configured. Add one in Settings → Media Servers.");
      }

      const buffer = await file.arrayBuffer();
      const hash = await sha256Hex(buffer);

      // BUD-02 upload authorization event (kind 24242)
      const now = Math.floor(Date.now() / 1000);
      const authEvent = await user.signer.signEvent({
        kind: 24242,
        content: `Upload ${file.name}`,
        created_at: now,
        tags: [
          ["t", "upload"],
          ["x", hash],
          ["expiration", String(now + 60 * 5)],
        ],
      });
      const authHeader = `Nostr ${btoa(JSON.stringify(authEvent))}`;

      const errors: string[] = [];

      // Try each server in priority order; only advance on actual failure.
      for (const server of servers) {
        const base = normalizeBase(server);
        try {
          const res = await fetch(`${base}/upload`, {
            method: "PUT",
            headers: {
              Authorization: authHeader,
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!res.ok) {
            errors.push(`${base}: HTTP ${res.status}`);
            continue;
          }

          // Blossom returns a blob descriptor JSON with a `url` field
          const descriptor = await res.json().catch(() => null);
          const url: string | undefined =
            descriptor?.url ||
            (descriptor?.sha256 ? `${base}/${descriptor.sha256}` : `${base}/${hash}`);

          if (!url) {
            errors.push(`${base}: no URL in response`);
            continue;
          }

          const tags: string[][] = [
            ["url", url],
            ["x", descriptor?.sha256 || hash],
          ];
          if (descriptor?.size || file.size) {
            tags.push(["size", String(descriptor?.size ?? file.size)]);
          }
          if (file.type) {
            tags.push(["m", file.type]);
          }

          let serverHost = base;
          try {
            serverHost = new URL(base).host;
          } catch {
            // keep base
          }

          return { tags, serverHost, serverUrl: base };
        } catch (err) {
          errors.push(`${base}: ${err instanceof Error ? err.message : "failed"}`);
          // fall through to next server
        }
      }

      throw new Error(
        `Upload failed on all ${servers.length} server(s). ${errors.join("; ")}`,
      );
    },
  });
}
