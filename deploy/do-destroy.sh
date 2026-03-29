#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# CommonPub — Destroy a Deployed Instance
# ============================================================================
# Safely destroys a CommonPub droplet after confirmation.
#
# Usage:
#   bash deploy/do-destroy.sh <droplet-name>
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <droplet-name>"
  echo ""
  echo "CommonPub droplets:"
  doctl compute droplet list --tag-name commonpub --format Name,PublicIPv4,Region,Memory --no-header 2>/dev/null | while read -r line; do
    echo "  $line"
  done
  exit 0
fi

DROPLET_NAME="$1"

# Verify droplet exists
DROPLET_ID=$(doctl compute droplet list --format Name,ID --no-header 2>/dev/null | grep "^${DROPLET_NAME}" | awk '{print $2}')
if [[ -z "$DROPLET_ID" ]]; then
  echo -e "${RED}  ✗${NC} Droplet '$DROPLET_NAME' not found"
  exit 1
fi

DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header 2>/dev/null | grep "^${DROPLET_NAME}" | awk '{print $2}')

echo ""
echo -e "${RED}${BOLD}WARNING: This will permanently destroy:${NC}"
echo -e "  Droplet: ${BOLD}$DROPLET_NAME${NC} (ID: $DROPLET_ID)"
echo -e "  IP:      ${BOLD}$DROPLET_IP${NC}"
echo -e "  ${RED}All data on this droplet will be lost!${NC}"
echo ""
read -rp "  Type the droplet name to confirm: " CONFIRM

if [[ "$CONFIRM" != "$DROPLET_NAME" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo -e "${YELLOW}Destroying droplet...${NC}"
doctl compute droplet delete "$DROPLET_ID" --force

# Clean up local deploy info
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLUG=$(echo "$DROPLET_NAME" | sed 's/^commonpub-//')
rm -f "${SCRIPT_DIR}/.last-deploy-${SLUG}.json"

echo -e "${GREEN}  ✓${NC} Droplet destroyed"
echo ""
echo "  Don't forget to remove DNS records for this instance."
