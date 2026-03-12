# ADR 021: Theming & Admin Architecture

**Status**: Accepted
**Date**: 2026-03-10

## Context

Phases 0–9 are complete (834 tests). The codebase has 4 CSS theme files with `var(--*)` tokens, a `users.theme` column (unused), role-based auth guards, and a `reports` table. What's missing: runtime theme switching, admin panel, audit logging, and instance-level settings.

## Decisions

### 1. Theme Switching: `data-theme` Attribute

Each theme CSS scopes to `[data-theme="themeName"]`. Base theme stays on `:root` as fallback.

```css
/* base.css — stays as :root (default) */
:root {
  --color-primary: #3b82f6;
}

/* deepwood.css */
[data-theme='deepwood'] {
  --color-primary: #b8f542;
}
```

**Why**: Natural CSS cascade, zero JS runtime, matches how DaisyUI/Skeleton do it.

### 2. Theme Resolution Cascade

```
user preference → instance default → 'base'
```

- User preference: `users.theme` column (varchar 64, already exists)
- Instance default: `instanceSettings` row with key `theme.default`
- Base: hardcoded fallback, always available

### 3. SSR Flash Prevention

Cookie-based. Server reads `commonpub-theme` cookie in hooks, resolves theme, passes to layout. Layout sets `data-theme` on `<html>` via `$effect`. For authenticated users, theme comes from `users.theme`; cookie is secondary for anonymous visitors.

### 4. Instance Settings: Key-Value Table

```sql
CREATE TABLE instance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(128) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Why key-value over structured**: No migration needed for new settings. JSONB `value` handles any type.

### 5. Admin Panel: Route Group

Admin lives in `apps/reference/src/routes/(app)/admin/` — no new package. Gated by:

- `FEATURE_ADMIN` feature flag (default `false`)
- `roleGuard('staff')` in layout server load

Sections: Dashboard, Users, Reports, Settings, Theme, Audit Log.

### 6. Audit Logging: Append-Only Table

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(255),
  metadata JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Every admin mutation creates an audit entry. Actions use `verb.noun` format: `user.role_changed`, `report.resolved`, `setting.updated`, `content.removed`.

### 7. Reports: Reuse Existing Table

The `reports` table (social.ts) already has `status`, `reviewedById`, `reviewedAt`, `resolution` columns. Admin UI adds review/resolve/dismiss workflow — no schema changes needed.

## Consequences

- Theme switching works without page reload via CSS cascade
- Cookie prevents FOUC for anonymous visitors
- Admin panel is entirely optional (feature-flagged)
- Audit log provides accountability for all admin actions
- Instance settings are extensible without migrations
- Reports workflow reuses existing schema (zero new tables for moderation)
