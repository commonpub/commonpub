#!/usr/bin/env bash
set -euo pipefail

# CommonPub Droplet Setup Script
# Usage: bash droplet-setup.sh
# Requires: Ubuntu 22.04+ with Docker pre-installed (use docker marketplace image)

APP_DIR="/opt/commonpub"
DATA_DIR="/mnt/commonpub_data"

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: This script must be run as root" >&2
  exit 1
fi

echo "==> Mounting and preparing block storage..."
# The volume is auto-attached by DO but may need mounting
VOLUME_DEV=$(ls /dev/disk/by-id/scsi-0DO_Volume_commonpub-data 2>/dev/null || true)
if [[ -n "$VOLUME_DEV" ]]; then
  mkdir -p "$DATA_DIR"
  # Only format if not already formatted
  if ! blkid "$VOLUME_DEV" | grep -q ext4; then
    mkfs.ext4 "$VOLUME_DEV"
  fi
  # Add to fstab if not already there
  if ! grep -q commonpub_data /etc/fstab; then
    echo "$VOLUME_DEV $DATA_DIR ext4 defaults,nofail,discard 0 2" >> /etc/fstab
  fi
  mount -a
  echo "   Volume mounted at $DATA_DIR"
else
  echo "   WARNING: Block storage volume not found, using local storage"
  mkdir -p "$DATA_DIR"
fi

# Create data subdirectories
mkdir -p "$DATA_DIR/postgres"
mkdir -p "$DATA_DIR/redis"
mkdir -p "$DATA_DIR/meilisearch"

echo "==> Setting up application directory..."
mkdir -p "$APP_DIR"

echo "==> Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy docker-compose.prod.yml, Caddyfile, and .env to $APP_DIR"
echo "  2. Build or load the app Docker image"
echo "  3. cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"
