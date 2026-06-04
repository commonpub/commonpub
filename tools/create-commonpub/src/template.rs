use crate::prompts::InstanceConfig;
use rand::RngCore;

/// Generate a `byte_len`-byte hex-encoded token via the OS CSPRNG.
///
/// Used in `render_env` to auto-generate `NUXT_AUTH_SECRET` and
/// `CPUB_FED_TOKEN_KEY` so scaffolded instances ship with unique,
/// strong secrets instead of placeholder text. Equivalent to
/// `openssl rand -hex <byte_len>`. Each invocation pulls fresh bytes
/// from `OsRng` (never the thread RNG; never a derived state).
///
/// 32 bytes (64 hex chars) is the size both consumers require:
///   - `NUXT_AUTH_SECRET` is the Better Auth signing key. Better Auth
///     enforces a minimum-length check; 32 bytes is well above it.
///   - `CPUB_FED_TOKEN_KEY` is the ChaCha20-Poly1305 key for
///     `@commonpub/infra/tokenCrypto`. ChaCha20-Poly1305 keys MUST
///     be exactly 32 bytes per RFC 8439.
pub fn generate_hex_token(byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// ── Published @commonpub/* version pins ───────────────────────────────
//
// SINGLE SOURCE OF TRUTH for what a freshly-scaffolded instance depends
// on. These MUST be bumped whenever the corresponding package publishes
// a new minor — CommonPub uses tight 0.x caret semantics (`^0.21.1`
// means `>=0.21.1 <0.22.0`), so a stale pin here means a brand-new
// instance installs an ancient layer that predates current migrations
// and the identity system.
//
// RELEASE CHECKLIST: after `pnpm publish` of any of these packages,
// update the matching constant below and rebuild the CLI. Keep these
// in lockstep with deveco.io's package.json pins (the proven
// production thin-app reference).
//
// Last synced: 2026-06-03 (session 188, federation discovery & hardening +
// commonpub.io-as-default-registry; layer 0.49.0 = contest overhaul) — layer 0.49.0, server 2.74.0, schema
// 0.26.0, config 0.18.0. config 0.18.0 flips `announceToRegistry` to default
// ON, so a freshly-scaffolded instance announces to commonpub.io out of the
// box (heartbeat self-skips if it is its own registry; requires federation).
// The lockstep-pin rule still holds: bump `@commonpub/server` alongside
// `@commonpub/layer` whenever server crosses minor, else pnpm hoists an older
// server and the layer's server-subpath imports resolve to undefined.
const COMMONPUB_CONFIG_VERSION: &str = "^0.18.0";
const COMMONPUB_LAYER_VERSION: &str = "^0.49.0";
const COMMONPUB_SCHEMA_VERSION: &str = "^0.27.0";
const COMMONPUB_SERVER_VERSION: &str = "^2.74.0";

// pnpm pin for the generated Dockerfile. `pnpm@latest` is a time-bomb:
// pnpm ≥10.11 fails `install --frozen-lockfile` on packages with
// build scripts (sharp, esbuild, @parcel/watcher) unless they're
// explicitly approved. Match commonpub + deveco's pinned version.
const PNPM_VERSION: &str = "10.10.0";

pub fn render_package_json(config: &InstanceConfig) -> String {
    format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {{
    "build": "nuxt build",
    "dev": "nuxt dev",
    "preview": "nuxt preview",
    "db:push": "drizzle-kit push",
    "db:migrate": "node scripts/db-migrate.mjs",
    "db:studio": "drizzle-kit studio"
  }},
  "dependencies": {{
    "@commonpub/config": "{config_version}",
    "@commonpub/layer": "{layer_version}",
    "@commonpub/schema": "{schema_version}",
    "@commonpub/server": "{server_version}",
    "drizzle-orm": "^0.45.1",
    "nuxt": "^3.16.0",
    "pg": "^8.13.0",
    "vue": "^3.4.0",
    "vue-router": "^4.3.0"
  }},
  "devDependencies": {{
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.7.0",
    "vue-tsc": "^2.2.0"
  }}
}}
"#,
        name = config.name,
        config_version = COMMONPUB_CONFIG_VERSION,
        layer_version = COMMONPUB_LAYER_VERSION,
        schema_version = COMMONPUB_SCHEMA_VERSION,
        server_version = COMMONPUB_SERVER_VERSION,
    )
}

