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
  }

  .admin-user-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
  }

  .admin-user-table th,
  .admin-user-table td {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    text-align: left;
    border-bottom: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
  }

  .admin-user-table th {
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-secondary, #555);
    background: var(--color-surface-alt, #f8f9fa);
  }

  .admin-user-table__username {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
  }

  .admin-user-table__display-name {
    display: block;
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #888);
  }

  .admin-user-table select {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.25rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #d8d5cf);
  }

  .admin-user-table select:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
