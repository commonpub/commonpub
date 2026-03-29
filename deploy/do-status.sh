#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# CommonPub — Check Deployment Status
# ============================================================================
# Checks the status of a deployed CommonPub droplet.
#
# Usage:
#   bash deploy/do-status.sh <droplet-name-or-ip>
#   bash deploy/do-status.sh                        # lists all commonpub droplets
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
err()   { echo -e "${RED}  ✗${NC} $1"; }

if [[ $# -eq 0 ]]; then
  info "CommonPub droplets:"
  doctl compute droplet list --tag-name commonpub --format Name,PublicIPv4,Region,Memory,Status --no-header 2>/dev/null | while read -r line; do
    echo "  $line"
  done
  echo ""
  echo "Usage: $0 <droplet-name-or-ip>"
  exit 0
fi

TARGET="$1"

# Resolve IP from name if needed
if [[ "$TARGET" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IP="$TARGET"
else
  IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header 2>/dev/null | grep "^${TARGET}" | awk '{print $2}')
  if [[ -z "$IP" ]]; then
    err "Droplet '$TARGET' not found"
    exit 1
  fi
fi

info "Checking CommonPub deployment at $IP..."

# Check SSH access
if ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@$IP" true 2>/dev/null; then
  err "Cannot SSH to $IP — droplet may still be booting"
  exit 1
fi
ok "SSH accessible"

# Check cloud-init status
CLOUD_INIT_STATUS=$(ssh -o StrictHostKeyChecking=no "root@$IP" "cloud-init status 2>/dev/null || echo 'unknown'" 2>/dev/null)
echo -e "  Cloud-init: $CLOUD_INIT_STATUS"

# Check setup complete marker
if ssh -o StrictHostKeyChecking=no "root@$IP" "test -f /opt/commonpub/.setup-complete" 2>/dev/null; then
  SETUP_TIME=$(ssh -o StrictHostKeyChecking=no "root@$IP" "cat /opt/commonpub/.setup-complete" 2>/dev/null)
  ok "Setup complete: $SETUP_TIME"
else
  warn "Setup not yet complete — still bootstrapping"
  echo ""
  info "Live cloud-init log (last 20 lines):"
  ssh -o StrictHostKeyChecking=no "root@$IP" "tail -20 /var/log/cloud-init-output.log 2>/dev/null" 2>/dev/null || true
  exit 0
fi

# Check Docker services
echo ""
info "Docker services:"
ssh -o StrictHostKeyChecking=no "root@$IP" "cd /opt/commonpub && docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null" 2>/dev/null || true

# Check app health
echo ""
info "App health:"
APP_HEALTH=$(ssh -o StrictHostKeyChecking=no "root@$IP" "curl -sf http://localhost:3000/ -o /dev/null -w '%{http_code}' 2>/dev/null || echo 'unreachable'" 2>/dev/null)
if [[ "$APP_HEALTH" == "200" ]]; then
  ok "App responding (HTTP 200)"
else
  warn "App returned: $APP_HEALTH"
fi

# Check Caddy / HTTPS
DOMAIN=$(ssh -o StrictHostKeyChecking=no "root@$IP" "grep INSTANCE_DOMAIN /opt/commonpub/.env 2>/dev/null | cut -d= -f2" 2>/dev/null)
if [[ -n "$DOMAIN" ]]; then
  echo ""
  info "Domain: $DOMAIN"
  HTTPS_STATUS=$(curl -sf "https://$DOMAIN/" -o /dev/null -w '%{http_code}' 2>/dev/null || echo 'unreachable')
  if [[ "$HTTPS_STATUS" == "200" ]]; then
    ok "HTTPS working (https://$DOMAIN)"
  else
    warn "HTTPS status: $HTTPS_STATUS (DNS may not have propagated yet)"
  fi
fi

# Check disk usage
echo ""
info "Disk usage:"
ssh -o StrictHostKeyChecking=no "root@$IP" "df -h / | tail -1 | awk '{print \"  Used: \" \$3 \" / \" \$2 \" (\" \$5 \")\"}'" 2>/dev/null || true

echo ""
ok "Status check complete"
