import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { PRESENTATION_KIND, parsePresentation, type Presentation } from '@/lib/types';

/** Fetch all presentations, optionally filtered by author or topic */
export function usePresentations(options?: { 
  author?: string; 
  topic?: string;
  limit?: number;
}) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['presentations', options?.author, options?.topic, options?.limit],
    queryFn: async (c) => {
      const filter: Record<string, unknown> = {
        kinds: [PRESENTATION_KIND],
        limit: options?.limit ?? 50,
      };
      
      if (options?.author) {
        filter.authors = [options.author];
      }
      
      if (options?.topic) {
        filter['#t'] = [options.topic];
      }
      
      const events = await nostr.query([filter], { signal: c.signal });
      
      return events
        .map(parsePresentation)
        .filter((p): p is Presentation => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}

/** Fetch a single presentation by author and identifier */
export function usePresentation(pubkey: string | undefined, identifier: string | undefined) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['presentation', pubkey, identifier],
    queryFn: async (c) => {
      if (!pubkey || !identifier) return null;
      
      const events = await nostr.query([{
        kinds: [PRESENTATION_KIND],
        authors: [pubkey],
        '#d': [identifier],
        limit: 1,
      }], { signal: c.signal });
      
      if (events.length === 0) return null;
      
      return parsePresentation(events[0]);
    },
    enabled: Boolean(pubkey && identifier),
  });
}

/** Fetch presentations by the current user */
export function useMyPresentations() {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['my-presentations'],
    queryFn: async (c) => {
      // This will be filtered by the current user in the component
      const events = await nostr.query([{
        kinds: [PRESENTATION_KIND],
        limit: 100,
      }], { signal: c.signal });
      
      return events
        .map(parsePresentation)
        .filter((p): p is Presentation => p !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}
