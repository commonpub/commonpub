# Security

> CSP directive builder, security headers, and Nitro server middleware with per-request nonce support.

**Source**: `packages/server/src/security.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `buildCspDirectives` | Function | Builds a CSP directives object |
| `buildCspHeader` | Function | Serializes CSP directives into a header string |
| `getSecurityHeaders` | Function | Returns standard security headers |
| `getStaticCacheHeaders` | Function | Returns cache headers for immutable assets |
| `createSecurityHook` | Function | Nitro server middleware factory |

---

## API Reference

### `buildCspDirectives(nonce?: string): Record<string, string>`

Builds Content Security Policy directives.

| Parameter | Type | Description |
|-----------|------|-------------|
| `nonce` | `string` | Optional. Per-request nonce for script/style sources |

**Returns**: A `Record<string, string>` mapping directive names to values.

**Directives produced**:

| Directive | With nonce | Without nonce |
|-----------|-----------|---------------|
| `default-src` | `'self'` | `'self'` |
| `script-src` | `'self' 'nonce-{nonce}'` | `'self'` |
| `style-src` | `'self' 'nonce-{nonce}'` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' data: https:` | `'self' data: https:` |
| `font-src` | `'self'` | `'self'` |
| `connect-src` | `'self'` | `'self'` |
| `frame-ancestors` | `'none'` | `'none'` |
| `base-uri` | `'self'` | `'self'` |
| `form-action` | `'self'` | `'self'` |

---

### `buildCspHeader(directives?: Record<string, string>): string`

Serializes a CSP directives object into a header-ready string.

| Parameter | Type | Description |
|-----------|------|-------------|
| `directives` | `Record<string, string>` | Optional. Output from `buildCspDirectives`. Uses defaults if omitted |

**Returns**: A semicolon-delimited CSP header string (e.g., `default-src 'self'; script-src 'self' 'nonce-abc123'`).

---

### `getSecurityHeaders(isDev: boolean): Record<string, string>`

Returns standard security headers, with HSTS only in production.

| Parameter | Type | Description |
|-----------|------|-------------|
| `isDev` | `boolean` | Whether the app is running in development mode |

**Headers (always)**:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

**Headers (production only)**:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

---

### `getStaticCacheHeaders(): Record<string, string>`

Returns cache headers for immutable static assets.

**Returns**:

| Header | Value |
|--------|-------|
| `Cache-Control` | `public, max-age=31536000, immutable` |

---

### `createSecurityHook(isDev: boolean): EventHandler`

Creates Nitro server middleware that applies security headers and nonce-based CSP.

| Parameter | Type | Description |
|-----------|------|-------------|
| `isDev` | `boolean` | Whether the app is running in development mode |

**Returns**: A Nitro `EventHandler` function.

**Behavior**:

1. **Nonce generation**: In production, generates a unique per-request nonce. In development, no nonce is generated.
2. **HTML transformation**: Uses Nitro response hooks to inject the generated nonce into rendered HTML.
3. **Security headers**: Applies all headers from `getSecurityHeaders(isDev)` to every response.
4. **CSP header**: In production, builds and attaches a nonce-based CSP header via `buildCspDirectives(nonce)` and `buildCspHeader()`.
5. **Static asset caching**: Responses for `/_nuxt/` paths receive `getStaticCacheHeaders()`.
