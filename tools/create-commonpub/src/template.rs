use crate::prompts::InstanceConfig;

pub fn render_env(config: &InstanceConfig) -> String {
    let mut env = format!(
        r#"# CommonPub Instance: {name}

# Database (Nuxt reads NUXT_DATABASE_URL for runtimeConfig.databaseUrl)
NUXT_DATABASE_URL={database_url}

# Redis
REDIS_URL={redis_url}

# Auth
AUTH_SECRET=change-me-in-production-min-32-chars
NUXT_AUTH_ORIGIN=http://{domain}

# Site URL (used for upload URLs and SEO)
NUXT_PUBLIC_SITE_URL=http://{domain}

# Instance
INSTANCE_DOMAIN={domain}
INSTANCE_NAME={name}
INSTANCE_DESCRIPTION={description}

# Feature Flags
FEATURE_CONTENT={content}
FEATURE_SOCIAL={social}
FEATURE_HUBS={hubs}
FEATURE_DOCS={docs}
FEATURE_VIDEO={video}
FEATURE_CONTESTS={contests}
FEATURE_LEARNING={learning}
FEATURE_EXPLAINERS={explainers}
FEATURE_FEDERATION={federation}
FEATURE_ADMIN={admin}

# Search
MEILI_URL=http://localhost:7700
MEILI_MASTER_KEY=commonpub_dev_key

# Email — "console" (dev), "smtp" (nodemailer), or "resend" (Resend API)
EMAIL_ADAPTER=console
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@{domain}
# RESEND_API_KEY=re_...
# RESEND_FROM=noreply@{domain}
"#,
        name = config.name,
        domain = config.domain,
        description = config.description,
        database_url = config.database_url,
        redis_url = config.redis_url,
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
    );

    // OAuth placeholders only if enabled
    if config.auth_github {
        env.push_str(
            "\n# GitHub OAuth\nGITHUB_CLIENT_ID=\nGITHUB_CLIENT_SECRET=\n",
        );
    }
    if config.auth_google {
        env.push_str(
            "\n# Google OAuth\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n",
        );
    }

    // Storage (optional, local by default)
    env.push_str(
        r#"
# Storage — set S3_BUCKET to enable S3/DO Spaces, otherwise local ./uploads
# S3_BUCKET=
# S3_REGION=us-east-1
# S3_ENDPOINT=
# S3_ACCESS_KEY=
# S3_SECRET_KEY=
# S3_PUBLIC_URL=
"#,
    );

    env
}

