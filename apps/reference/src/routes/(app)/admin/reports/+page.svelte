<script lang="ts">
  import ReportCard from '$lib/components/admin/ReportCard.svelte';
  import { Textarea, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Reports — Admin</title>
</svelte:head>

<div class="adm-page-header">
  <h1 class="adm-heading">Reports</h1>
  <span class="adm-heading-sub">moderation</span>
</div>

<form method="get" class="adm-filters">
  <select name="status" aria-label="Filter by status" class="adm-select">
    <option value="">All statuses</option>
    <option value="pending" selected={data.status === 'pending'}>Pending</option>
    <option value="resolved" selected={data.status === 'resolved'}>Resolved</option>
    <option value="dismissed" selected={data.status === 'dismissed'}>Dismissed</option>
  </select>
  <Button type="submit" variant="primary" size="sm">Filter</Button>
</form>

<p class="adm-count">{data.total} report{data.total === 1 ? '' : 's'}</p>

<div class="report-list">
  {#each data.reports as report (report.id)}
    <div class="report-item">
      <ReportCard {report} />
      {#if report.status === 'pending'}
        <form method="post" action="?/resolve" class="resolve-form">
          <input type="hidden" name="reportId" value={report.id} />
          <Textarea
            id={`resolution-${report.id}`}
            label="Resolution"
            name="resolution"
            required
            placeholder="Resolution notes..."
          />
          <div class="resolve-actions">
            <button
              type="submit"
              name="status"
              value="resolved"
              class="resolve-btn resolve-btn--resolve"
            >Resolve</button>
            <button
              type="submit"
              name="status"
              value="dismissed"
              class="resolve-btn resolve-btn--dismiss"
            >Dismiss</button>
          </div>
        </form>
      {/if}
    </div>
  {/each}
  {#if data.reports.length === 0}
    <p class="adm-empty">No reports found.</p>
  {/if}
</div>

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

  .report-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .report-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .resolve-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem);
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
  }

  .resolve-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .resolve-btn {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 12px;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
  }

  .resolve-btn--resolve {
    background: var(--color-success, #4ade80);
    color: var(--color-bg, #0c0c0b);
    border-color: var(--color-success, #4ade80);
  }

  .resolve-btn--dismiss {
    background: transparent;
    color: var(--color-text-secondary, #888884);
  }

  .resolve-btn--dismiss:hover {
    background: var(--color-surface-alt, #141413);
  }

  .adm-empty {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text-muted, #444440);
    text-align: center;
    padding: var(--space-8, 2rem);
  }
</style>