/// Non-interactive migration runner — mirrors deveco.io's proven
/// `scripts/db-migrate.mjs`. Applies the committed SQL migrations
/// shipped inside `@commonpub/schema`. This is the CLAUDE.md-mandated
/// path; `drizzle-kit push` (the `db:push` script) is dev-only and
/// must NEVER run in CI.
pub fn render_db_migrate_script() -> String {
    r#"/**
 * Non-interactive schema-migration wrapper for CI/deploy.
 *
 * Uses drizzle-orm's native `migrate()` (node-postgres) to apply the
 * committed SQL files shipped inside @commonpub/schema. Tracks applied
 * migrations in `drizzle.__drizzle_migrations`. Idempotent.
 *
 * Run this on every deploy BEFORE starting the app. Do NOT use
 * `drizzle-kit push` in production — it diffs+mutates the live schema
 * without the migration ledger and can drop columns.
 *
 *   node scripts/db-migrate.mjs
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('db:migrate requires NUXT_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

const migrationsFolder =
  process.env.DRIZZLE_MIGRATIONS_FOLDER ||
  './node_modules/@commonpub/schema/migrations';

const pool = new pg.Pool({ connectionString: url, max: 2 });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log('db:migrate succeeded');
} catch (err) {
  console.error('db:migrate failed:', err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
} finally {
  await pool.end();
}
"#.to_string()
}

pub fn render_nuxt_config(config: &InstanceConfig) -> String {
    let content_types = config.content_types.to_vec();

    format!(
        r#"export default defineNuxtConfig({{
  extends: ['@commonpub/layer'],
  compatibilityDate: '2024-11-01',
  devtools: {{ enabled: true }},
  app: {{
    head: {{
      link: [
        {{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }},
      ],
    }},
  }},
  css: [
    '~/assets/theme.css',
  ],
  runtimeConfig: {{
    public: {{
      siteName: '{name}',
      siteDescription: '{description}',
      features: {{
        content: {content},
        social: {social},
        hubs: {hubs},
        docs: {docs},
        video: {video},
        contests: {contests},
        learning: {learning},
        explainers: {explainers},
        federation: {federation},
        admin: {admin},
      }},
      contentTypes: '{content_types}',
      contestCreation: '{contest_creation}',
    }},
  }},
  nitro: {{
    preset: 'node-server',
    publicAssets: [
      {{
        dir: '../uploads',
        baseURL: '/uploads',
        maxAge: 60 * 60 * 24,
      }},
    ],
  }},
  vite: {{
    server: {{
      fs: {{
        allow: ['..'],
      }},
    }},
  }},
}});
"#,
        name = config.name,
        description = config.description,
        content = config.feature_content,
        social = config.feature_social,
        hubs = config.feature_hubs,
        docs = config.feature_docs,
        video = config.feature_video,
        contests = config.feature_contests,
        learning = config.feature_learning,
        explainers = config.feature_explainers,
        federation = config.feature_federation,
        admin = config.feature_admin,
        content_types = content_types.join(","),
        contest_creation = config.contest_creation,
    )
}

