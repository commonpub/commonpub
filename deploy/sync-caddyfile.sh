#!/bin/sh
# Bring the droplet's live Caddyfile up to the version in the repo, safely.
#
#   sh sync-caddyfile.sh <new Caddyfile> <known sha256 list> [docker compose args...]
#
# The deploy never copied the Caddyfile, so repo changes to it (compression,
# headers) silently never reached production. This applies one ONLY when the live
# file is byte-identical to a version this repo shipped before (its sha256 is in
# the known list): a file someone edited by hand on the server is left alone with
# a warning, never overwritten. The new file is validated with Caddy first,
# written in place (the container bind-mounts this inode, so a rename would be
# invisible to it), and reloaded gracefully; a failed reload restores the old one.
# Every outcome other than "applied" is a warning, never a failed deploy: the app
# itself is already deployed and serving when this runs.
set -eu
NEW="$1"
KNOWN="$2"
shift 2

CID=$(docker compose "$@" ps -q caddy || true)
if [ -z "$CID" ]; then
  echo "::warning::No running caddy service found; Caddyfile not synced."
  exit 0
fi
LIVE=$(docker inspect "$CID" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
if [ -z "$LIVE" ] || [ ! -f "$LIVE" ]; then
  echo "::warning::Could not find the Caddyfile caddy mounts; not synced."
  exit 0
fi
if cmp -s "$NEW" "$LIVE"; then
  echo "Caddyfile already current ($LIVE)."
  exit 0
fi
if command -v sha256sum >/dev/null 2>&1; then
  LIVE_SUM=$(sha256sum "$LIVE" | cut -d' ' -f1)
else
  LIVE_SUM=$(shasum -a 256 "$LIVE" | cut -d' ' -f1)
fi
if [ -z "$LIVE_SUM" ] || ! grep -qx "$LIVE_SUM" "$KNOWN"; then
  echo "::warning::$LIVE has been edited on the server (sha256 $LIVE_SUM is not a version this repo shipped). Left alone; apply the repo's deploy/Caddyfile by hand."
  exit 0
fi
NEW_ABS="$(cd "$(dirname "$NEW")" && pwd)/$(basename "$NEW")"
if ! docker run --rm -v "$NEW_ABS:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
     caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  echo "::warning::The repo's Caddyfile does not validate; not applied."
  exit 0
fi
cp "$LIVE" "$LIVE.bak"
cat "$NEW" > "$LIVE"
if docker exec "$CID" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  echo "Caddyfile synced and reloaded ($LIVE; previous copy at $LIVE.bak)."
else
  cat "$LIVE.bak" > "$LIVE"
  docker exec "$CID" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  echo "::warning::Caddy rejected the new Caddyfile on reload; the previous one is restored."
fi
