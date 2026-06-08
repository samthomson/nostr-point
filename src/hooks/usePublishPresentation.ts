import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useNostrPublish } from './useNostrPublish';
import { 
  PRESENTATION_KIND, 
  type Slide, 
  type PresentationContent,
  calculateTotalDuration,
  formatDuration,
} from '@/lib/types';

interface PublishPresentationParams {
  /** Unique identifier/slug */
  identifier: string;
  /** Presentation title */
  title: string;
  /** Slides array */
  slides: Slide[];
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
      const { identifier, title, slides, image, summary, topics = [] } = params;
      
      const content: PresentationContent = { slides };
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
      
      return event;
    },
    onSuccess: () => {
      // Invalidate presentations queries to refetch
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
      queryClient.invalidateQueries({ queryKey: ['my-presentations'] });
    },
  });
}