pub fn render_config(config: &InstanceConfig) -> String {
    let content_types_str = if !config.content_types.is_empty() {
        let types: Vec<String> = config.content_types.iter().map(|t| format!("'{}'", t)).collect();
        format!("\n    contentTypes: [{}],", types.join(", "))
    } else {
        String::new()
    };

    let contest_creation_str = if config.feature_contests {
        format!("\n    contestCreation: '{}',", config.contest_creation)
    } else {
        String::new()
    };

    format!(
        r#"import {{ defineCommonPubConfig }} from '@commonpub/config';

export default defineCommonPubConfig({{
  instance: {{
    name: '{name}',
    domain: '{domain}',
    description: '{description}',{content_types_str}{contest_creation_str}
  }},
  features: {{
    content: {content},
    social: {social},
    hubs: {hubs},
    docs: {docs},
    video: {video},
    contests: {contests},
    learning: {learning},
    explainers: {explainers},
    federation: {federation},
    admin: {admin},
  }},
  auth: {{
    emailPassword: {email_password},
    magicLink: {magic_link},
    passkeys: {passkeys},
  }},
}});
"#,
        name = config.name,
        domain = config.domain,
        description = config.description,
        content = config.feature_content,
        social = config.feature_social,
        hubs = config.feature_hubs,
        docs = config.feature_docs,
        video = config.feature_video,
        contests = config.feature_contests,
        learning = config.feature_learning,
        explainers = config.feature_explainers,
        federation = config.feature_federation,
        admin = config.feature_admin,
        email_password = config.auth_email_password,
        magic_link = config.auth_magic_link,
        passkeys = config.auth_passkeys,
    )
}

pub fn render_server_config() -> String {
    r#"// Singleton CommonPub config for Nitro server
//
// This file MUST live in the app (not the layer) because Nitro deduplicates
// server/utils by filename — the app's copy wins over the layer's.
//
// Reads from commonpub.config.ts, allows env vars to override feature flags.
import { type CommonPubConfig } from '@commonpub/config';
import siteConfig from '~/commonpub.config';

let cachedConfig: CommonPubConfig | null = null;

function envBool(key: string): boolean | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return undefined;
  return val !== 'false' && val !== '0';
}

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();
  const { config } = siteConfig;

  const domain = (runtimeConfig.public.domain as string) || config.instance.domain;
  const name = (runtimeConfig.public.siteName as string) || config.instance.name;
  const description = (runtimeConfig.public.siteDescription as string) || config.instance.description;

  const features = { ...config.features };
  const envOverrides: Record<string, string> = {
    content: 'FEATURE_CONTENT',
    social: 'FEATURE_SOCIAL',
    hubs: 'FEATURE_HUBS',
    docs: 'FEATURE_DOCS',
    video: 'FEATURE_VIDEO',
    contests: 'FEATURE_CONTESTS',
    learning: 'FEATURE_LEARNING',
    explainers: 'FEATURE_EXPLAINERS',
    federation: 'FEATURE_FEDERATION',
    federateHubs: 'FEATURE_FEDERATE_HUBS',
    seamlessFederation: 'FEATURE_SEAMLESS_FEDERATION',
    admin: 'FEATURE_ADMIN',
    emailNotifications: 'FEATURE_EMAIL_NOTIFICATIONS',
  };

  for (const [flag, envKey] of Object.entries(envOverrides)) {
    const envVal = envBool(envKey) ?? envBool(`NUXT_PUBLIC_FEATURES_${envKey.replace('FEATURE_', '')}`);
    if (envVal !== undefined) {
      (features as Record<string, boolean>)[flag] = envVal;
    }
  }

  cachedConfig = {
    ...config,
    instance: { ...config.instance, domain, name, description },
    features,
  };

  return cachedConfig;
}
"#.to_string()
}

pub fn render_site_logo(config: &InstanceConfig) -> String {
    format!(
        r#"<template>
  <span class="site-logo">{{ name }}</span>
</template>

<script setup lang="ts">
const name = '{name}';
</script>

<style scoped>
.site-logo {{
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  font-size: 1.125rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}}
</style>
"#,
        name = config.name,
    )
}

