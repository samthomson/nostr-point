import { useState, useEffect, useCallback, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { ChevronLeft, ChevronRight, X, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SlideRenderer } from '@/components/SlideRenderer';
import { usePresentation } from '@/hooks/usePresentations';
import { useOfflinePresentationData } from '@/hooks/useOfflinePresentation';
import { formatTime } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function PresenterMode() {
  const { nip19: nip19Param } = useParams<{ nip19: string }>();
  const navigate = useNavigate();

  // Parse naddr
  const naddrData = nip19Param ? (() => {
    try {
      const decoded = nip19.decode(nip19Param);
      if (decoded.type === 'naddr') {
        return decoded.data;
      }
    } catch {
      // Invalid
    }
    return null;
  })() : null;

  // Try online first, fall back to offline
  const onlinePresentation = usePresentation(naddrData?.pubkey, naddrData?.identifier);
  const offlinePresentation = useOfflinePresentationData(naddrData?.pubkey, naddrData?.identifier);

  const presentation = onlinePresentation.data ?? offlinePresentation.data;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useSeoMeta({
    title: presentation ? `Presenting: ${presentation.title}` : 'Presenting',
  });

  const slideCount = presentation?.slides.length ?? 0;

  // Reveal the controls and (re)start the inactivity timer that hides them.
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2500);
  }, []);

  const goNext = useCallback(() => {
    setCurrentSlide((i) => Math.min(i + 1, slideCount - 1));
    showControls();
  }, [slideCount, showControls]);

  const goPrev = useCallback(() => {
    setCurrentSlide((i) => Math.max(i - 1, 0));
    showControls();
  }, [showControls]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    navigate(-1);
  }, [navigate]);

  // Elapsed timer (starts immediately)
  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Enter fullscreen on mount; exit on unmount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {
      // Fullscreen may be blocked; presentation still works in-page
    });
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentSlide(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentSlide(slideCount - 1);
          break;
        case 'Escape':
          e.preventDefault();
          exit();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation, goNext, goPrev, exit, slideCount]);

  // Show controls initially; clean up the hide timer on unmount
  useEffect(() => {
    showControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-8 px-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <h2 className="text-xl font-semibold mb-2">Presentation not found</h2>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slide = presentation.slides[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slideCount - 1;

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-default"
      onMouseMove={showControls}
      onClick={(e) => {
        // Click advances; click on a control button won't reach here (stopPropagation)
        const x = e.clientX / window.innerWidth;
        if (x < 0.25) goPrev();
        else goNext();
      }}
    >
      {/* The slide fills the screen, scaled to the 16:9 canvas */}
      <div className="w-full h-full max-w-[177.78vh] max-h-[56.25vw] aspect-video">
        <SlideRenderer slide={slide} theme={presentation.theme} />
      </div>

      {/* Edge nav buttons */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center pl-3 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur"
          disabled={isFirst}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center pr-3 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur"
          disabled={isLast}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Top bar: counter, timer, exit */}
      <div
        className={cn(
          'absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 transition-opacity duration-300',
          'bg-gradient-to-b from-black/50 to-transparent',
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <span className="text-white/80 text-sm font-medium tabular-nums">
          {currentSlide + 1} / {slideCount}
        </span>
        <span className="text-white/80 text-sm font-mono tabular-nums">
          {formatTime(elapsedTime)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); exit(); }}
          aria-label="Exit presentation"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Bottom progress bar — always visible for orientation */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10">
        <div
          className="h-full bg-white/70 transition-all duration-200"
          style={{ width: `${((currentSlide + 1) / slideCount) * 100}%` }}
        />
      </div>
    </div>
  );
}
