import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Presentation } from '@/lib/types';
import {
  cachePresentationForOffline,
  getOfflineStatus,
  loadPresentationOffline,
  deleteCachedPresentation,
  getAllCachedPresentations,
  getCachedMediaUrl,
} from '@/lib/offlineStorage';

/** Hook to manage offline caching for a presentation */
export function useOfflinePresentation(presentation: Presentation | null | undefined) {
  const [cacheProgress, setCacheProgress] = useState<{ cached: number; total: number } | null>(null);
  const queryClient = useQueryClient();
  
  const statusQuery = useQuery({
    queryKey: ['offline-status', presentation?.pubkey, presentation?.id],
    queryFn: async () => {
      if (!presentation) return null;
      return getOfflineStatus(presentation.pubkey, presentation.id);
    },
    enabled: Boolean(presentation),
  });
  
  const cacheMutation = useMutation({
    mutationFn: async () => {
      if (!presentation) throw new Error('No presentation to cache');
      
      setCacheProgress({ cached: 0, total: 1 });
      
      const result = await cachePresentationForOffline(presentation, (cached, total) => {
        setCacheProgress({ cached, total });
      });
      
      setCacheProgress(null);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['offline-status', presentation?.pubkey, presentation?.id] 
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!presentation) throw new Error('No presentation');
      await deleteCachedPresentation(presentation.pubkey, presentation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['offline-status', presentation?.pubkey, presentation?.id] 
      });
    },
  });
  
  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    cacheProgress,
    cacheForOffline: cacheMutation.mutate,
    isCaching: cacheMutation.isPending,
    deleteCache: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

/** Hook to load a presentation from offline cache */
export function useOfflinePresentationData(pubkey: string | undefined, identifier: string | undefined) {
  return useQuery({
    queryKey: ['offline-presentation', pubkey, identifier],
    queryFn: async () => {
      if (!pubkey || !identifier) return null;
      return loadPresentationOffline(pubkey, identifier);
    },
    enabled: Boolean(pubkey && identifier),
  });
}

/** Hook to get all cached presentations */
export function useCachedPresentations() {
  return useQuery({
    queryKey: ['cached-presentations'],
    queryFn: getAllCachedPresentations,
  });
}

/** Hook to resolve an image URL, preferring cached version */
export function useCachedImage(url: string | undefined) {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(url);
  const [isFromCache, setIsFromCache] = useState(false);
  
  useEffect(() => {
    if (!url) {
      setResolvedUrl(undefined);
      setIsFromCache(false);
      return;
    }
    
    let objectUrl: string | null = null;
    
    const resolve = async () => {
      const cachedUrl = await getCachedMediaUrl(url);
      if (cachedUrl) {
        objectUrl = cachedUrl;
        setResolvedUrl(cachedUrl);
        setIsFromCache(true);
      } else {
        setResolvedUrl(url);
        setIsFromCache(false);
      }
    };
    
    resolve();
    
    // Cleanup object URL on unmount
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);
  
  return { url: resolvedUrl, isFromCache };
}

/** Hook to check if we're currently offline */
export function useIsOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOffline;
}
