import { useRef, useState, useEffect, useMemo } from 'react';

import { SlideMarkdown } from '@/components/SlideMarkdown';
import { useCachedImage } from '@/hooks/useOfflinePresentation';
import { sanitizeUrl, sanitizeCssColor } from '@/lib/sanitize';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type Slide,
  type SlideElement,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface SlideRendererProps {
  slide: Slide;
  showNotes?: boolean;
  className?: string;
}

/** Renders a single positioned element (read-only) */
export function ElementRenderer({ element }: { element: SlideElement }) {
  const { url: cachedSrc } = useCachedImage(
    element.type === 'image' ? element.src : undefined
  );

  const safeColor = sanitizeCssColor(element.color);
  const safeFill = sanitizeCssColor(element.fill);

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex ?? 0,
    opacity: element.opacity ?? 1,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };

  if (element.type === 'text') {
    return (
      <div
        style={{
          ...baseStyle,
          fontSize: element.fontSize ?? 32,
          color: safeColor ?? '#ffffff',
          textAlign: element.align ?? 'left',
          fontWeight: element.bold ? 700 : undefined,
          overflow: 'hidden',
          lineHeight: 1.35,
        }}
      >
        <SlideMarkdown content={element.content ?? ''} />
      </div>
    );
  }

  if (element.type === 'image') {
    const safeSrc = sanitizeUrl(cachedSrc ?? element.src);
    if (!safeSrc) return null;
    return (
      <img
        src={safeSrc}
        alt=""
        draggable={false}
        style={{
          ...baseStyle,
          objectFit: element.fit ?? 'contain',
        }}
      />
    );
  }

  if (element.type === 'shape') {
    const fill = safeFill ?? '#3b82f6';
    if (element.shape === 'ellipse') {
      return <div style={{ ...baseStyle, backgroundColor: fill, borderRadius: '50%' }} />;
    }
    if (element.shape === 'line') {
      return (
        <div style={baseStyle}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: Math.max(2, Math.min(element.height, 8)),
              transform: 'translateY(-50%)',
              backgroundColor: fill,
            }}
          />
        </div>
      );
    }
    // rect
    return (
      <div
        style={{
          ...baseStyle,
          backgroundColor: fill,
          borderRadius: element.radius ?? 0,
        }}
      />
    );
  }

  return null;
}

/** Hook: scale factor to fit the 1280x720 canvas inside a container */
export function useCanvasScale() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(Math.min(rect.width / CANVAS_WIDTH, rect.height / CANVAS_HEIGHT));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, scale };
}

/** Resolves slide background to a style object (sanitized) */
export function useSlideBackground(slide: Slide): React.CSSProperties {
  const isUrl = slide.background?.startsWith('http');
  const { url: cachedBg } = useCachedImage(isUrl ? slide.background : undefined);

  return useMemo(() => {
    if (isUrl) {
      const safe = sanitizeUrl(cachedBg ?? slide.background);
      if (safe) {
        return {
          backgroundImage: `url("${safe}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      }
      return {};
    }
    const safeColor = sanitizeCssColor(slide.background);
    if (safeColor) {
      return { backgroundColor: safeColor };
    }
    return {};
  }, [isUrl, cachedBg, slide.background]);
}

/**
 * Read-only slide renderer. Renders the 1280x720 canvas scaled to fit
 * its container (maintains aspect ratio).
 */
export function SlideRenderer({ slide, showNotes = false, className }: SlideRendererProps) {
  const { containerRef, scale } = useCanvasScale();
  const backgroundStyle = useSlideBackground(slide);

  const elements = slide.elements ?? [];
  const hasCustomBackground = Boolean(slide.background);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden flex items-center justify-center',
        !hasCustomBackground && 'bg-gradient-to-br from-slate-900 to-slate-800',
        className
      )}
      style={hasCustomBackground ? backgroundStyle : undefined}
    >
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {elements.map((element) => (
          <ElementRenderer key={element.id} element={element} />
        ))}
      </div>

      {/* Speaker Notes (only shown in presenter mode) */}
      {showNotes && slide.notes && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-4 border-t border-white/20 z-50">
          <p className="text-sm text-white/70 italic">{slide.notes}</p>
        </div>
      )}
    </div>
  );
}
