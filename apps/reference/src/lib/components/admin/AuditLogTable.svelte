<script lang="ts">
  interface AuditLogItem {
    id: string;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    createdAt: Date;
    user: { id: string; username: string; displayName: string | null };
  }

  interface Props {
    logs: AuditLogItem[];
    class?: string;
  }

  let { logs, class: className = '' }: Props = $props();

  function formatTimestamp(date: Date): string {
    return new Date(date).toLocaleString();
  }
</script>

<div
  class={['admin-audit-table-wrapper', className].filter(Boolean).join(' ')}
  role="region"
  aria-label="Audit log table"
>
  <table class="admin-audit-table">
    <thead>
      <tr>
        <th scope="col">Time</th>
        <th scope="col">User</th>
        <th scope="col">Action</th>
        <th scope="col">Target</th>
        <th scope="col">IP</th>
      </tr>
    </thead>
    <tbody>
      {#each logs as log (log.id)}
        <tr>
          <td>
            <time datetime={new Date(log.createdAt).toISOString()}>
              {formatTimestamp(log.createdAt)}
            </time>
          </td>
          <td>{log.user.username}</td>
          <td><code class="admin-audit-table__action">{log.action}</code></td>
          <td>
            <span class="admin-audit-table__target-type">{log.targetType}</span>
            {#if log.targetId}
              <span class="admin-audit-table__target-id">{log.targetId.slice(0, 8)}...</span>
            {/if}
          </td>
          <td class="admin-audit-table__ip">{log.ipAddress ?? '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .admin-audit-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
  }

  .admin-audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs, 0.75rem);
  }

  .admin-audit-table th,
  .admin-audit-table td {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    text-align: left;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .admin-audit-table th {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #444440);
    background: var(--color-surface-alt, #141413);
  }

  .admin-audit-table td {
    color: var(--color-text-secondary, #888884);
  }

  .admin-audit-table__action {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    padding: 1px 5px;
    border-radius: 2px;
    color: var(--color-accent, #5b9cf6);
  }

  .admin-audit-table__target-type {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .admin-audit-table__target-id {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-muted, #444440);
    margin-left: var(--space-1, 0.25rem);
  }

  .admin-audit-table__ip {
    font-family: var(--font-mono, monospace);
  }

  .admin-audit-table tbody tr:hover {
    background: var(--color-surface-alt, #141413);
  }
</style>