pub fn render_theme_css(config: &InstanceConfig) -> String {
    let theme_preset = match config.theme.as_str() {
        "dark" => r#"  /* dark — dark surfaces, same offset shadow aesthetic */
  /* Set data-theme="dark" on <html> to activate */
  /* --accent: #5b9cf6; */"#,
        "generics" => r#"  /* generics — dark minimal with soft glow shadows */
  /* Set data-theme="generics" on <html> to activate */
  /* --accent: #5b9cf6; */"#,
        "agora" => r#"  /* agora — warm parchment, green accent, serif display font */
  /* Set data-theme="agora" on <html> to activate */
  /* --accent: #3d8b5e; */
  /* --font-heading: 'Fraunces', Georgia, serif; */
  /* --font-body: 'Work Sans', system-ui, sans-serif; */"#,
        "agora-dark" => r#"  /* agora-dark — grove-tinted darks, green accent, serif display font */
  /* Set data-theme="agora-dark" on <html> to activate */
  /* --accent: #4aa06e; */
  /* --font-heading: 'Fraunces', Georgia, serif; */
  /* --font-body: 'Work Sans', system-ui, sans-serif; */"#,
        _ => r#"  /* base — sharp corners, 2px borders, offset shadows (CommonPub default) */
  /* --accent: #5b9cf6; */
  /* --radius: 0px; */
  /* --border-width-default: 2px; */"#,
    };

    format!(
        r#"/*
 * Theme overrides for {name}
 *
 * The layer provides all default styles. Override CSS custom properties
 * here to customize the look and feel of your instance.
 *
 * Available variables:
 *   --accent         Primary accent color
 *   --font-sans      Body font family
 *   --font-mono      Code/label font family
 *   --radius         Border radius
 *   --border-width-default  Border width (2px base, 1px for softer look)
 *   --shadow-sm/md/lg       Box shadows
 *   --surface/surface2      Background colors
 *   --text/text2            Text colors
 */

:root {{
{theme_preset}
}}
"#,
        name = config.name,
    )
}

pub fn render_favicon() -> String {
    r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="4" fill="#5b9cf6"/>
  <text x="16" y="22" font-family="monospace" font-size="18" font-weight="bold" fill="white" text-anchor="middle">C</text>
</svg>
"##.to_string()
}

pub fn render_env(config: &InstanceConfig) -> String {
    // Auto-generate cryptographically-strong secrets at scaffold time
    // so the operator never has to remember `openssl rand -hex 32`.
    // Each scaffolded instance gets unique values — keys MUST be
    // per-instance (commonpub.io must not be able to decrypt deveco.io's
    // stored OAuth bearer tokens, etc).
    let auth_secret = generate_hex_token(32);
    let fed_token_key = generate_hex_token(32);
    let mut env = format!(
        r#"# {name} — CommonPub Instance

# Database
NUXT_DATABASE_URL={database_url}

# Redis
REDIS_URL={redis_url}

# Auth — Better Auth signing key. Auto-generated at scaffold time
# via OsRng (equivalent to `openssl rand -hex 32`). If you ever need
# to rotate: change the value, restart the app, all existing sessions
# will be invalidated (users must re-log-in). Keep this OUT of source
# control.
NUXT_AUTH_SECRET={auth_secret}

# Cross-instance identity token encryption (ChaCha20-Poly1305 key,
# 32 bytes hex, per RFC 8439). Used by @commonpub/infra/tokenCrypto
# to encrypt remote OAuth bearer tokens at rest in `federated_accounts`.
# Auto-generated at scaffold time via OsRng (equivalent to
# `openssl rand -hex 32`). Required ONLY if you enable any
# features.identity.* flag other than `actingAs`
# (linkRemoteAccounts / signInWithRemote / remoteInteract /
# remotePublish). The app refuses to boot if a token-using identity
# flag is on without this set. Rotating means: re-encrypting every
# row in federated_accounts before swapping the env var — there is
# NO online key rotation; plan a maintenance window.
CPUB_FED_TOKEN_KEY={fed_token_key}

# Admin bootstrap — runs once, when the instance has no admin yet.
#   ADMIN_BOOTSTRAP_USER=<username>  → that user is promoted to admin
#     on the next boot after they register. The canonical way to set
#     the admin directly.
#   ADMIN_BOOTSTRAP_FIRST_USER=true  → the FIRST user to register
#     becomes admin (zero-config; ideal for one-click deploys). Only
#     honoured in production when explicitly set to true.
# In dev (NODE_ENV != production) the first user is always admin.
{admin_env}

# Site
NUXT_PUBLIC_SITE_URL=http://{domain}
NUXT_PUBLIC_DOMAIN={domain}

# Email — "console" (dev), "smtp", or "resend"
NUXT_EMAIL_ADAPTER=console
# NUXT_SMTP_HOST=
# NUXT_SMTP_PORT=587
# NUXT_SMTP_USER=
# NUXT_SMTP_PASS=
# NUXT_SMTP_FROM=noreply@{domain}
# NUXT_RESEND_API_KEY=
# NUXT_RESEND_FROM=noreply@{domain}

# Storage — set S3_BUCKET to enable S3/DO Spaces, otherwise local ./uploads.
# NOTE: the app reads bare S3_* vars (the NUXT_-prefixed form is inert).
# DigitalOcean Spaces + CDN (recommended for production):
#   1. Create a Space; enable its CDN (DO console -> Space -> Settings -> CDN).
#   2. Uncomment + fill the vars below. With S3_CDN=true and S3_PUBLIC_URL
#      left unset, assets are served from the CDN edge
#      (https://<bucket>.<region>.cdn.digitaloceanspaces.com).
# S3_BUCKET=
# S3_REGION=nyc3
# S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
# S3_CDN=true
# S3_PUBLIC_URL=   # optional explicit override; leave unset to auto-derive the CDN URL
"#,
        name = config.name,
        domain = config.domain,
        database_url = config.database_url,
        redis_url = config.redis_url,
        auth_secret = auth_secret,
        fed_token_key = fed_token_key,
        admin_env = match &config.admin_user {
            Some(u) => format!("ADMIN_BOOTSTRAP_USER={}", u),
            None => "ADMIN_BOOTSTRAP_FIRST_USER=true".to_string(),
        },
    );

    if config.auth_github {
        env.push_str("\n# GitHub OAuth\nGITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET=\n");
    }
    if config.auth_google {
        env.push_str("\n# Google OAuth\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n");
    }

    env
}

