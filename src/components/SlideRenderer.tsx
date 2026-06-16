import { useRef, useState, useEffect, useMemo } from 'react';

import { SlideMarkdown } from '@/components/SlideMarkdown';
import { useCachedImage } from '@/hooks/useOfflinePresentation';
import { sanitizeUrl, sanitizeCssColor } from '@/lib/sanitize';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_THEME,
  FONT_STACKS,
  type Slide,
  type SlideElement,
  type Theme,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface SlideRendererProps {
  slide: Slide;
  theme?: Theme;
  showNotes?: boolean;
  className?: string;
}

/** Renders a single positioned element (read-only), inheriting theme defaults */
export function ElementRenderer({ element, theme }: { element: SlideElement; theme: Theme }) {
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
    // Theme inheritance: explicit element color wins, else heading/body theme color
    const themeColor = element.heading
      ? sanitizeCssColor(theme.headingColor)
      : sanitizeCssColor(theme.textColor);
    const color = safeColor ?? themeColor ?? '#ffffff';
    const fontFamily = FONT_STACKS[element.fontFamily ?? theme.font];

    return (
      <div
        style={{
          ...baseStyle,
          fontSize: element.fontSize ?? 32,
          color,
          fontFamily,
          textAlign: element.align ?? 'left',
          fontWeight: element.bold || element.heading ? 700 : undefined,
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

/**
 * Wraps children in the largest 16:9 box that fits inside the available space,
 * constrained by BOTH width and height. Measures its own bounding box and
 * computes exact pixel dimensions (pure CSS aspect-ratio can't reliably fit
 * within both dimensions inside a flex layout).
 */
export function AspectFit({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const ratio = CANVAS_WIDTH / CANVAS_HEIGHT; // 16:9
      let w = width;
      let h = w / ratio;
      if (h > height) {
        h = height;
        w = h * ratio;
      }
      setBox({ width: Math.floor(w), height: Math.floor(h) });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full h-full flex items-center justify-center min-h-0 min-w-0">
      {box && (
        <div className={className} style={{ width: box.width, height: box.height }}>
          {children}
        </div>
      )}
    </div>
  );
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

/**
 * Resolves slide background to a style object (sanitized).
 * Falls back to the theme background when the slide has no override.
 */
export function useSlideBackground(slide: Slide, theme: Theme): React.CSSProperties {
  const effective = slide.background ?? theme.background;
  const isUrl = effective?.startsWith('http');
  const { url: cachedBg } = useCachedImage(isUrl ? effective : undefined);

  return useMemo(() => {
    if (isUrl) {
      const safe = sanitizeUrl(cachedBg ?? effective);
      if (safe) {
        return {
          backgroundImage: `url("${safe}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      }
      return {};
    }
    const safeColor = sanitizeCssColor(effective);
    if (safeColor) {
      return { backgroundColor: safeColor };
    }
    return {};
  }, [isUrl, cachedBg, effective]);
}

/**
 * Read-only slide renderer. Renders the 1280x720 canvas scaled to fit
 * its container (maintains aspect ratio), applying the presentation theme.
 */
export function SlideRenderer({ slide, theme = DEFAULT_THEME, showNotes = false, className }: SlideRendererProps) {
  const { containerRef, scale } = useCanvasScale();
  const backgroundStyle = useSlideBackground(slide, theme);

  const elements = slide.elements ?? [];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden flex items-center justify-center',
        className
      )}
      style={backgroundStyle}
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
          <ElementRenderer key={element.id} element={element} theme={theme} />
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
