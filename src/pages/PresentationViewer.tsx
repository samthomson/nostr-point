import { useState, useEffect, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { 
  ArrowLeft, 
  ArrowRight, 
  Play,
  Download,
  CheckCircle,
  Loader2,
  Home,
  Layers,
  Pencil,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { SlideRenderer } from '@/components/SlideRenderer';
import { AppHeader } from '@/components/AppHeader';
import { usePresentation } from '@/hooks/usePresentations';
import { useOfflinePresentation, useOfflinePresentationData } from '@/hooks/useOfflinePresentation';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDuration, getSlideLabel } from '@/lib/types';

export default function PresentationViewer() {
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
  const isLoading = onlinePresentation.isLoading && offlinePresentation.isLoading;
  
  const author = useAuthor(presentation?.pubkey);
  const { user } = useCurrentUser();
  const { status, cacheForOffline, isCaching, cacheProgress } = useOfflinePresentation(presentation);
  
  // Check if current user is the author
  const isAuthor = user && presentation && user.pubkey === presentation.pubkey;
  
  const [currentSlide, setCurrentSlide] = useState(0);
  
  useSeoMeta({
    title: presentation?.title ?? 'Loading...',
    description: presentation?.summary,
  });
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;
      
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(presentation.slides.length - 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation]);
  
  const startPresenterMode = useCallback(() => {
    if (nip19Param) {
      navigate(`/${nip19Param}/present`);
    }
  }, [navigate, nip19Param]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Skeleton className="w-8 h-8" />
            <div className="flex-1">
              <Skeleton className="h-6 w-64 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="aspect-video rounded-lg" />
        </div>
      </div>
    );
  }
  
  if (!presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card>
          <CardContent className="py-8 px-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Presentation not found</h2>
            <p className="text-muted-foreground mb-4">
              This presentation may have been deleted or you may be offline.
            </p>
            <Button asChild>
              <Link to="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const slide = presentation.slides[currentSlide];
  const authorName = author.data?.metadata?.name ?? presentation.pubkey.slice(0, 8) + '...';
  
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <AppHeader
        subtitle={`${presentation.title} · by ${authorName} · ${formatDuration(presentation.duration)}`}
        actions={
          <>
            {status?.fullyOffline ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Offline ready</span>
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cacheForOffline()}
                disabled={isCaching}
              >
                {isCaching ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">
                      {cacheProgress ? `${cacheProgress.cached}/${cacheProgress.total}` : 'Caching...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Save offline</span>
                  </>
                )}
              </Button>
            )}

            {isAuthor && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/${nip19Param}/edit`}>
                  <Pencil className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </Button>
            )}

            <Button size="sm" onClick={startPresenterMode}>
              <Play className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Present</span>
            </Button>
          </>
        }
      />
      
      {/* Slide Area */}
      <main className="flex-1 flex flex-col p-4 md:p-8 bg-muted/30">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-6xl aspect-video rounded-xl overflow-hidden shadow-2xl">
            <SlideRenderer slide={slide} theme={presentation.theme} />
          </div>
        </div>
        
        {/* Navigation */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2 min-w-[200px] justify-center">
            <span className="text-lg font-medium">
              {currentSlide + 1} / {presentation.slides.length}
            </span>
            <span className="text-muted-foreground">• {getSlideLabel(slide, currentSlide)}</span>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1))}
            disabled={currentSlide === presentation.slides.length - 1}
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 max-w-2xl mx-auto w-full">
          <Progress value={(currentSlide + 1) / presentation.slides.length * 100} />
        </div>
        
        {/* Slide thumbnails — scroll internally, never widen the page */}
        <div className="mt-6 w-full max-w-6xl mx-auto min-w-0">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {presentation.slides.map((s, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`
                  flex-shrink-0 w-24 h-14 rounded border-2 overflow-hidden transition-all
                  ${i === currentSlide 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-transparent hover:border-muted-foreground/30'
                  }
                `}
              >
                <div className="w-full h-full bg-slate-800 pointer-events-none">
                  <SlideRenderer slide={s} theme={presentation.theme} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
      
      {/* Keyboard hints */}
      <footer className="border-t bg-card py-2">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> or{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd> to navigate
        </div>
      </footer>
    </div>
  );
}
