import { useState, useEffect, useCallback, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Pause,
  RotateCcw,
  X,
  Clock,
  Layers,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SlideRenderer } from '@/components/SlideRenderer';
import { usePresentation } from '@/hooks/usePresentations';
import { useOfflinePresentationData } from '@/hooks/useOfflinePresentation';
import { 
  formatTime, 
  formatDuration,
  calculateTotalDuration,
  getExpectedTimeForSlide,
  calculateExpectedSlideIndex,
  getSlideLabel,
} from '@/lib/types';
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
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<number | null>(null);
  
  useSeoMeta({
    title: presentation ? `Presenting: ${presentation.title}` : 'Presenter Mode',
  });
  
  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;
      
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
        if (!isRunning) setIsRunning(true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitPresenterMode();
      } else if (e.key === 'p') {
        e.preventDefault();
        setIsRunning(prev => !prev);
      } else if (e.key === 'r') {
        e.preventDefault();
        resetTimer();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation, isRunning]);
  
  // Auto-enter fullscreen
  useEffect(() => {
    document.documentElement.requestFullscreen?.();
    
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []);
  
  const exitPresenterMode = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    navigate(-1);
  }, [navigate]);
  
  const resetTimer = useCallback(() => {
    setElapsedTime(0);
    setCurrentSlide(0);
    setIsRunning(false);
  }, []);
  
  const toggleTimer = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);
  
  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-8 px-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold mb-2">Presentation not found</h2>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const totalDuration = calculateTotalDuration(presentation.slides);
  const slide = presentation.slides[currentSlide];
  const nextSlide = presentation.slides[currentSlide + 1];
  
  // Calculate timing info
  const expectedTimeForCurrentSlide = getExpectedTimeForSlide(presentation.slides, currentSlide);
  const expectedTimeForNextSlide = getExpectedTimeForSlide(presentation.slides, currentSlide + 1);
  const { slideIndex: expectedSlideIndex } = calculateExpectedSlideIndex(presentation.slides, elapsedTime);
  
  // Progress calculations
  const slideProgress = (currentSlide + 1) / presentation.slides.length * 100;
  const timeProgress = Math.min(100, (elapsedTime / totalDuration) * 100);
  
  // Timing status
  const timeDiff = elapsedTime - expectedTimeForCurrentSlide;
  const isAhead = timeDiff < -10; // More than 10s ahead
  const isBehind = timeDiff > 10; // More than 10s behind
  const isOnTrack = !isAhead && !isBehind;
  
  const getStatusColor = () => {
    if (isOnTrack) return 'text-green-400';
    if (isAhead) return 'text-blue-400';
    return 'text-orange-400';
  };
  
  const getStatusText = () => {
    if (isOnTrack) return 'On track';
    if (isAhead) return `${formatTime(Math.abs(timeDiff))} ahead`;
    return `${formatTime(timeDiff)} behind`;
  };
  
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Main slide area */}
      <div className="flex-1 flex">
        {/* Current slide (large) */}
        <div className="flex-1 p-4">
          <div className="h-full rounded-xl overflow-hidden shadow-2xl">
            <SlideRenderer slide={slide} theme={presentation.theme} showNotes />
          </div>
        </div>
        
        {/* Side panel */}
        <div className="w-80 p-4 border-l border-slate-700 flex flex-col gap-4">
          {/* Next slide preview */}
          <div className="space-y-2">
            <p className="text-sm text-slate-400 font-medium">Next Slide</p>
            <div className="aspect-video rounded-lg overflow-hidden border border-slate-700">
              {nextSlide ? (
                <SlideRenderer slide={nextSlide} theme={presentation.theme} className="scale-100" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-500">End of presentation</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Speaker notes */}
          {slide.notes && (
            <div className="flex-1 overflow-y-auto">
              <p className="text-sm text-slate-400 font-medium mb-2">Notes</p>
              <div className="bg-slate-800 rounded-lg p-3 text-sm">
                {slide.notes}
              </div>
            </div>
          )}
          
          {/* Timer display */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Elapsed</span>
              <span className="text-3xl font-mono font-bold">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Expected</span>
              <span className="text-xl font-mono text-slate-400">
                {formatTime(expectedTimeForNextSlide)} for slide {currentSlide + 2}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Total</span>
              <span className="text-xl font-mono text-slate-400">{formatTime(totalDuration)}</span>
            </div>
            
            {/* Status indicator */}
            <div className={cn('text-center py-2 rounded font-semibold', getStatusColor())}>
              {getStatusText()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom control bar */}
      <div className="border-t border-slate-700 bg-slate-800/50 p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Progress bars */}
          <div className="space-y-2">
            {/* Slide progress (expected) */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-20">Slides</span>
              <div className="flex-1 relative">
                <Progress value={slideProgress} className="h-3 bg-slate-700" />
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                  style={{ left: `${(currentSlide / presentation.slides.length) * 100}%` }}
                />
              </div>
              <span className="text-sm font-mono w-16 text-right">
                {currentSlide + 1}/{presentation.slides.length}
              </span>
            </div>
            
            {/* Time progress (actual) */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-20">Time</span>
              <div className="flex-1 relative">
                <Progress 
                  value={timeProgress} 
                  className={cn(
                    'h-3',
                    isOnTrack && '[&>div]:bg-green-500',
                    isAhead && '[&>div]:bg-blue-500',
                    isBehind && '[&>div]:bg-orange-500',
                  )}
                />
                {/* Expected position marker */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                  style={{ left: `${slideProgress}%` }}
                  title="Expected position"
                />
              </div>
              <span className="text-sm font-mono w-16 text-right">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={exitPresenterMode}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={resetTimer}
                className="text-slate-400 hover:text-white"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              
              <Button
                variant={isRunning ? 'secondary' : 'default'}
                size="icon"
                onClick={toggleTimer}
              >
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
                disabled={currentSlide === 0}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Previous
              </Button>
              
              <div className="text-center min-w-[120px]">
                <div className="text-2xl font-bold">
                  {currentSlide + 1} / {presentation.slides.length}
                </div>
                <div className="text-sm text-slate-400">
                  {getSlideLabel(slide, currentSlide)}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
                  if (!isRunning) setIsRunning(true);
                }}
                disabled={currentSlide === presentation.slides.length - 1}
              >
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            
            <div className="text-right text-sm text-slate-400">
              <div>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Space</kbd> / 
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs ml-1">→</kbd> Next
              </div>
              <div>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">P</kbd> Play/Pause •{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">R</kbd> Reset
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
