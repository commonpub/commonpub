# Audit

> Audit log creation and querying for admin activity tracking.

**Source**: `packages/server/src/audit.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `AuditEntry` | Type | Input shape for creating an audit log entry |
| `AuditLogItem` | Type | Output shape with joined user data |
| `AuditFilters` | Type | Query filters for listing audit logs |
| `createAuditEntry` | Function | Inserts a new audit log entry |
| `listAuditLogs` | Function | Paginated, filterable audit log listing |

---

## Types

### `AuditEntry`

```ts
{
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}
```

### `AuditLogItem`

```ts
{
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
}
```

### `AuditFilters`

```ts
{
  action?: string;
  userId?: string;
  targetType?: string;
  limit?: number;   // max 100
  offset?: number;
}
```

---

## API Reference

### `createAuditEntry(db, entry: AuditEntry): Promise<void>`

Inserts a new entry into the `auditLogs` table.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `entry` | `AuditEntry` | Audit log data to insert |

**Notes**: Called by admin functions (`updateUserRole`, `deleteUser`, `resolveReport`, etc.) to record administrative actions.

---

### `listAuditLogs(db, filters?): Promise<{items: AuditLogItem[], total: number}>`

Returns a paginated list of audit log entries with the acting user's info joined.

| Parameter | Type | Description |
|-----------|------|-------------|
| `db` | `DrizzleClient` | Database connection |
| `filters` | `AuditFilters` | Optional. Filter by action, userId, targetType; paginate with limit/offset |

**Returns**: `{items, total}` where `items` contains `AuditLogItem` records ordered by `createdAt` descending, and `total` is the count matching the filters.

**Notes**: Limit is capped at 100. Results join the `users` table to include the acting user's `id`, `username`, and `displayName`.

---

## Known Audit Actions

| Action | Triggered by |
|--------|-------------|
| `user.role_changed` | `updateUserRole` |
| `user.status_changed` | `updateUserStatus` |
| `user.deleted` | `deleteUser` |
| `content.removed` | `removeContent` |
| `report.resolved` | `resolveReport` (resolved) |
| `report.dismissed` | `resolveReport` (dismissed) |
| `setting.updated` | `setInstanceSetting` |
