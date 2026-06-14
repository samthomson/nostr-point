import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Settings, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useIsOffline } from '@/hooks/useOfflinePresentation';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  /**
   * Page-specific subtitle shown under the brand (e.g. presentation title).
   * When omitted, the app name is shown.
   */
  subtitle?: ReactNode;
  /** Page-specific action buttons rendered before the Settings/login controls. */
  actions?: ReactNode;
  /** Hide the Settings gear (rarely needed). */
  hideSettings?: boolean;
  /** Extra class names for the outer header. */
  className?: string;
  /** Constrain inner content to a centered container (default true). */
  container?: boolean;
}

/**
 * Shared app header used across browse/view pages (Index, Settings, Viewer).
 * Provides consistent navigation: brand → home, Settings gear, and login/account.
 * Focused workspaces (editor, presenter) use their own toolbars instead.
 */
export function AppHeader({
  subtitle,
  actions,
  hideSettings = false,
  className,
  container = true,
}: AppHeaderProps) {
  const isOffline = useIsOffline();

  return (
    <header className={cn('border-b bg-card', className)}>
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between gap-4',
          container && 'container mx-auto'
        )}
      >
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <Layers className="w-7 h-7 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-lg font-bold block leading-tight">Nostr Point</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground block truncate leading-tight">
                {subtitle}
              </span>
            )}
          </div>
        </Link>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isOffline && (
            <span className="flex items-center gap-1 text-sm text-orange-600">
              <WifiOff className="w-4 h-4" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          {actions}

          {!hideSettings && (
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings" aria-label="Settings">
                <Settings className="w-5 h-5" />
              </Link>
            </Button>
          )}

          <LoginArea className="max-w-48" />
        </div>
      </div>
    </header>
  );
}
