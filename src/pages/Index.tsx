import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { Plus, Layers, WifiOff, Cloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AppHeader } from '@/components/AppHeader';
import { PresentationCard, PresentationCardSkeleton } from '@/components/PresentationCard';
import { usePresentations } from '@/hooks/usePresentations';
import { useCachedPresentations, useIsOffline } from '@/hooks/useOfflinePresentation';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const Index = () => {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<'discover' | 'mine' | 'offline'>('discover');
  const isOffline = useIsOffline();
  
  const allPresentations = usePresentations({ limit: 20 });
  const myPresentations = usePresentations({ 
    author: user?.pubkey, 
    limit: 50 
  });
  const cachedPresentations = useCachedPresentations();
  
  useSeoMeta({
    title: 'Nostr Point - Decentralized Presentations',
    description: 'Create, share, and present slide decks on Nostr. With offline support and presenter mode.',
  });

  const renderPresentationGrid = (
    presentations: ReturnType<typeof usePresentations>,
    emptyMessage: string
  ) => {
    if (presentations.isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PresentationCardSkeleton key={i} />
          ))}
        </div>
      );
    }
    
    if (!presentations.data || presentations.data.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground max-w-sm mx-auto">
              {emptyMessage}
            </p>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presentations.data.map((presentation) => (
          <PresentationCard key={presentation.event.id} presentation={presentation} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader
        actions={
          user && (
            <Button asChild>
              <Link to="/new">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">New Presentation</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          )
        }
      />
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Discover
            </TabsTrigger>
            {user && (
              <TabsTrigger value="mine" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                My Presentations
              </TabsTrigger>
            )}
            <TabsTrigger value="offline" className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              Offline
              {cachedPresentations.data && cachedPresentations.data.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 rounded-full">
                  {cachedPresentations.data.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="discover">
            {isOffline ? (
              <Card className="border-dashed">
                <CardContent className="py-12 px-8 text-center">
                  <WifiOff className="w-12 h-12 mx-auto mb-4 text-orange-500/50" />
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    You're offline. Check the Offline tab for cached presentations.
                  </p>
                </CardContent>
              </Card>
            ) : (
              renderPresentationGrid(
                allPresentations,
                'No presentations found. Be the first to create one!'
              )
            )}
          </TabsContent>
          
          {user && (
            <TabsContent value="mine">
              {renderPresentationGrid(
                myPresentations,
                'You haven\'t created any presentations yet. Click "New Presentation" to get started!'
              )}
            </TabsContent>
          )}
          
          <TabsContent value="offline">
            {cachedPresentations.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <PresentationCardSkeleton key={i} />
                ))}
              </div>
            ) : !cachedPresentations.data || cachedPresentations.data.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 px-8 text-center">
                  <WifiOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    No presentations saved for offline use. Browse presentations and click 
                    "Save offline" to cache them for when you don't have internet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cachedPresentations.data.map((presentation) => (
                  <PresentationCard key={presentation.event.id} presentation={presentation} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Vibed with{' '}
            <a 
              href="https://shakespeare.diy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Shakespeare
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
