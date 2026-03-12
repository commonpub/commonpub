# CommonPub Deployment Guide

## Quick Start (Docker Compose)

The fastest way to run CommonPub in production:

```bash
# Clone the repository
git clone https://github.com/your-org/commonpub.git
cd commonpub

# Copy and configure environment
cp deploy/.env.prod.example deploy/.env
# Edit deploy/.env with your values (AUTH_SECRET, POSTGRES_PASSWORD, ORIGIN, etc.)

# Start all services
docker compose -f deploy/docker-compose.prod.yml up -d

# Verify
curl http://localhost:3000
```

## Production Deployment Options

### Option 1: Docker Compose on a VPS

Best for: single-server deployments, small-to-medium communities.

1. **Provision a server** (Ubuntu 22.04+ recommended, 2GB+ RAM)
2. **Run the setup script**:
   ```bash
   curl -sSL https://raw.githubusercontent.com/your-org/commonpub/main/deploy/droplet-setup.sh | sudo bash
   ```
3. **Deploy the application**:
   ```bash
   cd /opt/commonpub
   # Copy your docker-compose.prod.yml and .env
   sudo systemctl start commonpub
   ```
4. **Configure SSL**:
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/commonpub
   sudo ln -s /etc/nginx/sites-available/commonpub /etc/nginx/sites-enabled/
   # Edit /etc/nginx/sites-available/commonpub — replace YOUR_DOMAIN
   sudo certbot --nginx -d your-domain.com
   sudo systemctl reload nginx
   ```

### Option 2: DigitalOcean App Platform

Best for: managed deployment with zero server maintenance.

1. Fork the repository to your GitHub account
2. Create a new App on [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. Import the app spec: `deploy/app-spec.yaml`
4. Configure environment variables (AUTH_SECRET, ORIGIN, etc.)
5. Deploy

Or via CLI:

```bash
doctl apps create --spec deploy/app-spec.yaml
```

### Option 3: Pre-built Docker Image

```bash
docker pull ghcr.io/your-org/commonpub:latest

docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e AUTH_SECRET=your-secret \
  -e ORIGIN=https://your-domain.com \
  ghcr.io/your-org/commonpub:latest
```

## Environment Variables Reference

### Required

| Variable       | Description                           | Example                               |
| -------------- | ------------------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string          | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL`    | Redis connection string               | `redis://host:6379`                   |
| `AUTH_SECRET`  | Session signing secret (min 32 chars) | `openssl rand -base64 32`             |
| `ORIGIN`       | Public URL of the instance            | `https://your-domain.com`             |

### Instance Identity

| Variable               | Description                     | Default |
| ---------------------- | ------------------------------- | ------- |
| `INSTANCE_DOMAIN`      | Domain for federation/WebFinger | —       |
| `INSTANCE_NAME`        | Display name                    | —       |
| `INSTANCE_DESCRIPTION` | Short description               | —       |

### Feature Flags

| Variable              | Description                   | Default |
| --------------------- | ----------------------------- | ------- |
| `FEATURE_COMMUNITIES` | Enable community features     | `true`  |
| `FEATURE_DOCS`        | Enable docs module            | `true`  |
| `FEATURE_LEARNING`    | Enable learning paths         | `true`  |
| `FEATURE_EXPLAINERS`  | Enable interactive explainers | `true`  |
| `FEATURE_ADMIN`       | Enable admin panel            | `false` |
| `FEATURE_FEDERATION`  | Enable ActivityPub federation | `false` |

### Optional Services

| Variable               | Description                    |
| ---------------------- | ------------------------------ |
| `MEILI_URL`            | Meilisearch URL                |
| `MEILI_MASTER_KEY`     | Meilisearch API key            |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app ID            |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret            |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret            |
| `RESEND_API_KEY`       | Resend email API key           |
| `S3_ENDPOINT`          | S3-compatible storage endpoint |
| `S3_REGION`            | S3 region                      |
| `S3_BUCKET`            | S3 bucket name                 |
| `S3_ACCESS_KEY`        | S3 access key                  |
| `S3_SECRET_KEY`        | S3 secret key                  |
| `PLAUSIBLE_URL`        | Plausible analytics URL        |
| `PLAUSIBLE_DOMAIN`     | Plausible domain               |

## SSL/TLS Setup

### With Certbot (recommended)

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot auto-renews via systemd timer. Verify:

```bash
sudo certbot renew --dry-run
```

### With custom certificates

Edit `deploy/nginx.conf` and update the `ssl_certificate` and `ssl_certificate_key` paths.

## Backup Strategy

### Database

```bash
# Manual backup
docker exec cpub-postgres-1 pg_dump -U commonpub commonpub > backup-$(date +%Y%m%d).sql

# Restore
docker exec -i cpub-postgres-1 psql -U commonpub commonpub < backup-20240101.sql
```

### Automated backups (cron)

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * docker exec cpub-postgres-1 pg_dump -U commonpub commonpub | gzip > /backups/cpub-$(date +\%Y\%m\%d).sql.gz
```

### Volumes

Back up Docker volumes for Redis and Meilisearch data:

```bash
docker run --rm -v commonpub_postgres_data:/data -v /backups:/backups alpine tar czf /backups/postgres-data.tar.gz /data
docker run --rm -v commonpub_redis_data:/data -v /backups:/backups alpine tar czf /backups/redis-data.tar.gz /data
```

## Upgrading

```bash
cd /opt/commonpub

# Pull latest image
docker compose -f docker-compose.prod.yml pull app

# Restart with new image
docker compose -f docker-compose.prod.yml up -d app

# Verify health
curl http://localhost:3000
```

## Scaffolding a New Instance

Use the `create-commonpub` CLI:

```bash
# Install
cargo install create-commonpub

# Interactive setup
create-commonpub new my-community

# With defaults
create-commonpub new my-community --defaults
```

This generates a ready-to-deploy project with `.env`, `commonpub.config.ts`, `docker-compose.yml`, and `package.json`.
