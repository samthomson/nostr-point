import type { RelayMetadata } from '@/contexts/AppContext';

/**
 * App default relays. Used as the initial `relayMetadata` for new users and as
 * a fallback when the user has no NIP-65 relay list configured (e.g. during
 * nostrconnect handshakes before any user relays have been loaded).
 * 
 * NOTE: Currently using testnet relays for development. Update these for production.
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    // Testnet relays for development - replace with production relays before launch
    { url: 'wss://relay.ditto.pub', read: true, write: true },
  ],
  updatedAt: 0,
};
