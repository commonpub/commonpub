#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# CommonPub — DigitalOcean One-Click Deploy
# ============================================================================
# Creates a fully configured CommonPub instance on a DigitalOcean droplet.
# Uses doctl + cloud-init for zero-touch provisioning.
#
# Prerequisites:
#   - doctl authenticated (doctl auth init)
#   - Domain DNS pointed to DigitalOcean (or manually set A record after)
#
# Usage:
#   bash deploy/do-one-click.sh              # Interactive mode
#   bash deploy/do-one-click.sh --dry-run    # Preview without creating
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
COMMONPUB_VERSION="latest"
GITHUB_REPO="https://github.com/commonpub/commonpub.git"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--help]"
      echo ""
      echo "Interactive DigitalOcean deployment for CommonPub."
      echo "  --dry-run   Show what would be created without executing"
      echo "  --help      Show this message"
      exit 0
      ;;
  esac
done

# ---- Color helpers ----
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
err()   { echo -e "${RED}  ✗${NC} $1" >&2; }

# ---- Check prerequisites ----
info "Checking prerequisites..."

if ! command -v doctl &>/dev/null; then
  err "doctl not found. Install: https://docs.digitalocean.com/reference/doctl/how-to/install/"
  exit 1
fi
ok "doctl found"

if ! doctl account get &>/dev/null 2>&1; then
  err "doctl not authenticated. Run: doctl auth init"
  exit 1
fi
ok "doctl authenticated"

ACCOUNT_EMAIL=$(doctl account get --format Email --no-header 2>/dev/null)
ok "Account: $ACCOUNT_EMAIL"

# ---- Interactive Configuration ----
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}CommonPub — New Instance Configuration${NC}            ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Instance Identity
info "Instance Identity"

read -rp "  Instance name (e.g. Maker Hub): " INSTANCE_NAME
while [[ -z "$INSTANCE_NAME" ]]; do
  err "Instance name is required"
  read -rp "  Instance name: " INSTANCE_NAME
done

