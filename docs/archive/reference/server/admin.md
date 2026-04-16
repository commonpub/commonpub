# Admin

> Server-side administration functions for platform stats, user management, reports, settings, and content moderation.

**Source**: `packages/server/src/admin.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `PlatformStats` | Type | Aggregated platform statistics |
| `UserListItem` | Type | User record for admin listing |
| `UserFilters` | Type | Filters for user queries |
| `ReportListItem` | Type | Report record with reporter/reviewer joins |
| `ReportFilters` | Type | Filters for report queries |
| `getPlatformStats` | Function | Parallel queries for all platform counters |
| `listUsers` | Function | Paginated, filterable user listing |
| `updateUserRole` | Function | Change user role with audit trail |
| `updateUserStatus` | Function | Change user status with audit trail |
| `listReports` | Function | Paginated, filterable report listing |
| `resolveReport` | Function | Resolve or dismiss a report |
| `getInstanceSettings` | Function | All instance settings as a Map |
| `getInstanceSetting` | Function | Single instance setting by key |
| `setInstanceSetting` | Function | Upsert an instance setting |
| `deleteUser` | Function | Full user deletion with counter decrements |
| `removeContent` | Function | Archive content by ID |

---

## Types

### `PlatformStats`

```ts
{
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  content: { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
  hubs: { total: number };
  reports: { pending: number; total: number };
}
```

### `UserListItem`

User record returned by `listUsers`. Contains user identity fields suitable for admin display.

### `UserFilters`

```ts
{
  search?: string;   // matched against username and email via ILIKE
  role?: string;
  status?: string;
  limit?: number;    // max 100
  offset?: number;
}
```

### `ReportListItem`

Report record with joined reporter and reviewer user data.

### `ReportFilters`

```ts
{
  status?: string;
  limit?: number;
  offset?: number;
}
```

---

## API Reference

### `getPlatformStats(db): Promise<PlatformStats>`

Runs parallel queries to collect platform-wide statistics.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |

**Returns**: `PlatformStats` with aggregated counts for users (by role, by status), content (by type, by status), hubs, and reports (pending vs total).

**Notes**: All queries execute in parallel for performance.

---

### `listUsers(db, filters?): Promise<{items: UserListItem[], total: number}>`

Returns a paginated list of users with optional search and filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `filters` | `UserFilters` | Optional. Search, role, status, pagination |

**Returns**: `{items, total}` where `items` is the page of users and `total` is the unfiltered count.

**Notes**: Search uses `ILIKE` against both username and email. Limit is capped at 100.

---

### `updateUserRole(db, userId, newRole, adminId, ip?): Promise<void>`

Changes a user's role and creates an audit log entry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `userId` | `string` | Target user ID |
| `newRole` | `string` | New role to assign |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

**Notes**: Audit log metadata includes both the previous and new role values.

---

### `updateUserStatus(db, userId, newStatus, adminId, ip?): Promise<void>`

Changes a user's status and creates an audit log entry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `userId` | `string` | Target user ID |
| `newStatus` | `string` | New status to assign |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

---

### `listReports(db, filters?): Promise<{items: ReportListItem[], total: number}>`

Returns a paginated list of reports with joined reporter and reviewer data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `filters` | `ReportFilters` | Optional. Status filter, pagination |

**Returns**: `{items, total}` with reporter and reviewer user info joined.

---

### `resolveReport(db, reportId, resolution, status, adminId, ip?): Promise<void>`

Resolves or dismisses a report.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `reportId` | `string` | Report to resolve |
| `resolution` | `string` | Resolution text |
| `status` | `string` | `'resolved'` or `'dismissed'` |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

**Notes**: Sets the reviewer to `adminId`, records resolution text, and creates an audit log entry.

---

### `getInstanceSettings(db): Promise<Map<string, unknown>>`

Returns all instance settings as a key-value Map.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |

---

### `getInstanceSetting(db, key): Promise<unknown | null>`

Returns a single instance setting by key.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `key` | `string` | Setting key |

**Returns**: The setting value, or `null` if not found.

---

### `setInstanceSetting(db, key, value, adminId, ip?): Promise<void>`

Upserts an instance setting and creates an audit log entry.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `key` | `string` | Setting key |
| `value` | `unknown` | Setting value |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

---

### `deleteUser(db, userId, adminId, ip?): Promise<void>`

Permanently deletes a user and cleans up all related counters in a transaction.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `userId` | `string` | User to delete |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

**Notes**: Runs inside a transaction. Before deleting:
- Decrements like counts on all content the user liked
- Decrements comment counts on all content the user commented on
- Decrements member counts on all hubs the user belonged to
- Decrements enrollment counts on all learning paths the user was enrolled in

The `DELETE` on users cascades to related rows. An audit log entry is created.

---

### `removeContent(db, contentId, adminId, ip?): Promise<void>`

Soft-deletes content by setting its status to `'archived'`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `contentId` | `string` | Content item to archive |
| `adminId` | `string` | Admin performing the action |
| `ip` | `string` | Optional. Request IP address |

**Notes**: Does not permanently delete the content. Creates an audit log entry.
