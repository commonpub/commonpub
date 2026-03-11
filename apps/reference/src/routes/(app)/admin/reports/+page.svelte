<script lang="ts">
  import ReportCard from '$lib/components/admin/ReportCard.svelte';
  import { Textarea, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Reports — Admin</title>
</svelte:head>

<h1 class="admin-heading">Reports</h1>

<form method="get" class="admin-filters">
  <select name="status" aria-label="Filter by status" class="admin-select">
    <option value="">All statuses</option>
    <option value="pending" selected={data.status === 'pending'}>Pending</option>
    <option value="resolved" selected={data.status === 'resolved'}>Resolved</option>
    <option value="dismissed" selected={data.status === 'dismissed'}>Dismissed</option>
  </select>
  <Button type="submit" variant="primary" size="sm">Filter</Button>
</form>

<p class="admin-count">{data.total} report{data.total === 1 ? '' : 's'}</p>

<div class="admin-report-list">
  {#each data.reports as report (report.id)}
    <div class="admin-report-item">
      <ReportCard {report} />
      {#if report.status === 'pending'}
        <form method="post" action="?/resolve" class="admin-resolve-form">
          <input type="hidden" name="reportId" value={report.id} />
          <Textarea
            id={`resolution-${report.id}`}
            label="Resolution"
            name="resolution"
            required
            placeholder="Resolution notes..."
          />
          <div class="admin-resolve-actions">
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
    <p class="admin-empty">No reports found.</p>
  {/if}
</div>

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

  .admin-report-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .admin-report-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .admin-resolve-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-3, 0.75rem);
    background: var(--color-surface-alt, #f8f9fa);
    border-radius: var(--radius-md, 0.25rem);
  }

  .admin-resolve-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
  }

  .resolve-btn {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: none;
    border-radius: var(--radius-md, 0.25rem);
    cursor: pointer;
    line-height: 1;
  }

  .resolve-btn--resolve {
    background: var(--color-success, #22c55e);
    color: var(--color-text-inverse, #fff);
  }

  .resolve-btn--dismiss {
    background: var(--color-surface-alt, #f8f9fa);
    color: var(--color-text-secondary, #555);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
  }

  .admin-empty {
    font-family: var(--font-body, sans-serif);
    color: var(--color-text-muted, #888);
    text-align: center;
    padding: var(--space-8, 2rem);
  }
</style>
