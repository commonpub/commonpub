# Session 034 — Production Features (RSS, SEO, Storage, Email, Real-time, Docker)

Date: 2026-03-16

## What Was Done

### DB Schema Sync
Fixed schema/DB drift — the Drizzle schema had columns, tables, and enums that didn't exist in Postgres:
- Added 6 columns to `content_items` (license_type, series, estimated_minutes, canonical_url, ap_object_id, deleted_at)
- Added 4 columns to `users` (pronouns, timezone, email_notifications, deleted_at)
- Added 7 columns to `communities` (hub_type, privacy, parent_hub_id, website, categories, ap_actor_id, deleted_at)
- Added `status` to `community_members`, `last_edited_at` to `community_posts`
- Added 5 columns to `files` (original_name, content_id, hub_id, width, height)
- Created 3 new tables: `products`, `content_products`, `content_versions`
- Created 7 new enums: hub_type, hub_privacy, hub_role, hub_join_policy, hub_member_status, product_status, product_category
- Migrated `communities.join_policy` (community_join_policy -> hub_join_policy) and `community_members.role` (community_role -> hub_role)
- Added 'hub' to notification_type enum

### Performance Indexes (17 total)
All hot-path indexes from Phase 1.3 of the plan: content (author, type+status, published), hub (posts, shares), social (comments, likes, follows), product (content_products, products_hub), learning (enrollments, lesson_progress), federation (activities_pending).

### RSS Feeds
- `/feed.xml` — site-wide published content (Nitro server route)
- `/api/users/:username/feed.xml` — user's published content
- `/api/hubs/:slug/feed.xml` — hub gallery content
- RSS `<link>` tag added to default layout

### Sitemap + robots.txt
- `/sitemap.xml` — auto-generated from published content, users, hubs, learning paths
- `/robots.txt` — disallows /api/, /admin/, /settings/, references sitemap

### SEO — JSON-LD Structured Data
- `useJsonLd` composable — supports Article, HowTo, Course, Video, Person, Organization types
- Added to all 4 view components:
  - ArticleView → schema.org/Article
  - BlogView → schema.org/Article
  - ProjectView → schema.org/HowTo (with difficulty, estimatedTime, estimatedCost)
  - ExplainerView → schema.org/Article

### Storage Adapter
- `packages/server/src/storage.ts`:
  - `StorageAdapter` interface (upload, delete, getUrl)
  - `LocalStorageAdapter` — filesystem storage for dev
  - `S3StorageAdapter` — S3-compatible for production (AWS, MinIO, R2)
  - `generateStorageKey()`, `validateUpload()` helpers
  - MIME type whitelist, size limits per purpose

### Email System
- `packages/server/src/email.ts`:
  - `EmailAdapter` interface
  - `SmtpEmailAdapter` — nodemailer-based SMTP (dynamic import)
  - `ConsoleEmailAdapter` — dev logging
  - 5 pre-built templates: verification, passwordReset, notificationDigest, contestAnnouncement, certificateIssued
  - Templates use inline CSS matching the design system (dark theme, blue accent, JetBrains Mono)

### Real-time Notifications (SSE)
- `GET /api/notifications/stream` — Server-Sent Events endpoint
- `useNotifications` composable — reactive count, auto-reconnect on disconnect
- Polls DB every 10s, keepalive every 30s

### Docker / Deployment
- Updated Dockerfile: removed prod-deps stage (Nuxt .output is self-contained), fixed CMD to `.output/server/index.mjs`
- Updated deploy test to match new Dockerfile structure
- Added SMTP config vars to `.env.prod.example`

### DB Step B Migration Script
- `deploy/migrations/001-rename-communities-to-hubs.sql` — ready to execute
- Renames all community_* tables → hub_*, columns community_id → hub_id
- Drops stale community_join_policy and community_role enums

## Build & Test Results
- 13 packages build, 27 test suites pass

## Decisions
- Removed prod-deps Docker stage — Nuxt's `.output` is self-contained with all dependencies bundled
- SSE polling (10s) instead of push-based notifications — simpler, no Redis pub/sub needed for single-instance
- nodemailer is a dynamic import (not a hard dependency) — keeps the server package lighter when email isn't configured

## What's Remaining
1. E2E tests (Playwright)
2. Execute DB Step B rename + update schema pgTable names
3. WebSocket for messaging
4. Image processing (sharp thumbnails)
5. Meilisearch integration
6. Component tests (axe-core)
7. Validation sweep (~25 endpoints)
8. Federation (Phase 7, deferred)