pub fn render_env_example(config: &InstanceConfig) -> String {
    format!(
        r#"# Copy to .env and fill in values.
# `.env` is auto-generated by `create-commonpub` with real, unique
# secrets — this file is the template / reset reference. NEVER reuse
# these placeholder secret values; generate fresh ones via:
#   openssl rand -hex 32

NUXT_DATABASE_URL=postgresql://commonpub:commonpub_dev@localhost:5432/commonpub
REDIS_URL=redis://localhost:6379
# Better Auth signing key — 32 bytes hex. Run: openssl rand -hex 32
NUXT_AUTH_SECRET=REPLACE_WITH_openssl_rand_hex_32
# Cross-instance identity token encryption — 32 bytes hex (ChaCha20-Poly1305).
# Only required if any features.identity.* flag (except actingAs) is enabled.
# Run: openssl rand -hex 32
# CPUB_FED_TOKEN_KEY=REPLACE_WITH_openssl_rand_hex_32
NUXT_PUBLIC_SITE_URL=http://{domain}
NUXT_PUBLIC_DOMAIN={domain}
NUXT_EMAIL_ADAPTER=console

# Admin bootstrap (pick one; see .env for details):
# ADMIN_BOOTSTRAP_USER=your-username
ADMIN_BOOTSTRAP_FIRST_USER=true
"#,
        domain = config.domain,
    )
}

