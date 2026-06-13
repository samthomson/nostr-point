import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wifi, Layers, ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RelayListManager } from '@/components/RelayListManager';
import { BlossomServerManager } from '@/components/BlossomServerManager';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Settings() {
  const { user } = useCurrentUser();
  
  useSeoMeta({
    title: 'Settings - Nostr Point',
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              <span className="text-lg font-semibold">Settings</span>
            </div>
          </div>
          
          <LoginArea className="max-w-48" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Manage your Nostr login
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Logged in as:
                </p>
                <p className="font-mono text-sm break-all bg-muted p-2 rounded">
                  {user.pubkey}
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Log in to sync your relay list and publish presentations
                </p>
                <LoginArea className="justify-center" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relay Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              <CardTitle>Relays</CardTitle>
            </div>
            <CardDescription>
              Configure which Nostr relays to use for reading and publishing presentations.
              {!user && ' Log in to sync your relay list to Nostr.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RelayListManager />
          </CardContent>
        </Card>

        {/* Media / Blossom Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <CardTitle>Media Servers</CardTitle>
            </div>
            <CardDescription>
              Images you upload are stored on Blossom servers. Configure where your
              media is hosted. The first server in the list is used first.
              {!user && ' Log in to sync your server list to Nostr.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BlossomServerManager />
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Nostr Point</strong> is a decentralized presentation app built on the Nostr protocol.
            </p>
            <p>
              Create slide decks, share them with anyone, and present with confidence — even offline.
            </p>
            <p className="pt-2">
              Uses <strong>Kind 36387</strong> for addressable slide presentations.
            </p>
            <p className="pt-4">
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
