import { Link } from 'react-router-dom';
import { Clock, Layers, Download, CheckCircle, Wifi, WifiOff, Pencil } from 'lucide-react';
import { nip19 } from 'nostr-tools';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOfflinePresentation, useIsOffline } from '@/hooks/useOfflinePresentation';
import { formatDuration, type Presentation } from '@/lib/types';

interface PresentationCardProps {
  presentation: Presentation;
}

export function PresentationCard({ presentation }: PresentationCardProps) {
  const author = useAuthor(presentation.pubkey);
  const { user } = useCurrentUser();
  const { status, cacheForOffline, isCaching, cacheProgress } = useOfflinePresentation(presentation);
  const isOffline = useIsOffline();
  
  const naddr = nip19.naddrEncode({
    kind: presentation.event.kind,
    pubkey: presentation.pubkey,
    identifier: presentation.id,
  });
  
  const authorName = author.data?.metadata?.name ?? 
    presentation.pubkey.slice(0, 8) + '...';
  
  const isAuthor = user && user.pubkey === presentation.pubkey;
  
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <Link to={`/${naddr}`}>
          {presentation.image ? (
            <div className="aspect-video bg-muted overflow-hidden">
              <img 
                src={presentation.image} 
                alt={presentation.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Layers className="w-12 h-12 text-primary/40" />
            </div>
          )}
        </Link>
        
        {isAuthor && (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          >
            <Link to={`/${naddr}/edit`}>
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Link>
          </Button>
        )}
      </div>
      
      <CardHeader className="pb-2">
        <Link to={`/${naddr}`} className="hover:underline">
          <h3 className="font-semibold text-lg line-clamp-2">{presentation.title}</h3>
        </Link>
        <p className="text-sm text-muted-foreground">by {authorName}</p>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {presentation.summary && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {presentation.summary}
          </p>
        )}
        
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatDuration(presentation.duration)}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-4 h-4" />
            {presentation.slides.length} slides
          </span>
        </div>
        
        {presentation.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {presentation.topics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {presentation.topics.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{presentation.topics.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t">
          {status?.fullyOffline ? (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Offline ready
            </span>
          ) : isOffline ? (
            <span className="flex items-center gap-1 text-sm text-orange-600">
              <WifiOff className="w-4 h-4" />
              Not cached
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Wifi className="w-4 h-4" />
              Online
            </span>
          )}
          
          {!status?.fullyOffline && !isOffline && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                cacheForOffline();
              }}
              disabled={isCaching}
            >
              <Download className="w-4 h-4 mr-1" />
              {isCaching && cacheProgress 
                ? `${cacheProgress.cached}/${cacheProgress.total}`
                : 'Save offline'
              }
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PresentationCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-video" />
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/4 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
