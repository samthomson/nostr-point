import { useMemo } from 'react';

import { useCachedImage } from '@/hooks/useOfflinePresentation';
import { type Slide } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SlideRendererProps {
  slide: Slide;
  showNotes?: boolean;
  className?: string;
}

/** Simple markdown-to-html renderer for slide content */
function renderMarkdown(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-2xl font-semibold mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-3xl font-semibold mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-5xl font-bold mb-4">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^\- (.*$)/gm, '<li class="ml-6">$1</li>')
    // Wrap consecutive li in ul
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-2 text-xl">$&</ul>')
    // Numbered lists
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-6">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function SlideRenderer({ slide, showNotes = false, className }: SlideRendererProps) {
  const { url: imageUrl } = useCachedImage(slide.image);
  const { url: backgroundUrl } = useCachedImage(
    slide.background?.startsWith('http') ? slide.background : undefined
  );
  
  const backgroundStyle = useMemo(() => {
    if (backgroundUrl) {
      return { backgroundImage: `url(${backgroundUrl})` };
    }
    if (slide.background && !slide.background.startsWith('http')) {
      return { backgroundColor: slide.background };
    }
    return {};
  }, [slide.background, backgroundUrl]);
  
  const contentHtml = useMemo(() => {
    if (!slide.content) return '';
    return renderMarkdown(slide.content);
  }, [slide.content]);
  
  const layout = slide.layout ?? 'default';
  
  return (
    <div 
      className={cn(
        'relative w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden',
        className
      )}
      style={backgroundStyle}
    >
      {/* Background overlay for readability when using background image */}
      {(backgroundUrl || slide.background?.startsWith('http')) && (
        <div className="absolute inset-0 bg-black/40 bg-cover bg-center" style={backgroundStyle} />
      )}
      
      <div className="relative z-10 w-full h-full p-8 md:p-12 lg:p-16 flex flex-col">
        {/* Title Slide Layout */}
        {layout === 'title' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {slide.title && (
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6">
                {slide.title}
              </h1>
            )}
            {slide.content && (
              <div 
                className="text-xl md:text-2xl text-white/80 max-w-3xl"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            )}
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt="" 
                className="mt-8 max-h-48 rounded-lg shadow-2xl"
              />
            )}
          </div>
        )}
        
        {/* Default Layout */}
        {layout === 'default' && (
          <>
            {slide.title && (
              <h2 className="text-3xl md:text-4xl font-bold mb-6 flex-shrink-0">
                {slide.title}
              </h2>
            )}
            <div className="flex-1 flex gap-8">
              <div 
                className={cn('flex-1', imageUrl && 'max-w-[60%]')}
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
              {imageUrl && (
                <div className="flex-shrink-0 flex items-center">
                  <img 
                    src={imageUrl} 
                    alt="" 
                    className="max-h-[60vh] max-w-md rounded-lg shadow-2xl object-contain"
                  />
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Image Left Layout */}
        {layout === 'image-left' && (
          <>
            {slide.title && (
              <h2 className="text-3xl md:text-4xl font-bold mb-6 flex-shrink-0">
                {slide.title}
              </h2>
            )}
            <div className="flex-1 flex gap-8">
              {imageUrl && (
                <div className="flex-shrink-0 flex items-center">
                  <img 
                    src={imageUrl} 
                    alt="" 
                    className="max-h-[60vh] max-w-md rounded-lg shadow-2xl object-contain"
                  />
                </div>
              )}
              <div 
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </div>
          </>
        )}
        
        {/* Image Right Layout */}
        {layout === 'image-right' && (
          <>
            {slide.title && (
              <h2 className="text-3xl md:text-4xl font-bold mb-6 flex-shrink-0">
                {slide.title}
              </h2>
            )}
            <div className="flex-1 flex gap-8">
              <div 
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
              {imageUrl && (
                <div className="flex-shrink-0 flex items-center">
                  <img 
                    src={imageUrl} 
                    alt="" 
                    className="max-h-[60vh] max-w-md rounded-lg shadow-2xl object-contain"
                  />
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Full Image Layout */}
        {layout === 'image-full' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt="" 
                className="max-h-[70vh] max-w-full rounded-lg shadow-2xl object-contain"
              />
            )}
            {slide.title && (
              <h2 className="text-2xl md:text-3xl font-bold mt-6 text-center">
                {slide.title}
              </h2>
            )}
            {slide.content && (
              <div 
                className="text-lg text-white/80 mt-2 text-center max-w-2xl"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Speaker Notes (only shown in presenter mode) */}
      {showNotes && slide.notes && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 border-t border-white/20">
          <p className="text-sm text-white/70 italic">{slide.notes}</p>
        </div>
      )}
    </div>
  );
}
