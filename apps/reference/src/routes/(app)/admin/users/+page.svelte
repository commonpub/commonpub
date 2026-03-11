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

<h1 class="admin-heading">Users</h1>

<form method="get" class="admin-filters">
  <Input
    id="user-search"
    label="Search"
    type="search"
    name="search"
    value={data.search ?? ''}
    placeholder="Search users..."
  />
  <select name="role" aria-label="Filter by role" class="admin-select">
    <option value="">All roles</option>
    <option value="member" selected={data.role === 'member'}>member</option>
    <option value="pro" selected={data.role === 'pro'}>pro</option>
    <option value="verified" selected={data.role === 'verified'}>verified</option>
    <option value="staff" selected={data.role === 'staff'}>staff</option>
    <option value="admin" selected={data.role === 'admin'}>admin</option>
  </select>
  <select name="status" aria-label="Filter by status" class="admin-select">
    <option value="">All statuses</option>
    <option value="active" selected={data.status === 'active'}>active</option>
    <option value="suspended" selected={data.status === 'suspended'}>suspended</option>
    <option value="deleted" selected={data.status === 'deleted'}>deleted</option>
  </select>
  <Button type="submit" variant="primary" size="sm">Filter</Button>
</form>

<p class="admin-count">{data.total} user{data.total === 1 ? '' : 's'} found</p>

<UserTable users={data.users} onRoleChange={handleRoleChange} onStatusChange={handleStatusChange} />

<style>
  .admin-heading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-4, 1rem);
  }

  .admin-filters {
    display: flex;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .admin-select {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.25rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #d8d5cf);
  }

  .admin-select:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-count {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #888);
    margin-bottom: var(--space-3, 0.75rem);
  }
</style>
