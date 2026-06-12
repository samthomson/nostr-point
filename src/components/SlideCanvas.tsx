import { useRef, useState, useCallback, useEffect } from 'react';

import { ElementRenderer, useCanvasScale, useSlideBackground } from '@/components/SlideRenderer';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type Slide,
  type SlideElement,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface SlideCanvasProps {
  slide: Slide;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (elements: SlideElement[]) => void;
  onEditText: (id: string) => void;
}

type DragMode =
  | { kind: 'move'; startX: number; startY: number; origX: number; origY: number }
  | {
      kind: 'resize';
      handle: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    };

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

function handlePosition(handle: string, w: number, h: number): { left: number; top: number } {
  const xMap: Record<string, number> = { nw: 0, w: 0, sw: 0, n: w / 2, s: w / 2, ne: w, e: w, se: w };
  const yMap: Record<string, number> = { nw: 0, n: 0, ne: 0, w: h / 2, e: h / 2, sw: h, s: h, se: h };
  return { left: xMap[handle], top: yMap[handle] };
}

const MIN_SIZE = 24;

/**
 * Editable slide canvas: click to select, drag to move,
 * resize via 8 handles, double-click text to edit.
 */
export function SlideCanvas({ slide, selectedId, onSelect, onChange, onEditText }: SlideCanvasProps) {
  const { containerRef, scale } = useCanvasScale();
  const backgroundStyle = useSlideBackground(slide);
  const dragRef = useRef<DragMode | null>(null);
  const elementsRef = useRef<SlideElement[]>(slide.elements ?? []);
  const [isDragging, setIsDragging] = useState(false);

  // Keep ref in sync with prop
  useEffect(() => {
    elementsRef.current = slide.elements ?? [];
  }, [slide.elements]);

  const elements = slide.elements ?? [];
  const hasCustomBackground = Boolean(slide.background);
  const selected = elements.find(el => el.id === selectedId);

  const updateElement = useCallback((id: string, updates: Partial<SlideElement>) => {
    const next = elementsRef.current.map(el =>
      el.id === id ? { ...el, ...updates } : el
    );
    elementsRef.current = next;
    onChange(next);
  }, [onChange]);

  const startMove = useCallback((e: React.PointerEvent, element: SlideElement) => {
    e.stopPropagation();
    onSelect(element.id);
    dragRef.current = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
    };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [onSelect]);

  const startResize = useCallback((e: React.PointerEvent, element: SlideElement, handle: string) => {
    e.stopPropagation();
    dragRef.current = {
      kind: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
      origW: element.width,
      origH: element.height,
    };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !selectedId) return;

    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;

    if (drag.kind === 'move') {
      updateElement(selectedId, {
        x: Math.round(drag.origX + dx),
        y: Math.round(drag.origY + dy),
      });
    } else {
      let { origX: x, origY: y, origW: w, origH: h } = drag;
      const hd = drag.handle;

      if (hd.includes('e')) w = drag.origW + dx;
      if (hd.includes('s')) h = drag.origH + dy;
      if (hd.includes('w')) { w = drag.origW - dx; x = drag.origX + dx; }
      if (hd.includes('n')) { h = drag.origH - dy; y = drag.origY + dy; }

      if (w < MIN_SIZE) { if (hd.includes('w')) x -= MIN_SIZE - w; w = MIN_SIZE; }
      if (h < MIN_SIZE) { if (hd.includes('n')) y -= MIN_SIZE - h; h = MIN_SIZE; }

      updateElement(selectedId, {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
      });
    }
  }, [scale, selectedId, updateElement]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden flex items-center justify-center select-none',
        !hasCustomBackground && 'bg-gradient-to-br from-slate-900 to-slate-800',
      )}
      style={hasCustomBackground ? backgroundStyle : undefined}
      onPointerDown={() => onSelect(null)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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
        {/* Elements with interaction wrappers */}
        {elements.map((element) => (
          <div key={element.id}>
            <ElementRenderer element={element} />
            {/* Interaction overlay */}
            <div
              style={{
                position: 'absolute',
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                zIndex: 1000 + (element.zIndex ?? 0),
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              className={cn(
                'hover:outline hover:outline-2 hover:outline-blue-400/50',
                selectedId === element.id && 'outline outline-2 outline-blue-500',
              )}
              onPointerDown={(e) => startMove(e, element)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (element.type === 'text') {
                  onEditText(element.id);
                }
              }}
            />
          </div>
        ))}

        {/* Resize handles for selected element */}
        {selected && (
          <div
            style={{
              position: 'absolute',
              left: selected.x,
              top: selected.y,
              width: selected.width,
              height: selected.height,
              zIndex: 2000,
              pointerEvents: 'none',
            }}
          >
            {HANDLES.map((handle) => {
              const pos = handlePosition(handle, selected.width, selected.height);
              // Handle size compensated for canvas scale so they stay clickable
              const size = Math.max(12, 12 / scale);
              return (
                <div
                  key={handle}
                  style={{
                    position: 'absolute',
                    left: pos.left - size / 2,
                    top: pos.top - size / 2,
                    width: size,
                    height: size,
                    cursor: HANDLE_CURSORS[handle],
                    pointerEvents: 'auto',
                  }}
                  className="bg-white border-2 border-blue-500 rounded-sm"
                  onPointerDown={(e) => startResize(e, selected, handle)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
