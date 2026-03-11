# Deploy

Docker Compose configurations, infrastructure scripts, and deployment specs for Snaplify.

## Files

| File                          | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `docker-compose.yml`          | Local development (Postgres, Redis, Meilisearch)     |
| `docker-compose.prod.yml`     | Production deployment with app container             |
| `docker-compose.federation.yml`| Multi-instance setup for federation testing          |
| `app-spec.yaml`               | DigitalOcean App Platform deployment spec            |
| `nginx.conf`                  | Nginx reverse proxy with SSL termination             |
| `droplet-setup.sh`            | Server provisioning script (Ubuntu 22.04)            |
| `federation-seed.ts`          | Seed data for multi-instance federation testing      |

## Local Development

```bash
# Start all infrastructure services
docker compose -f deploy/docker-compose.yml up -d

# Check health
docker compose -f deploy/docker-compose.yml ps
```

Services:

| Service      | Port  | Credentials                    |
| ------------ | ----- | ------------------------------ |
| PostgreSQL   | 5432  | `snaplify:snaplify_dev`        |
| Redis        | 6379  | No auth                        |
| Meilisearch  | 7700  | Key: `snaplify_dev_key`        |

## Production

See the [Deployment Guide](../docs/deployment.md) for full instructions.

```bash
# Quick start
cp deploy/.env.prod.example deploy/.env
# Edit deploy/.env
docker compose -f deploy/docker-compose.prod.yml up -d
```

## Federation Testing

```bash
# Start two instances for federation testing
docker compose -f deploy/docker-compose.federation.yml up -d

# Seed test data
npx tsx deploy/federation-seed.ts
```

## DigitalOcean App Platform

```bash
doctl apps create --spec deploy/app-spec.yaml
```
