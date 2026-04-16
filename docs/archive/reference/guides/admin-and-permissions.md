# Admin & Permissions Guide

> How to manage users, grant roles, and configure permissions in CommonPub.

---

## User Roles

CommonPub has 5 user roles in ascending order of privilege:

| Role | Level | Description |
|------|-------|-------------|
| `member` | 1 | Default role for new users. Can create content, comment, like, follow. |
| `pro` | 2 | Verified maker. Same as member with a badge. |
| `verified` | 3 | Identity-verified user. Same as pro with verification indicator. |
| `staff` | 4 | Instance staff. Can moderate content, manage reports, create contests (if configured). |
| `admin` | 5 | Full instance administrator. Can manage users, settings, roles, and all features. |

---

## Making Someone an Admin

### Via Database (First Admin)

When setting up a new instance, the first admin must be set via the database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'your-username';
```

Or using Drizzle:

```ts
import { eq } from 'drizzle-orm';
import { users } from '@commonpub/schema';

await db.update(users).set({ role: 'admin' }).where(eq(users.username, 'your-username'));
```

### Via Admin Panel (Subsequent Admins)

Once you have an admin account:

1. Go to **Admin** > **Users**
2. Find the user you want to promote
3. Click **Change Role** and select the new role
4. Confirm the change

**Rules:**
- You can only assign roles lower than your own
- Only `admin` can promote someone to `staff`
- Only the instance operator (via database) can create additional `admin` accounts

### Via Seed Script

For development, the reference app includes a seed script:

```bash
pnpm seed
```

This creates a default admin user. See `apps/reference/scripts/seed.ts` for the configuration.

---

## Permission Model

### Instance-Level Permissions

Instance permissions are controlled by **user role** and **config options**:

| Action | Default Requirement | Configurable? |
|--------|-------------------|---------------|
| Create content | Any authenticated user | No |
| Create hub | Any authenticated user | No |
| Create contest | Admin only | Yes — `instance.contestCreation` |
| Manage reports | Staff+ | No |
| Manage users | Admin only | No |
| View admin panel | Admin only | No |
| Manage instance settings | Admin only | No |

### Contest Creation Permission

Contest creation is configurable via `commonpub.config.ts`:

```ts
import { defineCommonPubConfig } from '@commonpub/config';

export default defineCommonPubConfig({
  instance: {
    domain: 'mysite.com',
    name: 'My Community',
    description: 'A maker community',
    // Who can create contests:
    contestCreation: 'open',    // any authenticated user
    // contestCreation: 'staff', // staff and admin only
    // contestCreation: 'admin', // admin only (default)
  },
  features: {
    contests: true,
  },
});
```

| Value | Who Can Create Contests |
|-------|------------------------|
| `'open'` | Any authenticated user |
| `'staff'` | Users with `staff` or `admin` role |
| `'admin'` | Users with `admin` role only (default) |

### Hub-Level Permissions

Within a hub (community), permissions are based on hub membership role:

| Action | Required Hub Role |
|--------|------------------|
| Edit hub settings | Admin (hub) |
| Manage members | Admin (hub) |
| Ban users | Moderator+ |
| Kick members | Moderator+ |
| Delete posts | Moderator+ |
| Pin posts | Moderator+ |
| Lock posts | Moderator+ |

**Hub roles** (separate from instance roles):
- `owner` — Hub creator, full control
- `admin` — Can edit settings, manage members
- `moderator` — Can moderate content and members
- `member` — Can post and comment

---

## Admin Panel Features

Access the admin panel at `/admin` (requires `admin` role).

### User Management (`/admin/users`)
- View all users with role, status, join date
- Change user roles (member → staff → admin)
- Suspend or delete accounts
- View user activity

### Reports (`/admin/reports`)
- View content and user reports
- Resolve, dismiss, or escalate reports
- Take action (remove content, warn user, suspend)

### Audit Log (`/admin/audit`)
- View all administrative actions
- Filter by action type, actor, date range
- Track role changes, bans, content removals

### Instance Settings (`/admin/settings`)
- Update instance name, description, contact email
- Configure feature flags
- Manage federation settings

---

## Programmatic Permission Checks

Use the server package's permission helpers:

```ts
import { canCreateContest } from '@commonpub/server/contest';
import { hasPermission, canManageRole } from '@commonpub/server';

// Check if a user can create contests
const allowed = canCreateContest(user.role, config.instance.contestCreation);

// Check hub-level permissions
const canDelete = hasPermission(hubMemberRole, 'deletePost');

// Check if one role can manage another
const canPromote = canManageRole(actorRole, targetRole);
```

### Auth Guards (Reference App)

The reference app provides middleware guards:

```ts
// In a server route:
const user = requireAuth(event);       // Throws 401 if not authenticated
requireRole(event, 'staff');           // Throws 403 if not staff+
requireRole(event, 'admin');           // Throws 403 if not admin
```

---

## Environment-Based Configuration

For deployment, override config via environment variables:

```bash
# .env
FEATURE_CONTESTS=true
CONTEST_CREATION=open   # or 'staff' or 'admin'
```

Then in your config:

```ts
defineCommonPubConfig({
  instance: {
    // ...
    contestCreation: (process.env.CONTEST_CREATION as 'open' | 'staff' | 'admin') ?? 'admin',
  },
  features: {
    contests: process.env.FEATURE_CONTESTS === 'true',
  },
});
```

---

## Security Considerations

1. **First admin via database only** — No web-based admin bootstrap to prevent unauthorized escalation
2. **Role hierarchy enforced** — Users can only modify roles below their own level
3. **Audit logging** — All admin actions are logged with actor, action, timestamp
4. **Feature flags** — Disable entire feature surfaces when not needed
5. **Contest creation gating** — Default `admin` prevents spam contests on open registration instances
