<script lang="ts">
  import { enhance } from '$app/forms';
  import { Button, Badge, Dialog, Avatar } from '@snaplify/ui';
  import { typeToUrlSegment } from '$lib/utils/content-helpers';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let deleteConfirmId = $state<string | null>(null);
  let deleteDialogOpen = $state(false);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'published', label: 'Published' },
    { key: 'archived', label: 'Archived' },
  ];

  const statusVariant: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
    draft: 'warning',
    published: 'success',
    archived: 'default',
  };

  function confirmDelete(id: string) {
    deleteConfirmId = id;
    deleteDialogOpen = true;
  }

  // Stats
  const totalContent = data.items.length;
  const publishedCount = data.items.filter((i: { status: string }) => i.status === 'published').length;
  const totalViews = data.items.reduce((sum: number, i: { viewCount: number }) => sum + i.viewCount, 0);
</script>

<svelte:head>
  <title>Dashboard — Snaplify</title>
</svelte:head>

<div class="dashboard">
  <div class="dashboard-header">
    <h1>Dashboard</h1>
    <a href="/create"><Button variant="primary">Create</Button></a>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <span class="stat-value">{totalContent}</span>
      <span class="stat-label">Total Content</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{publishedCount}</span>
      <span class="stat-label">Published</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{totalViews}</span>
      <span class="stat-label">Views</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">0</span>
      <span class="stat-label">Communities</span>
    </div>
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
      <a href="/create"><Button variant="secondary" size="sm">Create your first piece of content</Button></a>
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
              <Badge variant={statusVariant[item.status] ?? 'default'} size="sm" text={item.status} />
              <span class="meta-type">{item.type}</span>
              <span class="meta-date">{new Date(item.createdAt).toLocaleDateString()}</span>
              <span class="meta-views">{item.viewCount} views</span>
            </div>
          </div>
          <div class="content-actions">
            <a href="/{typeToUrlSegment(item.type)}/{item.slug}/edit">
              <Button variant="secondary" size="sm">Edit</Button>
            </a>
            <Button variant="ghost" size="sm" onclick={() => confirmDelete(item.id)}>Delete</Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<Dialog bind:open={deleteDialogOpen} aria-label="Confirm deletion">
  <div class="delete-dialog">
    <h2>Delete Content</h2>
    <p>Are you sure you want to delete this content? This action will archive it.</p>
    <form method="POST" action="?/delete" use:enhance={() => {
      return async ({ update }) => {
        deleteDialogOpen = false;
        deleteConfirmId = null;
        await update();
      };
    }}>
      <input type="hidden" name="contentId" value={deleteConfirmId ?? ''} />
      <div class="dialog-actions">
        <Button variant="secondary" size="sm" onclick={() => { deleteDialogOpen = false; }}>Cancel</Button>
        <Button variant="danger" size="sm">Delete</Button>
      </div>
    </form>
  </div>
</Dialog>

<style>
  .dashboard {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-6, 1.5rem);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dashboard-header h1 {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4, 1rem);
  }

  .stat-card {
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    padding: var(--space-4, 1rem);
    background: var(--color-surface-alt, #141413);
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }

  .stat-value {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
  }

  .stat-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .tab {
    padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
    text-decoration: none;
    color: var(--color-text-secondary, #888884);
    border-bottom: 2px solid transparent;
    font-size: var(--text-sm, 0.75rem);
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: color var(--transition-fast, 0.1s ease);
  }

  .tab:hover {
    color: var(--color-text, #d8d5cf);
  }

  .tab-active {
    color: var(--color-primary, #5b9cf6);
    border-bottom-color: var(--color-primary, #5b9cf6);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #888884);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4, 1rem);
  }

  .content-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 0.25rem);
    overflow: hidden;
  }

  .content-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4, 1rem);
    background: var(--color-surface-alt, #141413);
    border-bottom: 1px solid var(--color-border, #272725);
  }

  .content-row:last-child {
    border-bottom: none;
  }

  .content-info {
    flex: 1;
    min-width: 0;
  }

  .content-title {
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, #d8d5cf);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base, 0.875rem);
  }

  .content-title:hover {
    color: var(--color-primary, #5b9cf6);
  }

  .content-meta {
    display: flex;
    gap: var(--space-3, 0.75rem);
    align-items: center;
    margin-top: var(--space-1, 0.25rem);
  }

  .meta-type {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.6875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #444440);
  }

  .meta-date, .meta-views {
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #444440);
  }

  .content-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    align-items: center;
    flex-shrink: 0;
  }

  .content-actions a {
    text-decoration: none;
  }

  .delete-dialog {
    padding: var(--space-4, 1rem);
    min-width: 360px;
  }

  .delete-dialog h2 {
    font-size: var(--text-lg, 1.125rem);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .delete-dialog p {
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #888884);
    margin: 0 0 var(--space-4, 1rem);
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-2, 0.5rem);
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
