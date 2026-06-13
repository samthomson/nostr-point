import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useNostrPublish } from './useNostrPublish';
import { 
  PRESENTATION_KIND, 
  type Slide, 
  type Theme,
  type PresentationContent,
  calculateTotalDuration,
  formatDuration,
  parsePresentation,
} from '@/lib/types';

interface PublishPresentationParams {
  /** Unique identifier/slug */
  identifier: string;
  /** Presentation title */
  title: string;
  /** Slides array */
  slides: Slide[];
  /** Presentation-wide theme */
  theme: Theme;
  /** Cover image URL */
  image?: string;
  /** Brief description */
  summary?: string;
  /** Topic tags */
  topics?: string[];
}

export function usePublishPresentation() {
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: PublishPresentationParams) => {
      const { identifier, title, slides, theme, image, summary, topics = [] } = params;
      
      const content: PresentationContent = { slides, theme };
      const totalDuration = calculateTotalDuration(slides);
      
      const tags: string[][] = [
        ['d', identifier],
        ['title', title],
        ['duration', totalDuration.toString()],
        ['alt', `Slide presentation: ${title} (${formatDuration(totalDuration)})`],
      ];
      
      if (image) {
        tags.push(['image', image]);
      }
      
      if (summary) {
        tags.push(['summary', summary]);
      }
      
      for (const topic of topics) {
        tags.push(['t', topic.toLowerCase().trim()]);
      }
      
      const event = await publish({
        kind: PRESENTATION_KIND,
        content: JSON.stringify(content),
        tags,
      });
      
      return { event, identifier };
    },
    onSuccess: ({ event, identifier }) => {
      // Pre-populate the query cache with the published event
      // This ensures the viewer page can display it immediately without waiting for relay
      const presentation = parsePresentation(event);
      if (presentation) {
        queryClient.setQueryData(
          ['presentation', event.pubkey, identifier],
          presentation
        );
      }
      
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
      queryClient.invalidateQueries({ queryKey: ['my-presentations'] });
    },
  });
}
