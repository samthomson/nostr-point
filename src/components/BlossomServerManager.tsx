import { useState, useEffect } from 'react';
import { Plus, X, Server, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { APP_BLOSSOM_SERVERS } from '@/lib/appBlossom';

/**
 * Manages the user's Blossom media server list (kind 10063).
 * Image/file uploads in the app go to these servers (the first that accepts
 * the upload is used). Publishes a kind 10063 event when the user is logged in.
 */
export function BlossomServerManager() {
  const { config, updateConfig } = useAppContext();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const [servers, setServers] = useState<string[]>(config.blossomServerMetadata.servers);
  const [useAppServers, setUseAppServers] = useState(config.useAppBlossomServers);
  const [newServerUrl, setNewServerUrl] = useState('');

  // Sync local state when config changes externally (e.g., NostrSync on login)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setServers(config.blossomServerMetadata.servers);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUseAppServers(config.useAppBlossomServers);
  }, [config.blossomServerMetadata.servers, config.useAppBlossomServers]);

  const normalizeUrl = (url: string): string => {
    url = url.trim();
    try {
      return new URL(url).toString();
    } catch {
      try {
        return new URL(`https://${url}`).toString();
      } catch {
        return url;
      }
    }
  };

  const isValidUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    try {
      const parsed = new URL(normalizeUrl(trimmed));
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  const saveServers = (newServers: string[], newUseAppServers: boolean) => {
    // eslint-disable-next-line react-hooks/purity
    const now = Math.floor(Date.now() / 1000);

    updateConfig((current) => ({
      ...current,
      blossomServerMetadata: {
        servers: newServers,
        updatedAt: now,
      },
      useAppBlossomServers: newUseAppServers,
    }));

    if (user) {
      const tags = newServers.map((url) => ['server', url]);
      publishEvent(
        { kind: 10063, content: '', tags },
        {
          onSuccess: () => {
            toast({
              title: 'Media servers published',
              description: 'Your Blossom server list has been published to Nostr.',
            });
          },
          onError: () => {
            toast({
              title: 'Failed to publish',
              description: 'Could not publish your media server list.',
              variant: 'destructive',
            });
          },
        }
      );
    }
  };

  const handleAddServer = () => {
    if (!isValidUrl(newServerUrl)) {
      toast({
        title: 'Invalid server URL',
        description: 'Please enter a valid URL (e.g., https://blossom.example.com)',
        variant: 'destructive',
      });
      return;
    }

    const normalized = normalizeUrl(newServerUrl);

    if (servers.some((s) => s === normalized)) {
      toast({
        title: 'Server already added',
        description: 'This server is already in your list.',
        variant: 'destructive',
      });
      return;
    }

    const newServers = [...servers, normalized];
    setServers(newServers);
    setNewServerUrl('');
    saveServers(newServers, useAppServers);
  };

  const handleRemoveServer = (url: string) => {
    const newServers = servers.filter((s) => s !== url);
    setServers(newServers);
    saveServers(newServers, useAppServers);
  };

  const handleSetPrimary = (url: string) => {
    const newServers = [url, ...servers.filter((s) => s !== url)];
    setServers(newServers);
    saveServers(newServers, useAppServers);
  };

  const handleToggleAppServers = (checked: boolean) => {
    setUseAppServers(checked);
    saveServers(servers, checked);
  };

  const renderUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      return parsed.host + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-4">
      {/* User servers list */}
      <div className="space-y-2">
        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-1">
            No personal servers added. {useAppServers ? "App default servers will be used." : "Add a server below to upload images."}
          </p>
        )}
        {servers.map((server, index) => (
          <div
            key={server}
            className="flex items-center gap-3 p-3 rounded-md border bg-muted/20"
          >
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-mono text-sm flex-1 truncate" title={server}>
              {renderUrl(server)}
            </span>

            {index === 0 ? (
              <span className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                <Star className="h-3 w-3 fill-current" />
                Primary
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => handleSetPrimary(server)}
              >
                Make primary
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveServer(server)}
              className="size-5 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add server form */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="new-server-url" className="sr-only">
            Blossom server URL
          </Label>
          <Input
            id="new-server-url"
            placeholder="https://blossom.example.com"
            value={newServerUrl}
            onChange={(e) => setNewServerUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddServer();
            }}
          />
        </div>
        <Button
          onClick={handleAddServer}
          disabled={!newServerUrl.trim()}
          variant="outline"
          size="sm"
          className="h-10 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </div>

      {/* App default / suggested servers */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="use-app-servers" className="text-sm cursor-pointer">
              Use these defaults as a fallback
            </Label>
            <p className="text-xs text-muted-foreground">
              When on, all of the built-in servers below are tried after your own.
              Or add just the ones you want to your list.
            </p>
          </div>
          <Switch
            id="use-app-servers"
            checked={useAppServers}
            onCheckedChange={handleToggleAppServers}
          />
        </div>

        <div className="space-y-1.5 pt-1">
          {APP_BLOSSOM_SERVERS.servers.map((server) => {
            const normalized = normalizeUrl(server);
            const alreadyAdded = servers.some((s) => s === normalized);
            return (
              <div key={server} className="flex items-center gap-2 text-xs">
                <Server className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-mono truncate flex-1 text-muted-foreground">
                  {renderUrl(server)}
                </span>
                {alreadyAdded ? (
                  <span className="text-muted-foreground shrink-0">In your list</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs shrink-0"
                    onClick={() => {
                      const newServers = [...servers, normalized];
                      setServers(newServers);
                      saveServers(newServers, useAppServers);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {user
          ? 'Your server list is synced from (and published to) Nostr as a kind 10063 event, so it follows you across devices and other Blossom-aware apps.'
          : 'Log in to sync your media server list with Nostr (kind 10063).'}
      </p>
    </div>
  );
}
