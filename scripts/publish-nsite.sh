#!/usr/bin/env bash
# Build the app and publish dist/ as an nsite (nsyte).
# Run: npm run publish-nsite
#
# ── edit these ────────────────────────────────────────────────────────────────
SITE_ID="nostrpoint"   # named site (kind 35128 d-tag) — how sites are told apart under one npub. "" = root site
RELAYS="wss://relay.nsite.lol,wss://relay.primal.net,wss://nos.lol,wss://relay.ditto.pub,wss://relay.relayk.it"
BLOSSOMS="https://nostr.download,https://blossom.relayk.it,https://cdn.satellite.earth"
# Signing: you are prompted for the site nsec each run — it is never stored.
# NSYTE_FORCE_ENCRYPTED_STORAGE keeps nsyte itself out of the macOS Keychain
# (its default is to save every --sec key there, which triggers password prompts).
export NSYTE_FORCE_ENCRYPTED_STORAGE=true
# Keep the site key in your password manager; same key = same site npub.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

NSYTE_VERSION="0.28.0"
NSYTE_DIR="${ROOT}/.tools/nsyte-${NSYTE_VERSION}"
NSYTE_BIN="${NSYTE_DIR}/nsyte"
NSYTE_BASE="https://github.com/sandwichfarm/nsyte/releases/download/v${NSYTE_VERSION}"
# Ask for the signing secret — hidden input, never written anywhere.
echo -n "Site key (nsec…, nbunksec1… or bunker://…): "
read -rs SECRET
echo ""
if [[ -z "$SECRET" ]]; then
  echo "No secret entered — aborting." >&2
  exit 1
fi
case "$SECRET" in
  nsec1*|nbunksec1*|bunker://*) ;;
  *)
    echo "That doesn't look like an nsec / nbunksec / bunker URL — aborting." >&2
    exit 1
    ;;
esac

if [[ ! -x "$ROOT/node_modules/.bin/vite" ]]; then
  echo "Run npm install first." >&2
  exit 1
fi

# Fetch the pinned nsyte binary once
if [[ ! -x "$NSYTE_BIN" ]]; then
  mkdir -p "$NSYTE_DIR"
  asset="nsyte-linux"
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)  asset="nsyte-macos-arm64" ;;
    Darwin-x86_64) asset="nsyte-macos-x64" ;;
  esac
  echo "Downloading nsyte ${NSYTE_VERSION} (${asset})…" >&2
  curl -fsSL "${NSYTE_BASE}/${asset}" -o "$NSYTE_BIN"
  chmod +x "$NSYTE_BIN"
fi

echo "▶ Building…"
"$ROOT/node_modules/.bin/vite" build -l error
cp dist/index.html dist/404.html

SITE_ARGS=()
if [[ -n "$SITE_ID" ]]; then
  SITE_ARGS=(-d "$SITE_ID")
fi

echo "▶ Publishing $(find dist -type f | wc -l | tr -d ' ') files as site '${SITE_ID:-<root>}'"
echo "  relays:   ${RELAYS//,/, }"
echo "  blossoms: ${BLOSSOMS//,/, }"

exec "$NSYTE_BIN" deploy dist \
  "${SITE_ARGS[@]}" \
  --sec "$SECRET" \
  --relays "$RELAYS" \
  --servers "$BLOSSOMS" \
  --fallback=/404.html \
  --skip-secrets-scan \
  --non-interactive \
  --sync