/// DigitalOcean App Platform deploy spec. Lets a user click
/// "Deploy to DigitalOcean" in the README and get a running instance
/// with a managed Postgres + Valkey, no SSH/Nginx/Certbot. The admin
/// is bootstrapped via env (ADMIN_BOOTSTRAP_USER if the operator set
/// one at scaffold time, else ADMIN_BOOTSTRAP_FIRST_USER so the first
/// signup is admin). NUXT_DATABASE_URL is bound to the managed DB.
///
/// DO reads `.do/deploy.template.yaml` (note the `spec:` root, unlike
/// a plain app.yaml). The user can edit any env in the DO console
/// before clicking Create.
pub fn render_do_app_spec(config: &InstanceConfig) -> String {
    let admin_env = match &config.admin_user {
        Some(u) => format!(
            "        - key: ADMIN_BOOTSTRAP_USER\n          scope: RUN_TIME\n          value: \"{}\"",
            u
        ),
        None => "        - key: ADMIN_BOOTSTRAP_FIRST_USER\n          scope: RUN_TIME\n          value: \"true\""
            .to_string(),
    };

    // Auto-generate strong defaults so the one-click deploy works
    // without manual env editing. Operators can rotate these in the
    // DO console (Settings → Environment Variables) after deploy.
    // Each scaffold gets unique values — never reuse keys across
    // instances (CPUB_FED_TOKEN_KEY is per-instance by design).
    let auth_secret = generate_hex_token(32);
    let fed_token_key = generate_hex_token(32);

    // svc name must be lowercase/dns-safe; the instance name may not be.
    let svc = sanitize_dns(&config.name);

    format!(
        r#"spec:
  name: {svc}
  region: nyc
  services:
    - name: web
      dockerfile_path: Dockerfile
      source_dir: /
      http_port: 3000
      instance_count: 1
      instance_size_slug: basic-xs
      health_check:
        http_path: /api/health
      envs:
        - key: NODE_ENV
          scope: RUN_AND_BUILD_TIME
          value: "production"
        - key: NUXT_HOST
          scope: RUN_TIME
          value: "0.0.0.0"
        - key: NUXT_PORT
          scope: RUN_TIME
          value: "3000"
        - key: NUXT_DATABASE_URL
          scope: RUN_TIME
          value: "${{db.DATABASE_URL}}"
        - key: NUXT_AUTH_SECRET
          scope: RUN_TIME
          type: SECRET
          value: "{auth_secret}"
        - key: CPUB_FED_TOKEN_KEY
          scope: RUN_TIME
          type: SECRET
          value: "{fed_token_key}"
        - key: NUXT_PUBLIC_SITE_URL
          scope: RUN_TIME
          value: "${{APP_URL}}"
        - key: NUXT_PUBLIC_DOMAIN
          scope: RUN_TIME
          value: "${{APP_DOMAIN}}"
        - key: NUXT_EMAIL_ADAPTER
          scope: RUN_TIME
          value: "console"
{admin_env}
  databases:
    - name: db
      engine: PG
      version: "16"
      production: false
"#,
        svc = svc,
        admin_env = admin_env,
        auth_secret = auth_secret,
        fed_token_key = fed_token_key,
    )
}

/// Lowercase + strip to DNS-label-safe chars for the DO app name.
fn sanitize_dns(name: &str) -> String {
    let s: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = s.trim_matches('-').to_string();
    if trimmed.is_empty() { "commonpub-instance".to_string() } else { trimmed }
}

pub fn render_dockerfile() -> String {
    format!(
        r#"# pnpm is pinned (NOT @latest) on purpose: pnpm >=10.11 changed
# install/build-script behaviour; pinning gives reproducible builds.
# The lockfile is COPYed if present (the glob tolerates its absence
# so a fresh one-click deploy — which has no committed lockfile yet —
# still builds). Plain `pnpm install` honours a committed
# pnpm-lock.yaml when present and generates one otherwise. For fully
# reproducible deploys, run `pnpm install` locally and commit
# pnpm-lock.yaml (see README).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@{pnpm} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/package.json ./package.json
RUN corepack enable && corepack prepare pnpm@{pnpm} --activate
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
EXPOSE 3000
# Apply committed migrations, then start. db:migrate is idempotent —
# safe to run on every boot. Never `drizzle-kit push` in production.
CMD ["sh", "-c", "node scripts/db-migrate.mjs && node .output/server/index.mjs"]
"#,
        pnpm = PNPM_VERSION,
    )
}

pub fn render_docker_compose(_config: &InstanceConfig) -> String {
    r#"services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: commonpub
      POSTGRES_PASSWORD: commonpub_dev
      POSTGRES_DB: commonpub
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  meilisearch:
    image: getmeili/meilisearch:v1.10
    environment:
      MEILI_MASTER_KEY: commonpub_dev_key
    ports:
      - '7700:7700'
    volumes:
      - meilidata:/meili_data

volumes:
  pgdata:
  meilidata:
"#.to_string()
}

