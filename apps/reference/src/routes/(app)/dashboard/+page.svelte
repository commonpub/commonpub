<script lang="ts">
  import { enhance } from '$app/forms';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let deleteConfirmId = $state<string | null>(null);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'published', label: 'Published' },
    { key: 'archived', label: 'Archived' },
  ];
</script>

<svelte:head>
  <title>Dashboard — Snaplify</title>
</svelte:head>

<div class="dashboard">
  <div class="dashboard-header">
    <h1>Dashboard</h1>
    <a href="/create" class="btn btn-primary">Create</a>
  </div>

  <nav class="tabs" aria-label="Content filters">
    {#each tabs as tab}
      <a
        href="/dashboard?tab={tab.key}"
        class="tab"
        class:tab-active={data.tab === tab.key}
        aria-current={data.tab === tab.key ? 'page' : undefined}
      >
        {tab.label}
      </a>
    {/each}
  </nav>

  {#if data.items.length === 0}
    <div class="empty-state">
      <p>No content here yet.</p>
      <a href="/create">Create your first piece of content</a>
    </div>
  {:else}
    <div class="content-table">
      {#each data.items as item (item.id)}
        <div class="content-row">
          <div class="content-info">
            <a href="/{typeToUrlSegment(item.type)}/{item.slug}" class="content-title">
              {item.title}
            </a>
            <div class="content-meta">
              <span class="content-type">{item.type}</span>
              <span class="content-status status-{item.status}">{item.status}</span>
              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              <span>{item.viewCount} views</span>
            </div>
          </div>
          <div class="content-actions">
            <a href="/{typeToUrlSegment(item.type)}/{item.slug}/edit" class="btn btn-small">
              Edit
            </a>
            {#if deleteConfirmId === item.id}
              <form method="POST" action="?/delete" use:enhance>
                <input type="hidden" name="contentId" value={item.id} />
                <button type="submit" class="btn btn-small btn-danger">Confirm</button>
                <button
                  type="button"
                  class="btn btn-small"
                  onclick={() => (deleteConfirmId = null)}
                >
                  Cancel
                </button>
              </form>
            {:else}
              <button
                class="btn btn-small btn-danger-outline"
                onclick={() => (deleteConfirmId = item.id)}
              >
                Delete
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: var(--layout-content-width, 960px);
    margin: 0 auto;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg, 2rem);
  }

  .dashboard-header h1 {
    font-size: var(--font-size-2xl, 1.875rem);
    color: var(--color-text, #1a1a1a);
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    margin-bottom: var(--space-lg, 2rem);
  }

  .tab {
    padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
    text-decoration: none;
    color: var(--color-text-secondary, #666);
    border-bottom: 2px solid transparent;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .tab-active {
    color: var(--color-primary, #2563eb);
    border-bottom-color: var(--color-primary, #2563eb);
    font-weight: var(--font-weight-medium, 500);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-xl, 3rem);
    color: var(--color-text-secondary, #666);
  }

  .empty-state a {
    color: var(--color-primary, #2563eb);
  }

  .content-table {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--color-border, #e5e5e5);
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .content-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md, 1rem);
    background: var(--color-surface, #ffffff);
  }

  .content-info {
    flex: 1;
    min-width: 0;
  }

  .content-title {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #1a1a1a);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .content-title:hover {
    color: var(--color-primary, #2563eb);
  }

  .content-meta {
    display: flex;
    gap: var(--space-sm, 0.5rem);
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--color-text-secondary, #666);
    margin-top: var(--space-xs, 0.25rem);
  }

  .content-type {
    text-transform: capitalize;
  }

  .content-status {
    padding: 0 var(--space-xs, 0.25rem);
    border-radius: var(--radius-sm, 4px);
    font-weight: var(--font-weight-medium, 500);
  }

  .status-draft {
    background: var(--color-warning-bg, #fffbeb);
    color: var(--color-warning, #f59e0b);
  }

  .status-published {
    background: var(--color-success-bg, #f0fdf4);
    color: var(--color-success, #22c55e);
  }

  .status-archived {
    background: var(--color-surface-secondary, #f5f5f5);
    color: var(--color-text-secondary, #666);
  }

  .content-actions {
    display: flex;
    gap: var(--space-xs, 0.25rem);
    align-items: center;
    flex-shrink: 0;
  }

  .content-actions form {
    display: flex;
    gap: var(--space-xs, 0.25rem);
  }

  .btn {
    padding: var(--space-sm, 0.5rem) var(--space-md, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--font-size-md, 1rem);
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }

  .btn-small {
    padding: var(--space-xs, 0.25rem) var(--space-sm, 0.5rem);
    font-size: var(--font-size-xs, 0.75rem);
    background: var(--color-surface-secondary, #f5f5f5);
    color: var(--color-text, #1a1a1a);
    border: 1px solid var(--color-border, #e5e5e5);
  }

  .btn-danger {
    background: var(--color-error, #dc2626);
    color: var(--color-on-primary, #ffffff);
    border: none;
  }

  .btn-danger-outline {
    color: var(--color-error, #dc2626);
    border-color: var(--color-error, #dc2626);
    background: transparent;
  }
</style>
