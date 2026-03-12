# Theming & Admin — Research

## Prior Art: CSS Custom Property Runtime Switching

### `data-theme` Attribute Pattern

The dominant pattern for runtime CSS theme switching:

- Set `data-theme` attribute on `<html>` element
- Each theme scopes its tokens under `[data-theme="name"]` selector
- Base/default theme stays on `:root` as fallback
- Used by: DaisyUI, Skeleton UI, Radix Themes, Mantine

### SSR Flash Prevention

- **Cookie-based**: Store theme preference in a cookie, read in server hooks, set attribute before HTML streams
- **Inline script**: Inject a `<script>` in `<head>` that reads cookie/localStorage and sets `data-theme` synchronously (before paint)
- SvelteKit: Best approach is server hook setting `data-theme` on the `<html>` tag via `resolve({ transformPageChunk })` or passing theme to layout

### Token Override Pattern

- CSS custom properties cascade naturally — inline styles on `<html>` override `[data-theme]` values
- Pattern: `document.documentElement.style.setProperty('--color-primary', '#custom')`
- Per-instance overrides stored in DB, applied as inline properties after theme stylesheet

### Theme Resolution Cascade

Standard pattern: `user preference → instance default → 'base'`

- User preference: stored in user profile (DB column)
- Instance default: stored in instance settings
- Base: hardcoded fallback (always available)

## Prior Art: SvelteKit Admin Panels

### Route Group Pattern

- Admin routes in `(app)/admin/` route group
- Layout-level auth guard (check once, all children protected)
- Feature flag check in layout `+layout.server.ts`

### Common Admin Sections

1. **Dashboard** — Stats overview (user counts, content counts, report counts)
2. **User Management** — Table with search, role/status editing
3. **Content Moderation** — Report queue, review/resolve/dismiss
4. **Settings** — Instance configuration (name, description, defaults)
5. **Audit Log** — Append-only history of admin actions

### Auth Guard Pattern

```typescript
// +layout.server.ts
export const load = async (event) => {
  if (!event.locals.config.features.admin) {
    error(404, 'Not found');
  }
  const guard = roleGuard('staff')(event);
  if (!guard.authorized) {
    error(403, 'Forbidden');
  }
};
```

## Prior Art: Audit Logging

### Best Practices

- **Append-only table** — never update or delete audit records
- **Columns**: who (userId), what (action), target (type + id), metadata (JSON), when (timestamp), where (IP)
- **Action naming**: `verb.noun` format (e.g., `user.role_changed`, `report.resolved`, `setting.updated`)
- **No sensitive data** — log the action, not the full payload (no passwords, tokens, PII beyond user ID)

### Retention

- v1: No auto-cleanup, pagination sufficient
- Future: Configurable retention policy (e.g., 90 days)

### Query Patterns

- Filter by action type, user, target, date range
- Paginated reverse chronological (newest first)

## Prior Art: Instance Settings

### Key-Value vs Structured

- **Key-value (chosen)**: Flexible, new settings don't require migrations, simple upsert
- **Structured**: Type-safe columns but requires migration for each new setting
- Most self-hosted platforms (Mastodon, Discourse, Ghost) use key-value

### Common Instance Settings

- `instance.name` — Human-readable name
- `instance.description` — Short description
- `instance.default_theme` — Default theme for new/anonymous users
- `instance.registration_open` — Whether new signups are allowed
- `instance.custom_css` — Custom CSS overrides (deferred)

### Storage Pattern

```
instanceSettings: { key: string, value: jsonb }
```

- JSONB `value` allows any type (string, number, boolean, object)
- Keys namespaced with dots for organization

## Decisions for CommonPub

1. **`data-theme` on `<html>`** — matches existing CSS architecture, zero framework overhead
2. **Cookie-based theme** — server reads cookie in hooks, sets `data-theme` in SSR, prevents flash
3. **Key-value `instanceSettings`** — flexible, no migrations for new settings
4. **Append-only `auditLogs`** — standard columns, `verb.noun` action naming
5. **Route group admin** — `(app)/admin/` with layout-level feature flag + role guard
6. **Reuse `reports` table** — admin UI adds review/resolve workflow on existing schema
