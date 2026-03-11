<script lang="ts">
  import AuditLogTable from '$lib/components/admin/AuditLogTable.svelte';
  import { Input, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Audit Log — Admin</title>
</svelte:head>

<h1 class="admin-heading">Audit Log</h1>

<form method="get" class="admin-filters">
  <Input
    id="audit-action"
    label="Action"
    name="action"
    value={data.action ?? ''}
    placeholder="Filter by action..."
  />
  <Input
    id="audit-target-type"
    label="Target Type"
    name="targetType"
    value={data.targetType ?? ''}
    placeholder="Filter by target type..."
  />
  <Button type="submit" variant="primary" size="sm">Filter</Button>
</form>

<p class="admin-count">{data.total} log entr{data.total === 1 ? 'y' : 'ies'}</p>

<AuditLogTable logs={data.logs} />

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

  .admin-count {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #888);
    margin-bottom: var(--space-3, 0.75rem);
  }
</style>