pub fn render_config(config: &InstanceConfig) -> String {
    let content_types_str = if !config.content_types.is_empty() {
        let types: Vec<String> = config.content_types.iter().map(|t| format!("'{}'", t)).collect();
        format!("\n    contentTypes: [{}],", types.join(", "))
    } else {
        String::new()
    };

    let contest_creation_str = if config.feature_contests && config.contest_creation != "admin" {
        format!("\n    contestCreation: '{}',", config.contest_creation)
    } else {
        // admin is the default, only include if non-default or if contests enabled
        if config.feature_contests {
            format!("\n    contestCreation: '{}',", config.contest_creation)
        } else {
            String::new()
        }
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

pub fn render_nuxt_config(config: &InstanceConfig) -> String {
    let theme_css = if config.theme != "base" {
        format!(
            "\n    '@commonpub/ui/theme/{}.css',",
            config.theme
        )
    } else {
        String::new()
    };

    format!(
        r#"export default defineNuxtConfig({{
  compatibilityDate: '2024-11-01',
  devtools: {{ enabled: true }},
  css: [
    '@commonpub/ui/theme/base.css',
    '@commonpub/ui/theme/dark.css',
    '@commonpub/ui/theme/components.css',
    '@commonpub/ui/theme/prose.css',
    '@commonpub/ui/theme/layouts.css',
    '@commonpub/ui/theme/forms.css',{theme_css}
  ],
  modules: [],
  runtimeConfig: {{
    databaseUrl: '',
    authSecret: 'dev-secret-change-me',
    emailAdapter: 'console',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    resendApiKey: '',
    resendFrom: '',
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3Endpoint: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3PublicUrl: '',
    uploadDir: './uploads',
    public: {{
      siteUrl: 'http://{domain}',
      domain: '{domain}',
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
        domain = config.domain,
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
        content_types = config.content_types.join(","),
        contest_creation = config.contest_creation,
    )
}

pub fn render_package_json(config: &InstanceConfig) -> String {
    let mut deps = vec![
        r#"    "@commonpub/config": "^0.4.0""#.to_string(),
        r#"    "@commonpub/schema": "^0.4.0""#.to_string(),
        r#"    "@commonpub/auth": "^0.4.0""#.to_string(),
        r#"    "@commonpub/ui": "^0.4.0""#.to_string(),
        r#"    "@commonpub/server": "^0.4.0""#.to_string(),
        r#"    "@commonpub/infra": "^0.4.0""#.to_string(),
    ];

    if config.feature_content {
        deps.push(r#"    "@commonpub/editor": "^0.4.0""#.to_string());
    }
    if config.feature_docs {
        deps.push(r#"    "@commonpub/docs": "^0.4.0""#.to_string());
    }
    if config.feature_learning {
        deps.push(r#"    "@commonpub/learning": "^0.4.0""#.to_string());
    }
    if config.feature_explainers {
        deps.push(r#"    "@commonpub/explainer": "^0.4.0""#.to_string());
    }
    if config.feature_federation {
        deps.push(r#"    "@commonpub/protocol": "^0.4.0""#.to_string());
    }

    let deps_str = deps.join(",\n");

    format!(
        r#"{{
  "name": "{name}",
  "private": true,
  "type": "module",
  "scripts": {{
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }},
  "dependencies": {{
{deps},
    "nuxt": "^3.16.0",
    "vue": "^3.4.0",
    "drizzle-orm": "^0.45.0",
    "better-auth": "^1.2.0",
    "pg": "^8.13.0",
    "zod": "^4.3.6"
  }},
  "devDependencies": {{
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.31.0",
    "typescript": "^5.7.0"
  }}
}}
"#,
        name = config.name,
        deps = deps_str,
    )
}

pub fn render_tsconfig() -> String {
    r#"{
  "extends": "./.nuxt/tsconfig.json"
}
"#
    .to_string()
}

pub fn render_app_vue(config: &InstanceConfig) -> String {
    format!(
        r##"<template>
  <a href="#main-content" class="cpub-skip-link">Skip to main content</a>
  <NuxtLoadingIndicator color="#5b9cf6" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
useHead({{
  titleTemplate: (title) => title ? `${{title}} — {name}` : '{name}',
}});
</script>
"##,
        name = config.name,
    )
}

// ── Server utils ──────────────────────────────────────────

pub fn render_server_config() -> String {
    r#"// Singleton CommonPub config for Nitro server
import { defineCommonPubConfig, type CommonPubConfig } from '@commonpub/config';

let cachedConfig: CommonPubConfig | null = null;

export function useConfig(): CommonPubConfig {
  if (cachedConfig) return cachedConfig;

  const runtimeConfig = useRuntimeConfig();

  const { config } = defineCommonPubConfig({
    instance: {
      domain: (runtimeConfig.public.domain as string) || 'localhost:3000',
      name: (runtimeConfig.public.siteName as string) || 'CommonPub',
      description: (runtimeConfig.public.siteDescription as string) || 'A CommonPub instance',
    },
  });

  cachedConfig = config;
  return config;
}
"#
    .to_string()
}

pub fn render_server_db() -> String {
    r#"// Singleton Drizzle DB instance for Nitro server
import { drizzle } from 'drizzle-orm/node-postgres';
// @ts-expect-error no types for pg
import pg from 'pg';
import * as schema from '@commonpub/schema';
import type { DB } from '@commonpub/server';

let db: DB | null = null;

export function useDB(): DB {
  if (db) return db;

  const config = useRuntimeConfig();
  const databaseUrl = config.databaseUrl as string;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured. Set NUXT_DATABASE_URL environment variable.');
  }

  // Guard against default auth secret in production
  if (process.env.NODE_ENV === 'production' && config.authSecret === 'dev-secret-change-me') {
    throw new Error('NUXT_AUTH_SECRET must be set in production. Do not use the default dev secret.');
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  db = drizzle(pool, { schema });

  return db;
}
"#
    .to_string()
}

pub fn render_server_auth() -> String {
    r#"// Auth helper — extracts authenticated user from event context
import type { H3Event } from 'h3';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export function requireAuth(event: H3Event): AuthUser {
  const auth = event.context.auth;
  if (!auth?.user) {
    const cookie = getRequestHeader(event, 'cookie') || '';
    const hasSessionCookie = cookie.includes('better-auth.session_token');
    throw createError({
      statusCode: 401,
      statusMessage: hasSessionCookie
        ? 'Session expired or invalid. Please log in again.'
        : 'Not logged in. Please log in to continue.',
    });
  }
  return auth.user as AuthUser;
}

export function requireAdmin(event: H3Event): AuthUser {
  const user = requireAuth(event);
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }
  return user;
}

export function getOptionalUser(event: H3Event): AuthUser | null {
  const auth = event.context.auth;
  return (auth?.user as AuthUser) ?? null;
}
"#
    .to_string()
}

pub fn render_server_validate() -> String {
    r#"// API route validation helpers
import type { H3Event } from 'h3';
import type { ZodType } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/;

type ParamType = 'uuid' | 'slug' | 'string';

/** Parse and validate request body against a Zod schema. Throws 400 on failure. */
export async function parseBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }
  return parsed.data;
}

/** Parse and validate query string against a Zod schema. Throws 400 on failure. */
export function parseQueryParams<T>(event: H3Event, schema: ZodType<T>): T {
  const query = getQuery(event);
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }
  return parsed.data;
}

/**
 * Extract and validate route parameters.
 *
 * @example
 * const { id } = parseParams(event, { id: 'uuid' });
 * const { slug } = parseParams(event, { slug: 'slug' });
 */
export function parseParams<T extends Record<string, ParamType>>(
  event: H3Event,
  spec: T,
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string };

  for (const [name, type] of Object.entries(spec)) {
    const value = getRouterParam(event, name);
    if (!value) {
      throw createError({ statusCode: 400, statusMessage: `Missing parameter: ${name}` });
    }

    if (type === 'uuid' && !UUID_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }
    if (type === 'slug' && !SLUG_REGEX.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid ${name} format` });
    }

    (result as Record<string, string>)[name] = value;
  }

  return result;
}
"#
    .to_string()
}

pub fn render_server_errors() -> String {
    r#"// Consistent error helpers for Nitro API routes

export function validationError(errors: Record<string, string[]>): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation failed',
    data: { errors },
  });
}

export function notFound(entity: string): never {
  throw createError({
    statusCode: 404,
    statusMessage: `${entity} not found`,
  });
}

export function forbidden(message = 'Permission denied'): never {
  throw createError({ statusCode: 403, statusMessage: message });
}

export function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message });
}
"#
    .to_string()
}

// ── Server middleware ─────────────────────────────────────

pub fn render_middleware_auth() -> String {
    r#"// Nitro middleware — Better Auth integration with configurable email
import { createAuthMiddleware, type AuthLocals } from '@commonpub/auth';
import { createAuth } from '@commonpub/auth';
import { ConsoleEmailAdapter, SmtpEmailAdapter, ResendEmailAdapter, emailTemplates } from '@commonpub/server';
import type { EmailAdapter } from '@commonpub/server';

let authMiddleware: ReturnType<typeof createAuthMiddleware> | null = null;

function createEmailAdapter(): EmailAdapter {
  const runtimeConfig = useRuntimeConfig();
  const adapter = (runtimeConfig.emailAdapter as string) || 'console';

  if (adapter === 'smtp') {
    const host = runtimeConfig.smtpHost as string;
    const port = parseInt(runtimeConfig.smtpPort as string, 10) || 587;
    const user = runtimeConfig.smtpUser as string;
    const pass = runtimeConfig.smtpPass as string;
    const from = runtimeConfig.smtpFrom as string;

    if (!host || !user || !pass || !from) {
      console.warn('[email] SMTP configured but missing credentials — falling back to console');
      return new ConsoleEmailAdapter();
    }

    return new SmtpEmailAdapter({ host, port, user, pass, from });
  }

  if (adapter === 'resend') {
    const apiKey = runtimeConfig.resendApiKey as string;
    const from = runtimeConfig.resendFrom as string;

    if (!apiKey || !from) {
      console.warn('[email] Resend configured but missing API key or from address — falling back to console');
      return new ConsoleEmailAdapter();
    }

    return new ResendEmailAdapter({ apiKey, from });
  }

  return new ConsoleEmailAdapter();
}

function getAuthMiddleware(): ReturnType<typeof createAuthMiddleware> {
  if (authMiddleware) return authMiddleware;

  const config = useConfig();
  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
  const siteName = config.instance.name || 'CommonPub';

  const emailAdapter = createEmailAdapter();

  const auth = createAuth({
    config,
    db: db as unknown as Parameters<typeof createAuth>[0]['db'],
    secret: (() => {
      const s = runtimeConfig.authSecret as string;
      if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('AUTH_SECRET must be set in production');
      }
      return s || 'dev-secret-change-me';
    })(),
    baseURL: siteUrl,
    emailSender: {
      async sendResetPasswordEmail(email: string, url: string, _token: string): Promise<void> {
        const template = emailTemplates.passwordReset(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      },
      async sendVerificationEmail(email: string, url: string, _token: string): Promise<void> {
        const template = emailTemplates.verification(siteName, url);
        await emailAdapter.send({ ...template, to: email });
      },
    },
  });

  authMiddleware = createAuthMiddleware({ auth });
  return authMiddleware;
}

declare module 'h3' {
  interface H3EventContext {
    auth: AuthLocals;
  }
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;

  // Skip auth for non-API routes and static assets
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_nuxt')) {
    // Still resolve session for SSR pages
    try {
      const middleware = getAuthMiddleware();
      const headers = getRequestHeaders(event);
      const webHeaders = new Headers(headers as Record<string, string>);
      event.context.auth = await middleware.resolveSession(webHeaders);
    } catch {
      event.context.auth = { user: null, session: null };
    }
    return;
  }

  let middleware: ReturnType<typeof getAuthMiddleware>;
  try {
    middleware = getAuthMiddleware();
  } catch (err: unknown) {
    // DB not connected — fail with a clear message
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/')) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Database unavailable. Check that PostgreSQL is running.',
      });
    }
    event.context.auth = { user: null, session: null };
    return;
  }

  // Handle auth API routes
  if (pathname.startsWith('/api/auth')) {
    try {
      const response = await middleware.handleAuthRoute(
        toWebRequest(event),
        pathname,
      );
      if (response) {
        return sendWebResponse(event, response);
      }
    } catch (err: unknown) {
      console.error('[auth] Route handler error:', err instanceof Error ? err.message : err);
      throw createError({
        statusCode: 500,
        statusMessage: 'Authentication service error',
      });
    }
  }

  // Resolve session for API requests
  try {
    const headers = getRequestHeaders(event);
    const webHeaders = new Headers(headers as Record<string, string>);
    event.context.auth = await middleware.resolveSession(webHeaders);
  } catch (err: unknown) {
    if (pathname.startsWith('/api/')) {
      console.error('[auth] Session resolution failed:', err instanceof Error ? err.message : err);
    }
    event.context.auth = { user: null, session: null };
  }
});
"#
    .to_string()
}

pub fn render_middleware_security() -> String {
    r#"// Security middleware — rate limiting + security headers + CSP
import { RateLimitStore, checkRateLimit, shouldSkipRateLimit, getSecurityHeaders, buildCspHeader, buildCspDirectives } from '@commonpub/server';

const store = new RateLimitStore();
const isDev = process.env.NODE_ENV !== 'production';

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Skip rate limiting for static assets
  if (shouldSkipRateLimit(pathname)) return;

  // Skip rate limiting in development — SSR + HMR + prefetch burns through limits
  if (!isDev) {
    const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
      || getRequestHeader(event, 'x-real-ip')
      || 'unknown';

    const userId = event.context.auth?.user?.id as string | undefined;
    const { result, headers: rlHeaders } = checkRateLimit(store, ip, pathname, userId);

    for (const [key, value] of Object.entries(rlHeaders)) {
      setResponseHeader(event, key, value);
    }

    if (!result.allowed) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
      });
    }
  }

  // Security headers
  const headers = getSecurityHeaders(isDev);
  for (const [key, value] of Object.entries(headers)) {
    setResponseHeader(event, key, value);
  }

  // Content Security Policy — skip for API responses (JSON doesn't need CSP)
  if (!pathname.startsWith('/api/')) {
    const cspDirectives = buildCspDirectives();
    if (isDev) {
      cspDirectives['script-src'] = "'self' 'unsafe-inline' 'unsafe-eval'";
      cspDirectives['style-src'] = "'self' 'unsafe-inline' https://cdnjs.cloudflare.com";
      cspDirectives['connect-src'] = "'self' ws: wss:";
    }
    setResponseHeader(event, 'Content-Security-Policy', buildCspHeader(cspDirectives));
  }
});
"#
    .to_string()
}

// ── Plugins ───────────────────────────────────────────────

pub fn render_plugin_auth() -> String {
    r#"// Auth plugin — fetches session on app init
import type { ClientAuthUser, ClientAuthSession } from '~/composables/useAuth';

export default defineNuxtPlugin(async () => {
  const user = useState<ClientAuthUser | null>('auth-user', () => null);
  const session = useState<ClientAuthSession | null>('auth-session', () => null);

  if (import.meta.server) {
    const event = useRequestEvent();
    const authCtx = (event?.context as any)?.auth as { user?: ClientAuthUser; session?: ClientAuthSession } | undefined;
    if (authCtx) {
      user.value = (authCtx.user as ClientAuthUser) ?? null;
      session.value = (authCtx.session as ClientAuthSession) ?? null;
    }
    return;
  }

  // On client, fetch session from the auth API
  try {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/get-session', {
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  } catch {
    user.value = null;
    session.value = null;
  }
});
"#
    .to_string()
}

// ── Composables ───────────────────────────────────────────

pub fn render_composable_auth() -> String {
    r#"// Auth composable — reactive auth state + methods

/** Client-side auth user shape, matching what Better Auth returns */
export interface ClientAuthUser {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export function useAuth() {
  const user = useState<ClientAuthUser | null>('auth-user', () => null);
  const session = useState<ClientAuthSession | null>('auth-session', () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function signIn(email: string, password: string): Promise<void> {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signUp(email: string, password: string, username: string): Promise<void> {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, name: username, username },
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signOut(): Promise<void> {
    await $fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    user.value = null;
    session.value = null;
    await navigateTo('/');
  }

  /** Refresh the session from the server. */
  async function refreshSession(): Promise<void> {
    if (import.meta.server) return;
    try {
      const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>(
        '/api/auth/get-session',
        { credentials: 'include' },
      );
      user.value = data?.user ?? null;
      session.value = data?.session ?? null;
    } catch {
      user.value = null;
      session.value = null;
    }
  }

  return {
    user: readonly(user),
    session: readonly(session),
    isAuthenticated,
    isAdmin,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };
}
"#
    .to_string()
}

// ── Pages & layouts ───────────────────────────────────────

pub fn render_default_layout(config: &InstanceConfig) -> String {
    let mut nav_links = vec![("/", "Home")];
    if config.feature_content { nav_links.push(("/explore", "Explore")); }
    if config.feature_hubs { nav_links.push(("/hubs", "Hubs")); }
    if config.feature_contests { nav_links.push(("/contests", "Contests")); }
    if config.feature_docs { nav_links.push(("/docs", "Docs")); }
    if config.feature_learning { nav_links.push(("/learn", "Learn")); }
    if config.feature_admin { nav_links.push(("/admin", "Admin")); }

    let links_html: String = nav_links
        .iter()
        .map(|(path, label)| format!("          <NuxtLink to=\"{}\">{}</NuxtLink>", path, label))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"<template>
  <div class="cpub-layout">
    <header class="cpub-header">
      <nav class="cpub-nav">
        <NuxtLink to="/" class="cpub-nav-brand">{name}</NuxtLink>
        <div class="cpub-nav-links">
{links}
        </div>
      </nav>
    </header>
    <main id="main-content" class="cpub-main">
      <slot />
    </main>
    <footer class="cpub-footer">
      <p>Powered by <a href="https://commonpub.dev">CommonPub</a></p>
    </footer>
  </div>
</template>
"#,
        name = config.name,
        links = links_html,
    )
}

pub fn render_index_page(config: &InstanceConfig) -> String {
    // Build a description of enabled features for the index page
    let mut enabled: Vec<&str> = Vec::new();
    if config.feature_content { enabled.push("content"); }
    if config.feature_hubs { enabled.push("hubs"); }
    if config.feature_contests { enabled.push("contests"); }
    if config.feature_docs { enabled.push("docs"); }
    if config.feature_learning { enabled.push("learning"); }

    let features_text = if enabled.is_empty() {
        config.description.clone()
    } else {
        config.description.clone()
    };

    format!(
        r#"<template>
  <div class="cpub-page-index">
    <h1>{name}</h1>
    <p>{description}</p>
  </div>
</template>

<script setup lang="ts">
useHead({{
  title: 'Home',
}});
</script>
"#,
        name = config.name,
        description = features_text,
    )
}

// ── Feature page stubs ────────────────────────────────────

fn render_page_stub(class: &str, title: &str, description: &str) -> String {
    format!(
        r#"<template>
  <div class="cpub-page-{class}">
    <h1>{title}</h1>
    <p>{description}</p>
  </div>
</template>

<script setup lang="ts">
useHead({{
  title: '{title}',
}});
</script>
"#,
        class = class,
        title = title,
        description = description,
    )
}

pub fn render_explore_page() -> String {
    render_page_stub("explore", "Explore", "Discover projects and posts from the community.")
}

pub fn render_hubs_page() -> String {
    render_page_stub("hubs", "Hubs", "Browse and join community hubs.")
}

pub fn render_contests_page() -> String {
    render_page_stub("contests", "Contests", "View active and upcoming contests.")
}

pub fn render_docs_page() -> String {
    render_page_stub("docs", "Docs", "Browse documentation sites.")
}

pub fn render_learning_page() -> String {
    render_page_stub("learn", "Learn", "Explore learning paths and courses.")
}

pub fn render_admin_page() -> String {
    render_page_stub("admin", "Admin", "Instance administration.")
}

// ── Infra files ───────────────────────────────────────────

pub fn render_drizzle_config(config: &InstanceConfig) -> String {
    format!(
        r#"import {{ defineConfig }} from 'drizzle-kit';

export default defineConfig({{
  schema: './node_modules/@commonpub/schema/dist/*.js',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {{
    url: process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || '{database_url}',
  }},
}});
"#,
        database_url = config.database_url,
    )
}

pub fn render_gitignore() -> String {
    r#"# Dependencies
node_modules/

# Build
.nuxt/
.output/
dist/
.turbo/

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
"#
    .to_string()
}

pub fn render_docker_compose(_config: &InstanceConfig) -> String {
    r#"services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: commonpub
      POSTGRES_PASSWORD: commonpub_dev
      POSTGRES_DB: commonpub
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U commonpub']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

  meilisearch:
    image: getmeili/meilisearch:v1.12
    restart: unless-stopped
    ports:
      - '7700:7700'
    environment:
      MEILI_ENV: development
      MEILI_MASTER_KEY: commonpub_dev_key
    volumes:
      - meili_data:/meili_data

volumes:
  postgres_data:
  redis_data:
  meili_data:
"#
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::prompts::InstanceConfig;

    fn test_config() -> InstanceConfig {
        InstanceConfig::with_defaults("test-instance")
    }

    // ── .env ──────────────────────────────────────────────

    #[test]
    fn env_contains_database_url() {
        let env = render_env(&test_config());
        assert!(env.contains("DATABASE_URL="));
        assert!(env.contains("postgresql://"));
    }

    #[test]
    fn env_contains_all_feature_flags() {
        let env = render_env(&test_config());
        assert!(env.contains("FEATURE_CONTENT=true"));
        assert!(env.contains("FEATURE_SOCIAL=true"));
        assert!(env.contains("FEATURE_HUBS=true"));
        assert!(env.contains("FEATURE_DOCS=true"));
        assert!(env.contains("FEATURE_VIDEO=true"));
        assert!(env.contains("FEATURE_CONTESTS=false"));
        assert!(env.contains("FEATURE_LEARNING=true"));
        assert!(env.contains("FEATURE_EXPLAINERS=true"));
        assert!(env.contains("FEATURE_FEDERATION=false"));
        assert!(env.contains("FEATURE_ADMIN=false"));
    }

    #[test]
    fn env_contains_instance_identity() {
        let config = test_config();
        let env = render_env(&config);
        assert!(env.contains("INSTANCE_NAME=test-instance"));
        assert!(env.contains("INSTANCE_DOMAIN=test-instance.localhost"));
    }

    #[test]
    fn env_contains_email_config() {
        let env = render_env(&test_config());
        assert!(env.contains("EMAIL_ADAPTER=console"));
        assert!(env.contains("SMTP_HOST"));
        assert!(env.contains("SMTP_PORT"));
        assert!(env.contains("SMTP_FROM"));
        assert!(env.contains("RESEND_API_KEY"));
        assert!(env.contains("RESEND_FROM"));
    }

    #[test]
    fn env_includes_github_oauth_when_enabled() {
        let mut config = test_config();
        config.auth_github = true;
        let env = render_env(&config);
        assert!(env.contains("GITHUB_CLIENT_ID="));
    }

    #[test]
    fn env_excludes_github_oauth_when_disabled() {
        let config = test_config();
        let env = render_env(&config);
        assert!(!env.contains("GITHUB_CLIENT_ID"));
    }

    // ── commonpub.config.ts ───────────────────────────────

    #[test]
    fn config_is_valid_typescript_structure() {
        let config = render_config(&test_config());
        assert!(config.contains("import { defineCommonPubConfig }"));
        assert!(config.contains("export default defineCommonPubConfig"));
    }

    #[test]
    fn config_contains_all_feature_flags() {
        let config = render_config(&test_config());
        assert!(config.contains("content: true"));
        assert!(config.contains("social: true"));
        assert!(config.contains("hubs: true"));
        assert!(config.contains("federation: false"));
        assert!(config.contains("contests: false"));
    }

    #[test]
    fn config_contains_auth_settings() {
        let config = render_config(&test_config());
        assert!(config.contains("emailPassword: true"));
        assert!(config.contains("magicLink: false"));
        assert!(config.contains("passkeys: false"));
    }

    #[test]
    fn config_includes_contest_creation_when_contests_enabled() {
        let mut config = test_config();
        config.feature_contests = true;
        config.contest_creation = "staff".to_string();
        let output = render_config(&config);
        assert!(output.contains("contestCreation: 'staff'"));
    }

    #[test]
    fn config_includes_content_types() {
        let config = test_config();
        let output = render_config(&config);
        assert!(output.contains("contentTypes: ['project', 'article', 'blog', 'explainer']"));
    }

    #[test]
    fn config_omits_content_types_when_empty() {
        let mut config = test_config();
        config.content_types = vec![];
        let output = render_config(&config);
        assert!(!output.contains("contentTypes"));
    }

    #[test]
    fn config_uses_selected_theme() {
        let mut config = test_config();
        config.theme = "deepwood".to_string();
        let output = render_config(&config);
        assert!(!output.contains("theme:")); // theme is in nuxt.config now
        assert!(output.contains("name: 'test-instance'"));
    }

    // ── nuxt.config.ts ───────────────────────────────────

    #[test]
    fn nuxt_config_has_css_and_runtime() {
        let config = render_nuxt_config(&test_config());
        assert!(config.contains("@commonpub/ui/theme/base.css"));
        assert!(config.contains("nitro:"));
        assert!(config.contains("runtimeConfig:"));
        assert!(config.contains("test-instance.localhost"));
    }

    #[test]
    fn nuxt_config_has_email_runtime_config() {
        let config = render_nuxt_config(&test_config());
        assert!(config.contains("emailAdapter:"));
        assert!(config.contains("smtpHost:"));
        assert!(config.contains("resendApiKey:"));
        assert!(config.contains("resendFrom:"));
    }

    #[test]
    fn nuxt_config_has_vite_fs_allow() {
        let config = render_nuxt_config(&test_config());
        assert!(config.contains("fs:"));
        assert!(config.contains("allow:"));
    }

    #[test]
    fn nuxt_config_includes_theme_css_when_non_base() {
        let mut config = test_config();
        config.theme = "deepwood".to_string();
        let output = render_nuxt_config(&config);
        assert!(output.contains("deepwood.css"));
    }

    // ── package.json ──────────────────────────────────────

    #[test]
    fn package_json_is_nuxt() {
        let json = render_package_json(&test_config());
        assert!(json.contains("\"name\": \"test-instance\""));
        assert!(json.contains("nuxt dev"));
        assert!(json.contains("nuxt build"));
        assert!(json.contains("\"nuxt\":"));
        assert!(json.contains("\"vue\":"));
    }

    #[test]
    fn package_json_has_core_commonpub_deps() {
        let json = render_package_json(&test_config());
        assert!(json.contains("@commonpub/config"));
        assert!(json.contains("@commonpub/schema"));
        assert!(json.contains("@commonpub/auth"));
        assert!(json.contains("@commonpub/ui"));
        assert!(json.contains("@commonpub/server"));
        assert!(json.contains("@commonpub/infra"));
    }

    #[test]
    fn package_json_has_pg_and_zod() {
        let json = render_package_json(&test_config());
        assert!(json.contains("\"pg\":"));
        assert!(json.contains("\"zod\":"));
    }

    #[test]
    fn package_json_includes_editor_when_content_enabled() {
        let config = test_config(); // content enabled by default
        let json = render_package_json(&config);
        assert!(json.contains("@commonpub/editor"));
    }

    #[test]
    fn package_json_excludes_editor_when_content_disabled() {
        let mut config = test_config();
        config.feature_content = false;
        let json = render_package_json(&config);
        assert!(!json.contains("@commonpub/editor"));
    }

    #[test]
    fn package_json_includes_optional_deps_when_enabled() {
        let config = test_config(); // docs + learning + explainers enabled
        let json = render_package_json(&config);
        assert!(json.contains("@commonpub/docs"));
        assert!(json.contains("@commonpub/learning"));
        assert!(json.contains("@commonpub/explainer"));
        assert!(!json.contains("@commonpub/protocol")); // federation off
    }

    #[test]
    fn package_json_includes_protocol_when_federation_enabled() {
        let mut config = test_config();
        config.feature_federation = true;
        let json = render_package_json(&config);
        assert!(json.contains("@commonpub/protocol"));
    }

    #[test]
    fn package_json_excludes_optional_deps_when_disabled() {
        let mut config = test_config();
        config.feature_docs = false;
        config.feature_learning = false;
        config.feature_explainers = false;
        let json = render_package_json(&config);
        assert!(!json.contains("@commonpub/docs"));
        assert!(!json.contains("@commonpub/learning"));
        assert!(!json.contains("@commonpub/explainer"));
    }

    // ── app.vue ───────────────────────────────────────────

    #[test]
    fn app_vue_has_skip_link_and_layout() {
        let vue = render_app_vue(&test_config());
        assert!(vue.contains("cpub-skip-link"));
        assert!(vue.contains("NuxtLayout"));
        assert!(vue.contains("NuxtPage"));
        assert!(vue.contains("test-instance"));
    }

    // ── Server utils ──────────────────────────────────────

    #[test]
    fn server_config_uses_define_commonpub_config() {
        let sc = render_server_config();
        assert!(sc.contains("defineCommonPubConfig"));
        assert!(sc.contains("useConfig"));
        assert!(sc.contains("cachedConfig"));
    }

    #[test]
    fn server_db_has_pool_and_singleton() {
        let db = render_server_db();
        assert!(db.contains("useDB"));
        assert!(db.contains("pg.Pool"));
        assert!(db.contains("drizzle(pool"));
        assert!(db.contains("@commonpub/schema"));
        assert!(db.contains("production"));
    }

    #[test]
    fn server_auth_has_require_and_optional() {
        let auth = render_server_auth();
        assert!(auth.contains("requireAuth"));
        assert!(auth.contains("requireAdmin"));
        assert!(auth.contains("getOptionalUser"));
        assert!(auth.contains("AuthUser"));
    }

    #[test]
    fn server_validate_has_parse_helpers() {
        let validate = render_server_validate();
        assert!(validate.contains("parseBody"));
        assert!(validate.contains("parseQueryParams"));
        assert!(validate.contains("parseParams"));
        assert!(validate.contains("ZodType"));
    }

    #[test]
    fn server_errors_has_helpers() {
        let errors = render_server_errors();
        assert!(errors.contains("validationError"));
        assert!(errors.contains("notFound"));
        assert!(errors.contains("forbidden"));
        assert!(errors.contains("badRequest"));
    }

    // ── Middleware ─────────────────────────────────────────

    #[test]
    fn middleware_auth_has_email_adapter_switch() {
        let auth = render_middleware_auth();
        assert!(auth.contains("createEmailAdapter"));
        assert!(auth.contains("SmtpEmailAdapter"));
        assert!(auth.contains("ResendEmailAdapter"));
        assert!(auth.contains("ConsoleEmailAdapter"));
        assert!(auth.contains("emailAdapter"));
        assert!(auth.contains("emailTemplates"));
        assert!(auth.contains("createAuth"));
    }

    #[test]
    fn middleware_auth_handles_session_resolution() {
        let auth = render_middleware_auth();
        assert!(auth.contains("resolveSession"));
        assert!(auth.contains("handleAuthRoute"));
        assert!(auth.contains("/api/auth"));
    }

    #[test]
    fn middleware_security_has_rate_limiting_and_csp() {
        let sec = render_middleware_security();
        assert!(sec.contains("RateLimitStore"));
        assert!(sec.contains("checkRateLimit"));
        assert!(sec.contains("getSecurityHeaders"));
        assert!(sec.contains("Content-Security-Policy"));
    }

    // ── Plugin ────────────────────────────────────────────

    #[test]
    fn plugin_auth_bridges_ssr_to_client() {
        let plugin = render_plugin_auth();
        assert!(plugin.contains("defineNuxtPlugin"));
        assert!(plugin.contains("import.meta.server"));
        assert!(plugin.contains("auth-user"));
        assert!(plugin.contains("/api/auth/get-session"));
    }

    // ── Composable ────────────────────────────────────────

    #[test]
    fn composable_auth_has_full_api() {
        let auth = render_composable_auth();
        assert!(auth.contains("useAuth"));
        assert!(auth.contains("signIn"));
        assert!(auth.contains("signUp"));
        assert!(auth.contains("signOut"));
        assert!(auth.contains("refreshSession"));
        assert!(auth.contains("isAuthenticated"));
        assert!(auth.contains("isAdmin"));
        assert!(auth.contains("ClientAuthUser"));
    }

    // ── Docker ────────────────────────────────────────────

    #[test]
    fn docker_compose_has_all_services() {
        let compose = render_docker_compose(&test_config());
        assert!(compose.contains("postgres:"));
        assert!(compose.contains("redis:"));
        assert!(compose.contains("meilisearch:"));
    }

    #[test]
    fn docker_compose_has_health_checks() {
        let compose = render_docker_compose(&test_config());
        assert!(compose.contains("healthcheck:"));
        assert!(compose.contains("pg_isready"));
        assert!(compose.contains("redis-cli"));
    }

    // ── Defaults ──────────────────────────────────────────

    #[test]
    fn default_config_values_correct() {
        let config = InstanceConfig::with_defaults("my-app");
        assert_eq!(config.name, "my-app");
        assert_eq!(config.domain, "my-app.localhost");
        assert_eq!(config.theme, "base");
        assert!(config.feature_content);
        assert!(config.feature_social);
        assert!(config.feature_hubs);
        assert!(config.feature_docs);
        assert!(config.feature_video);
        assert!(!config.feature_contests);
        assert!(config.feature_learning);
        assert!(config.feature_explainers);
        assert!(!config.feature_federation);
        assert!(!config.feature_admin);
        assert!(config.auth_email_password);
        assert!(!config.auth_magic_link);
        assert!(!config.auth_passkeys);
        assert!(!config.auth_github);
        assert!(!config.auth_google);
        assert!(config.use_docker);
        assert_eq!(config.contest_creation, "admin");
        assert_eq!(config.content_types.len(), 4);
    }

    #[test]
    fn gitignore_has_nuxt_entries() {
        let gi = render_gitignore();
        assert!(gi.contains(".nuxt/"));
        assert!(gi.contains(".output/"));
        assert!(gi.contains("node_modules/"));
        assert!(gi.contains(".env"));
        assert!(gi.contains(".turbo/"));
    }

    #[test]
    fn default_layout_has_accessibility() {
        let layout = render_default_layout(&test_config());
        assert!(layout.contains("cpub-layout"));
        assert!(layout.contains("main-content"));
        assert!(layout.contains("commonpub.dev"));
    }

    #[test]
    fn default_layout_nav_reflects_features() {
        // Default config has: content, social, hubs, docs, video, learning, explainers ON
        let layout = render_default_layout(&test_config());
        assert!(layout.contains("Explore")); // content
        assert!(layout.contains("Hubs"));
        assert!(layout.contains("Docs"));
        assert!(layout.contains("Learn"));
        assert!(!layout.contains("Contests")); // contests off by default
        assert!(!layout.contains("Admin")); // admin off by default
    }

    #[test]
    fn minimal_layout_nav_only_has_home() {
        let mut config = test_config();
        config.feature_content = false;
        config.feature_social = false;
        config.feature_hubs = false;
        config.feature_docs = false;
        config.feature_video = false;
        config.feature_learning = false;
        config.feature_explainers = false;
        let layout = render_default_layout(&config);
        assert!(layout.contains("Home"));
        assert!(!layout.contains("Explore"));
        assert!(!layout.contains("Hubs"));
        assert!(!layout.contains("Docs"));
    }

    #[test]
    fn contests_layout_nav_shows_contests() {
        let mut config = test_config();
        config.feature_contests = true;
        config.feature_admin = true;
        let layout = render_default_layout(&config);
        assert!(layout.contains("Contests"));
        assert!(layout.contains("Admin"));
    }

    #[test]
    fn page_stubs_have_correct_structure() {
        let hubs = render_hubs_page();
        assert!(hubs.contains("cpub-page-hubs"));
        assert!(hubs.contains("useHead"));
        assert!(hubs.contains("Hubs"));

        let contests = render_contests_page();
        assert!(contests.contains("cpub-page-contests"));
        assert!(contests.contains("Contests"));

        let admin = render_admin_page();
        assert!(admin.contains("cpub-page-admin"));
    }

    #[test]
    fn index_page_has_instance_info() {
        let page = render_index_page(&test_config());
        assert!(page.contains("test-instance"));
        assert!(page.contains("useHead"));
    }
}
