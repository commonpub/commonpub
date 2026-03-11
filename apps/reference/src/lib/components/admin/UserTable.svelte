<script lang="ts">
  interface User {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role: string;
    status: string;
    createdAt: Date;
  }

  interface Props {
    users: User[];
    class?: string;
    onRoleChange?: (userId: string, role: string) => void;
    onStatusChange?: (userId: string, status: string) => void;
  }

  const ROLES = ['member', 'pro', 'verified', 'staff', 'admin'];
  const STATUSES = ['active', 'suspended', 'deleted'];

  let { users, class: className = '', onRoleChange, onStatusChange }: Props = $props();
</script>

<div
  class={['admin-user-table-wrapper', className].filter(Boolean).join(' ')}
  role="region"
  aria-label="User management table"
>
  <table class="admin-user-table">
    <thead>
      <tr>
        <th scope="col">Username</th>
        <th scope="col">Email</th>
        <th scope="col">Role</th>
        <th scope="col">Status</th>
        <th scope="col">Joined</th>
      </tr>
    </thead>
    <tbody>
      {#each users as user (user.id)}
        <tr>
          <td>
            <span class="admin-user-table__username">{user.username}</span>
            {#if user.displayName}
              <span class="admin-user-table__display-name">{user.displayName}</span>
            {/if}
          </td>
          <td>{user.email}</td>
          <td>
            <select
              value={user.role}
              aria-label={`Role for ${user.username}`}
              onchange={(e) => onRoleChange?.(user.id, (e.target as HTMLSelectElement).value)}
            >
              {#each ROLES as role}
                <option value={role}>{role}</option>
              {/each}
            </select>
          </td>
          <td>
            <select
              value={user.status}
              aria-label={`Status for ${user.username}`}
              onchange={(e) => onStatusChange?.(user.id, (e.target as HTMLSelectElement).value)}
            >
              {#each STATUSES as status}
                <option value={status}>{status}</option>
              {/each}
            </select>
          </td>
          <td>{new Date(user.createdAt).toLocaleDateString()}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .admin-user-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
  }

  .admin-user-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-xs, 0.75rem);
  }

  .admin-user-table th,
  .admin-user-table td {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    text-align: left;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .admin-user-table th {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #444440);
    background: var(--color-surface-alt, #141413);
  }

  .admin-user-table td {
    color: var(--color-text-secondary, #888884);
  }

  .admin-user-table__username {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .admin-user-table__display-name {
    display: block;
    font-size: 10px;
    color: var(--color-text-muted, #444440);
  }

  .admin-user-table select {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    padding: 2px var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
  }

  .admin-user-table select:focus {
    outline: none;
    border-color: var(--color-accent, #5b9cf6);
  }

  .admin-user-table tbody tr:hover {
    background: var(--color-surface-alt, #141413);
  }
</style>