# Derive slug from name for droplet naming
INSTANCE_SLUG=$(echo "$INSTANCE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

read -rp "  Domain (e.g. makerhub.io): " INSTANCE_DOMAIN
while [[ -z "$INSTANCE_DOMAIN" ]]; do
  err "Domain is required"
  read -rp "  Domain: " INSTANCE_DOMAIN
done

read -rp "  Description [A maker community powered by CommonPub]: " INSTANCE_DESC
INSTANCE_DESC="${INSTANCE_DESC:-A maker community powered by CommonPub}"

echo ""

# Admin User
info "First Admin User"

read -rp "  Admin email: " ADMIN_EMAIL
while [[ -z "$ADMIN_EMAIL" || ! "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; do
  err "Valid email required"
  read -rp "  Admin email: " ADMIN_EMAIL
done

read -rp "  Admin username: " ADMIN_USERNAME
while [[ -z "$ADMIN_USERNAME" ]]; do
  err "Username required"
  read -rp "  Admin username: " ADMIN_USERNAME
done

read -rsp "  Admin password (min 8 chars): " ADMIN_PASSWORD
echo ""
while [[ ${#ADMIN_PASSWORD} -lt 8 ]]; do
  err "Password must be at least 8 characters"
  read -rsp "  Admin password: " ADMIN_PASSWORD
  echo ""
done

echo ""

# Features
info "Features (y/n)"

ask_feature() {
  local label="$1" default="$2" var
  read -rp "  $label [$default]: " var
  var="${var:-$default}"
  [[ "$var" =~ ^[Yy] ]] && echo "true" || echo "false"
}

FEAT_CONTENT=$(ask_feature "Content (projects/articles/blogs)" "y")
FEAT_SOCIAL=$(ask_feature "Social (likes/comments/follows)" "y")
FEAT_HUBS=$(ask_feature "Hubs (communities)" "y")
FEAT_DOCS=$(ask_feature "Documentation sites" "y")
FEAT_LEARNING=$(ask_feature "Learning paths" "y")
FEAT_EXPLAINERS=$(ask_feature "Interactive explainers" "y")
FEAT_CONTESTS=$(ask_feature "Contests/challenges" "n")
FEAT_VIDEO=$(ask_feature "Video hub" "n")
FEAT_FEDERATION=$(ask_feature "ActivityPub federation" "n")
FEAT_ADMIN=$(ask_feature "Admin panel" "y")

echo ""

# Content Types
info "Content Types"
read -rp "  Enabled types (comma-separated) [project,article,blog,explainer]: " CONTENT_TYPES
CONTENT_TYPES="${CONTENT_TYPES:-project,article,blog,explainer}"

echo ""

# Infrastructure
info "DigitalOcean Infrastructure"

echo "  Available regions:"
echo "    nyc1  New York 1        sfo3  San Francisco 3"
echo "    ams3  Amsterdam 3       sgp1  Singapore 1"
echo "    lon1  London 1          fra1  Frankfurt 1"
echo "    tor1  Toronto 1         blr1  Bangalore 1"
read -rp "  Region [nyc1]: " DO_REGION
DO_REGION="${DO_REGION:-nyc1}"

echo ""
echo "  Droplet sizes:"
echo "    s-1vcpu-2gb    1 vCPU,  2GB RAM,  50GB disk  (\$12/mo) — minimum"
echo "    s-2vcpu-4gb    2 vCPU,  4GB RAM,  80GB disk  (\$24/mo) — recommended"
echo "    s-4vcpu-8gb    4 vCPU,  8GB RAM, 160GB disk  (\$48/mo) — production"
read -rp "  Droplet size [s-2vcpu-4gb]: " DO_SIZE
DO_SIZE="${DO_SIZE:-s-2vcpu-4gb}"

# SSH Key
echo ""
info "SSH Access"
echo "  Available SSH keys:"
doctl compute ssh-key list --format ID,Name,FingerPrint --no-header 2>/dev/null | while read -r line; do
  echo "    $line"
done

read -rp "  SSH key ID (or 'none' to skip): " SSH_KEY_ID
SSH_KEY_ID="${SSH_KEY_ID:-none}"

# ---- Generate Secrets ----
info "Generating secrets..."
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
AUTH_SECRET=$(openssl rand -base64 32)
MEILI_MASTER_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
ok "Postgres password generated"
ok "Auth secret generated"
ok "Meilisearch key generated"

# ---- Build Cloud-Init ----
info "Building cloud-init configuration..."

DROPLET_NAME="commonpub-${INSTANCE_SLUG}"

# Escape values for YAML embedding
esc_yaml() { echo "$1" | sed "s/'/'\\''/g"; }

USER_DATA=$(cat <<CLOUD_INIT_EOF
#cloud-config
package_update: true
package_upgrade: true

packages:
  - docker.io
  - docker-compose-plugin
  - curl
  - ufw
  - git

runcmd:
  # ---- Firewall ----
  - ufw allow OpenSSH
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable

  # ---- Docker ----
  - systemctl enable docker
  - systemctl start docker

  # ---- App Directory ----
  - mkdir -p /opt/commonpub
  - mkdir -p /opt/commonpub/uploads

  # ---- Write .env ----
  - |
    cat > /opt/commonpub/.env << 'ENVEOF'
    ORIGIN=https://${INSTANCE_DOMAIN}
    PORT=3000
    POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    DATABASE_URL=postgresql://commonpub:${POSTGRES_PASSWORD}@postgres:5432/commonpub
    REDIS_URL=redis://redis:6379
    AUTH_SECRET=${AUTH_SECRET}
    MEILI_URL=http://meilisearch:7700
    MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
    INSTANCE_DOMAIN=${INSTANCE_DOMAIN}
    INSTANCE_NAME=$(esc_yaml "$INSTANCE_NAME")
    INSTANCE_DESCRIPTION=$(esc_yaml "$INSTANCE_DESC")
    FEATURE_CONTENT=${FEAT_CONTENT}
    FEATURE_SOCIAL=${FEAT_SOCIAL}
    FEATURE_HUBS=${FEAT_HUBS}
    FEATURE_DOCS=${FEAT_DOCS}
    FEATURE_LEARNING=${FEAT_LEARNING}
    FEATURE_EXPLAINERS=${FEAT_EXPLAINERS}
    FEATURE_CONTESTS=${FEAT_CONTESTS}
    FEATURE_VIDEO=${FEAT_VIDEO}
    FEATURE_FEDERATION=${FEAT_FEDERATION}
    FEATURE_ADMIN=${FEAT_ADMIN}
    CONTENT_TYPES=${CONTENT_TYPES}
    EMAIL_ADAPTER=console
    UPLOAD_DIR=./uploads
    ENVEOF

  # ---- Strip leading whitespace from .env (cloud-init indentation artifact) ----
  - sed -i 's/^[[:space:]]*//' /opt/commonpub/.env

  # ---- Write Caddyfile ----
  - |
    cat > /opt/commonpub/Caddyfile << 'CADDYEOF'
    ${INSTANCE_DOMAIN} {
      header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
      }

      handle /inbox {
        request_body { max_size 1MB }
        reverse_proxy app:3000 {
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto {scheme}
        }
      }
      handle /users/*/inbox {
        request_body { max_size 1MB }
        reverse_proxy app:3000 {
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto {scheme}
        }
      }
      handle /hubs/*/inbox {
        request_body { max_size 1MB }
        reverse_proxy app:3000 {
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto {scheme}
        }
      }

      handle /api/notifications* {
        reverse_proxy app:3000 {
          flush_interval -1
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto {scheme}
        }
      }

      handle {
        reverse_proxy app:3000 {
          header_up X-Real-IP {remote_host}
          header_up X-Forwarded-For {remote_host}
          header_up X-Forwarded-Proto {scheme}
        }
      }

      log {
        output file /var/log/caddy/commonpub.log {
          roll_size 50MiB
          roll_keep 5
          roll_keep_for 720h
        }
        format json
      }
    }

    www.${INSTANCE_DOMAIN} {
      redir https://${INSTANCE_DOMAIN}{uri} permanent
    }
    CADDYEOF

  # ---- Write docker-compose.prod.yml ----
  - |
    cat > /opt/commonpub/docker-compose.yml << 'COMPOSEEOF'
    services:
      caddy:
        image: caddy:2-alpine
        restart: unless-stopped
        ports:
          - "80:80"
          - "443:443"
          - "443:443/udp"
        volumes:
          - ./Caddyfile:/etc/caddy/Caddyfile:ro
          - caddy_data:/data
          - caddy_config:/config
        depends_on:
          app:
            condition: service_started
        networks:
          - cpub-net

      app:
        image: commonpub-app:latest
        restart: unless-stopped
        expose:
          - "3000"
        env_file:
          - .env
        environment:
          - NODE_ENV=production
          - NUXT_HOST=0.0.0.0
          - NUXT_PORT=3000
        volumes:
          - uploads_data:/app/uploads
        depends_on:
          postgres:
            condition: service_healthy
          redis:
            condition: service_healthy
          meilisearch:
            condition: service_healthy
        healthcheck:
          test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:3000/']
          interval: 30s
          timeout: 10s
          retries: 3
          start_period: 30s
        networks:
          - cpub-net

      postgres:
        image: postgres:16-alpine
        restart: unless-stopped
        environment:
          POSTGRES_USER: commonpub
          POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
          POSTGRES_DB: commonpub
        volumes:
          - pg_data:/var/lib/postgresql/data
        healthcheck:
          test: ['CMD-SHELL', 'pg_isready -U commonpub']
          interval: 10s
          timeout: 5s
          retries: 5
        networks:
          - cpub-net

      redis:
        image: redis:7-alpine
        restart: unless-stopped
        command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
        expose:
          - "6379"
        volumes:
          - redis_data:/data
        healthcheck:
          test: ['CMD', 'redis-cli', 'ping']
          interval: 10s
          timeout: 5s
          retries: 5
        networks:
          - cpub-net

      meilisearch:
        image: getmeili/meilisearch:v1.12
        restart: unless-stopped
        expose:
          - "7700"
        environment:
          - MEILI_ENV=production
          - MEILI_MASTER_KEY=\${MEILI_MASTER_KEY}
          - MEILI_NO_ANALYTICS=true
        volumes:
          - meili_data:/meili_data
        healthcheck:
          test: ['CMD', 'curl', '-f', 'http://localhost:7700/health']
          interval: 10s
          timeout: 5s
          retries: 5
        networks:
          - cpub-net

    networks:
      cpub-net:

    volumes:
      caddy_data:
      caddy_config:
      uploads_data:
      pg_data:
      redis_data:
      meili_data:
    COMPOSEEOF

  # ---- Strip leading whitespace from compose (cloud-init artifact) ----
  - sed -i 's/^    //' /opt/commonpub/docker-compose.yml
  - sed -i 's/^    //' /opt/commonpub/Caddyfile

  # ---- Clone repo and build Docker image ----
  - cd /opt/commonpub
  - git clone --depth 1 ${GITHUB_REPO} /tmp/commonpub-src
  - cd /tmp/commonpub-src
  - docker build -t commonpub-app:latest .
  - rm -rf /tmp/commonpub-src

  # ---- Start services ----
  - cd /opt/commonpub
  - docker compose up -d

  # ---- Wait for services to be healthy ----
  - |
    echo "Waiting for services to start..."
    for i in \$(seq 1 60); do
      if docker compose exec -T app wget --quiet --tries=1 --spider http://localhost:3000/ 2>/dev/null; then
        echo "App is healthy!"
        break
      fi
      sleep 5
    done

  # ---- Push database schema ----
  - docker compose exec -T app npx drizzle-kit push --force

  # ---- Create first admin user ----
  - |
    docker compose exec -T app node -e "
      const { createHash } = require('crypto');
      async function main() {
        // Use the Nitro runtime to access the database
        const pg = require('pg');
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

        // Hash password using bcrypt-compatible scrypt (Better Auth format)
        const { scryptSync, randomBytes } = require('crypto');
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync('${ADMIN_PASSWORD}', salt, 64).toString('hex');
        const passwordHash = salt + ':' + hash;

        const userId = require('crypto').randomUUID();
        const now = new Date().toISOString();

        await pool.query(
          \\\`INSERT INTO users (id, email, username, display_name, role, status, email_verified, created_at, updated_at)
           VALUES (\\\$1, \\\$2, \\\$3, \\\$4, 'admin', 'active', true, \\\$5, \\\$5)
           ON CONFLICT (email) DO NOTHING\\\`,
          [userId, '${ADMIN_EMAIL}', '${ADMIN_USERNAME}', '${ADMIN_USERNAME}', now]
        );

        // Create account entry for Better Auth
        await pool.query(
          \\\`INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
           VALUES (\\\$1, \\\$2, \\\$2, 'credential', \\\$3, \\\$4, \\\$4)
           ON CONFLICT DO NOTHING\\\`,
          [require('crypto').randomUUID(), userId, passwordHash, now]
        );

        console.log('Admin user created: ${ADMIN_EMAIL}');
        await pool.end();
      }
      main().catch(e => { console.error(e); process.exit(1); });
    "

  # ---- Write setup completion marker ----
  - echo "CommonPub setup completed at \$(date)" > /opt/commonpub/.setup-complete

  # ---- Final status ----
  - echo "============================================"
  - echo "CommonPub instance is ready!"
  - echo "  URL: https://${INSTANCE_DOMAIN}"
  - echo "  Admin: ${ADMIN_EMAIL}"
  - echo "============================================"
CLOUD_INIT_EOF
)

ok "Cloud-init configuration generated"

# ---- Summary ----
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Deployment Summary${NC}                                 ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Instance:${NC}    $INSTANCE_NAME"
echo -e "  ${BOLD}Domain:${NC}      $INSTANCE_DOMAIN"
echo -e "  ${BOLD}Admin:${NC}       $ADMIN_EMAIL ($ADMIN_USERNAME)"
echo -e "  ${BOLD}Droplet:${NC}     $DROPLET_NAME ($DO_SIZE in $DO_REGION)"
echo -e "  ${BOLD}SSH Key:${NC}     ${SSH_KEY_ID}"
echo ""
echo -e "  ${BOLD}Features:${NC}"
[[ "$FEAT_CONTENT" == "true" ]]    && echo "    ✓ Content"
[[ "$FEAT_SOCIAL" == "true" ]]     && echo "    ✓ Social"
[[ "$FEAT_HUBS" == "true" ]]       && echo "    ✓ Hubs"
[[ "$FEAT_DOCS" == "true" ]]       && echo "    ✓ Documentation"
[[ "$FEAT_LEARNING" == "true" ]]   && echo "    ✓ Learning Paths"
[[ "$FEAT_EXPLAINERS" == "true" ]] && echo "    ✓ Explainers"
[[ "$FEAT_CONTESTS" == "true" ]]   && echo "    ✓ Contests"
[[ "$FEAT_VIDEO" == "true" ]]      && echo "    ✓ Video"
[[ "$FEAT_FEDERATION" == "true" ]] && echo "    ✓ Federation"
[[ "$FEAT_ADMIN" == "true" ]]      && echo "    ✓ Admin Panel"
echo ""
echo -e "  ${BOLD}Content Types:${NC} $CONTENT_TYPES"
echo ""
COST_ESTIMATE="varies"
case "$DO_SIZE" in
  s-1vcpu-2gb) COST_ESTIMATE='$12/mo' ;;
  s-2vcpu-4gb) COST_ESTIMATE='$24/mo' ;;
  s-4vcpu-8gb) COST_ESTIMATE='$48/mo' ;;
esac
echo -e "  ${BOLD}Estimated cost:${NC} $COST_ESTIMATE"
echo ""

if $DRY_RUN; then
  warn "DRY RUN — no resources will be created"
  echo ""
  info "Cloud-init user-data (first 50 lines):"
  echo "$USER_DATA" | head -50
  echo "  ... (truncated)"
  echo ""
  info "doctl command that would run:"

  DOCTL_CMD="doctl compute droplet create \"$DROPLET_NAME\" \\
    --region \"$DO_REGION\" \\
    --size \"$DO_SIZE\" \\
    --image ubuntu-24-04-x64"

  if [[ "$SSH_KEY_ID" != "none" ]]; then
    DOCTL_CMD="$DOCTL_CMD \\
    --ssh-keys \"$SSH_KEY_ID\""
  fi

  DOCTL_CMD="$DOCTL_CMD \\
    --user-data-file <(cloud-init) \\
    --tag-name commonpub \\
    --wait"

  echo "  $DOCTL_CMD"
  echo ""
  ok "Dry run complete. Remove --dry-run to deploy."
  exit 0
fi

# ---- Confirm ----
echo -e "${YELLOW}This will create a DigitalOcean droplet and associated resources.${NC}"
read -rp "  Proceed? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# ---- Write cloud-init to temp file ----
USERDATA_FILE=$(mktemp)
echo "$USER_DATA" > "$USERDATA_FILE"

# ---- Create Droplet ----
info "Creating droplet '$DROPLET_NAME'..."

DOCTL_ARGS=(
  compute droplet create "$DROPLET_NAME"
  --region "$DO_REGION"
  --size "$DO_SIZE"
  --image ubuntu-24-04-x64
  --user-data-file "$USERDATA_FILE"
  --tag-name commonpub
  --wait
)

if [[ "$SSH_KEY_ID" != "none" ]]; then
  DOCTL_ARGS+=(--ssh-keys "$SSH_KEY_ID")
fi

doctl "${DOCTL_ARGS[@]}"

# Clean up temp file
rm -f "$USERDATA_FILE"

# ---- Get droplet IP ----
DROPLET_IP=$(doctl compute droplet list --tag-name commonpub --format Name,PublicIPv4 --no-header 2>/dev/null | grep "^${DROPLET_NAME}" | awk '{print $2}')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}Droplet Created!${NC}                                   ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}IP Address:${NC}  $DROPLET_IP"
echo -e "  ${BOLD}Domain:${NC}      $INSTANCE_DOMAIN"
echo ""
echo -e "  ${YELLOW}IMPORTANT: Point your DNS!${NC}"
echo -e "  Create an A record: ${BOLD}${INSTANCE_DOMAIN} → ${DROPLET_IP}${NC}"
echo -e "  Create an A record: ${BOLD}www.${INSTANCE_DOMAIN} → ${DROPLET_IP}${NC}"
echo ""
echo -e "  The droplet is now bootstrapping (5-10 minutes)."
echo -e "  Cloud-init will:"
echo -e "    1. Install Docker"
echo -e "    2. Clone and build CommonPub"
echo -e "    3. Start all services (Caddy, Postgres, Redis, Meilisearch)"
echo -e "    4. Push database schema"
echo -e "    5. Create admin user (${ADMIN_EMAIL})"
echo ""
echo -e "  ${BOLD}Monitor progress:${NC}"
echo -e "    ssh root@${DROPLET_IP} tail -f /var/log/cloud-init-output.log"
echo ""
echo -e "  ${BOLD}Check if setup is complete:${NC}"
echo -e "    ssh root@${DROPLET_IP} cat /opt/commonpub/.setup-complete"
echo ""
echo -e "  Once DNS propagates and setup completes:"
echo -e "    ${GREEN}https://${INSTANCE_DOMAIN}${NC}"
echo -e "    Login: ${ADMIN_EMAIL}"
echo ""

# ---- Save deployment info ----
DEPLOY_INFO_FILE="${SCRIPT_DIR}/.last-deploy-${INSTANCE_SLUG}.json"
cat > "$DEPLOY_INFO_FILE" << DEPLOYEOF
{
  "dropletName": "${DROPLET_NAME}",
  "dropletIp": "${DROPLET_IP}",
  "domain": "${INSTANCE_DOMAIN}",
  "instanceName": "${INSTANCE_NAME}",
  "adminEmail": "${ADMIN_EMAIL}",
  "adminUsername": "${ADMIN_USERNAME}",
  "region": "${DO_REGION}",
  "size": "${DO_SIZE}",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
DEPLOYEOF

ok "Deployment info saved to ${DEPLOY_INFO_FILE}"
ok "Done! Your CommonPub instance will be ready in ~10 minutes."
