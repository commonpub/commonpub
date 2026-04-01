use crate::prompts::InstanceConfig;

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
    "db:studio": "drizzle-kit studio"
  }},
  "dependencies": {{
    "@commonpub/config": "^0.7.0",
    "@commonpub/layer": "^0.1.1",
    "@commonpub/schema": "^0.8.7",
    "drizzle-orm": "^0.45.1",
    "nuxt": "^3.16.0",
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
    )
}

pub fn render_nuxt_config(config: &InstanceConfig) -> String {
    let content_types: Vec<String> = config.content_types.iter().map(|t| t.clone()).collect();

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
        "deveco" => r#"  /* deveco — rounded, soft shadows, green accent */
  --accent: #00e7ad;
  --font-sans: 'Poppins', system-ui, sans-serif;
  --radius: 6px;
  --border-width-default: 1px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);"#,
        "deepwood" => r#"  /* deepwood — warm earthy tones */
  --accent: #c4956a;
  --radius: 4px;
  --border-width-default: 1px;"#,
        "hackbuild" => r#"  /* hackbuild — terminal green on dark */
  --accent: #39ff14;
  --radius: 0px;
  --border-width-default: 1px;"#,
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
    let mut env = format!(
        r#"# {name} — CommonPub Instance

# Database
NUXT_DATABASE_URL={database_url}

# Redis
REDIS_URL={redis_url}

# Auth
NUXT_AUTH_SECRET=change-me-in-production-min-32-chars

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

# Storage — set S3_BUCKET to enable S3/DO Spaces, otherwise local ./uploads
# NUXT_S3_BUCKET=
# NUXT_S3_REGION=us-east-1
# NUXT_S3_ENDPOINT=
# NUXT_S3_ACCESS_KEY=
# NUXT_S3_SECRET_KEY=
# NUXT_S3_PUBLIC_URL=
"#,
        name = config.name,
        domain = config.domain,
        database_url = config.database_url,
        redis_url = config.redis_url,
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
        r#"# Copy to .env and fill in values

NUXT_DATABASE_URL=postgresql://commonpub:commonpub_dev@localhost:5432/commonpub
REDIS_URL=redis://localhost:6379
NUXT_AUTH_SECRET=change-me-in-production-min-32-chars
NUXT_PUBLIC_SITE_URL=http://{domain}
NUXT_PUBLIC_DOMAIN={domain}
NUXT_EMAIL_ADAPTER=console
"#,
        domain = config.domain,
    )
}

pub fn render_dockerfile() -> String {
    r#"FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/package.json ./package.json
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
"#.to_string()
}

pub fn render_docker_compose(_config: &InstanceConfig) -> String {
    format!(
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
"#
    )
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
      # - Run database migrations
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

## Getting Started

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Push database schema
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
    )
}