pub fn render_deploy_workflow(config: &InstanceConfig) -> String {
    format!(
        r#"name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t {name} .

      # Add your deployment steps here:
      # - Push to container registry
      # - Deploy to your server
      #
      # Database migrations run automatically: the Dockerfile's CMD is
      # `node scripts/db-migrate.mjs && node .output/server/index.mjs`,
      # so committed @commonpub/schema migrations apply on every boot
      # (idempotent). Do NOT add a `drizzle-kit push` step — that
      # bypasses the migration ledger and can drop columns.
      #
      # Example for DigitalOcean:
      # - name: Push to DO Registry
      #   run: |
      #     doctl registry login
      #     docker tag {name} registry.digitalocean.com/your-registry/{name}
      #     docker push registry.digitalocean.com/your-registry/{name}
"#,
        name = config.name,
    )
}

pub fn render_drizzle_config(config: &InstanceConfig) -> String {
    format!(
        r#"import type {{ Config }} from 'drizzle-kit';

export default {{
  schema: './node_modules/@commonpub/schema/dist/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {{
    url: process.env.NUXT_DATABASE_URL || '{database_url}',
  }},
}} satisfies Config;
"#,
        database_url = config.database_url,
    )
}

pub fn render_tsconfig() -> String {
    r#"{
  "extends": "./.nuxt/tsconfig.json"
}
"#.to_string()
}

pub fn render_gitignore() -> String {
    r#"# Dependencies
node_modules/

# Build
.nuxt/
.output/
dist/
drizzle/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Uploads (dev)
uploads/*
!uploads/.gitkeep
"#.to_string()
}

pub fn render_readme(config: &InstanceConfig) -> String {
    format!(
        r#"# {name}

{description}

Built with [CommonPub](https://commonpub.dev).

## One-click deploy

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/YOUR_GITHUB/{name}/tree/main)

Push this repo to GitHub, replace `YOUR_GITHUB` above with your
GitHub user/org, and click the button. DigitalOcean reads
`.do/deploy.template.yaml` and provisions the app + a managed
Postgres 16. **Before clicking Create in the DO console**, set
`NUXT_AUTH_SECRET` (run `openssl rand -hex 32`).

> **Reproducible builds (recommended):** run `pnpm install` locally
> once and commit the generated `pnpm-lock.yaml` before deploying.
> The Docker build works without it (a lockfile is generated at
> build time), but committing one pins exact dependency versions
> across every deploy.

**Admin:** {admin_note} You can change this any time by editing the
`ADMIN_BOOTSTRAP_*` env in the DO console (or `.env` for self-hosted).

> Migrations run automatically on every boot (the Docker `CMD`
> chains `db:migrate` before the server). Redis/Valkey is optional —
> CommonPub degrades to in-memory rate-limiting without it; add a
> managed Valkey DB in the DO console if you want shared state.

## Getting Started (local dev)

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Push database schema (dev only — prod uses committed migrations)
pnpm db:push

# Start dev server
pnpm dev
```

## Customization

- **Feature flags**: `commonpub.config.ts`
- **Theme**: `assets/theme.css` (CSS custom properties)
- **Logo**: `components/SiteLogo.vue`
- **Pages**: Add files in `pages/` to override layer pages

## Updating

```bash
pnpm update @commonpub/layer
```

All pages, components, and server routes update automatically. Your custom overrides are preserved.
"#,
        name = config.name,
        description = config.description,
        admin_note = match &config.admin_user {
            Some(u) => format!(
                "the user `{}` is promoted to admin once it registers and the app reboots (`ADMIN_BOOTSTRAP_USER`).",
                u
            ),
            None =>
                "the first user to register becomes admin (`ADMIN_BOOTSTRAP_FIRST_USER=true`)."
                    .to_string(),
        },
    )
}
