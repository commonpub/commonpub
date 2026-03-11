<script lang="ts">
  import UserTable from '$lib/components/admin/UserTable.svelte';
  import { Input, Button } from '@snaplify/ui';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  async function handleRoleChange(userId: string, role: string) {
    const formData = new FormData();
    formData.set('userId', userId);
    formData.set('role', role);
    await fetch('?/updateRole', { method: 'POST', body: formData });
    await invalidateAll();
  }

  async function handleStatusChange(userId: string, status: string) {
    const formData = new FormData();
    formData.set('userId', userId);
    formData.set('status', status);
    await fetch('?/updateStatus', { method: 'POST', body: formData });
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>User Management — Admin</title>
</svelte:head>

<div class="adm-page-header">
  <h1 class="adm-heading">Users</h1>
  <span class="adm-heading-sub">management</span>
</div>

<form method="get" class="adm-filters">
  <Input
    id="user-search"
    label="Search"
    type="search"
    name="search"
    value={data.search ?? ''}
    placeholder="Search users..."
  />
  <select name="role" aria-label="Filter by role" class="adm-select">
    <option value="">All roles</option>
    <option value="member" selected={data.role === 'member'}>member</option>
    <option value="pro" selected={data.role === 'pro'}>pro</option>
    <option value="verified" selected={data.role === 'verified'}>verified</option>
    <option value="staff" selected={data.role === 'staff'}>staff</option>
    <option value="admin" selected={data.role === 'admin'}>admin</option>
  </select>
  <select name="status" aria-label="Filter by status" class="adm-select">
    <option value="">All statuses</option>
    <option value="active" selected={data.status === 'active'}>active</option>
    <option value="suspended" selected={data.status === 'suspended'}>suspended</option>
    <option value="deleted" selected={data.status === 'deleted'}>deleted</option>
  </select>
  <Button type="submit" variant="primary" size="sm">Filter</Button>
</form>

<p class="adm-count">{data.total} user{data.total === 1 ? '' : 's'} found</p>

<UserTable users={data.users} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange} />

<style>
  .adm-page-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3, 0.75rem);
    margin-bottom: var(--space-4, 1rem);
    padding-bottom: var(--space-3, 0.75rem);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .adm-heading {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .adm-heading-sub {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #444440);
  }

  .adm-filters {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .adm-select {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    padding: 6px var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
  }

  .adm-select:focus {
    outline: none;
    border-color: var(--color-accent, #5b9cf6);
  }

  .adm-count {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
    margin-bottom: var(--space-3, 0.75rem);
  }
</style>
