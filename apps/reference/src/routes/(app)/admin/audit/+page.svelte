<script lang="ts">
  import AuditLogTable from '$lib/components/admin/AuditLogTable.svelte';
  import { Input, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Audit Log — Admin</title>
</svelte:head>

<div class="adm-page-header">
  <h1 class="adm-heading">Audit Log</h1>
  <span class="adm-heading-sub">activity tracking</span>
</div>

<form method="get" class="adm-filters">
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

<p class="adm-count">{data.total} log entr{data.total === 1 ? 'y' : 'ies'}</p>

<AuditLogTable logs={data.logs} />

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

  .adm-count {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
    margin-bottom: var(--space-3, 0.75rem);
  }
</style>
