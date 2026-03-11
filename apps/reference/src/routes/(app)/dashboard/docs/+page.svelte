<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>My Documentation Sites — Snaplify</title>
</svelte:head>

<section class="docs-dashboard">
  <div class="dashboard-header">
    <h1 class="page-title">My Documentation Sites</h1>
    <a href="/docs/create" class="create-link">Create New</a>
  </div>

  {#if data.sites.length === 0}
    <div class="empty-state">
      <p>You haven't created any documentation sites yet.</p>
      <a href="/docs/create" class="create-link">Create your first docs site</a>
    </div>
  {:else}
    <div class="sites-list">
      {#each data.sites as site (site.id)}
        <div class="site-card">
          <div class="site-info">
            <a href="/docs/{site.slug}" class="site-name">{site.name}</a>
            {#if site.description}
              <p class="site-desc">{site.description}</p>
            {/if}
          </div>
          <div class="site-actions">
            <a href="/docs/{site.slug}/edit" class="btn-edit">Edit</a>
            <form method="POST" action="?/delete" class="inline-form">
              <input type="hidden" name="siteId" value={site.id} />
              <button
                type="submit"
                class="btn-delete"
                onclick={(e) => {
                  if (!confirm('Delete this documentation site?')) e.preventDefault();
                }}>Delete</button
              >
            </form>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .docs-dashboard {
    max-width: var(--layout-max-width, 1200px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6, 2rem);
  }

  .page-title {
    font-size: var(--text-xl, 1.5rem);
    color: var(--color-text, inherit);
  }
  .create-link {
    font-size: var(--text-sm, 0.875rem);
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-primary, #3b82f6);
    color: var(--color-on-primary, #fff);
    border-radius: var(--radius-sm, 0.25rem);
    text-decoration: none;
  }
  .empty-state {
    text-align: center;
    padding: var(--space-12, 3rem);
    color: var(--color-text-secondary, #6b7280);
  }

  .sites-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }
  .site-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-md, 0.375rem);
  }
  .site-name {
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-primary, #3b82f6);
    text-decoration: none;
  }
  .site-desc {
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text-secondary, #6b7280);
    margin-top: var(--space-1, 0.25rem);
  }
  .site-actions {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }
  .btn-edit {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
    text-decoration: none;
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, inherit);
  }
  .btn-delete {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border: 1px solid var(--color-danger, #ef4444);
    border-radius: var(--radius-sm, 0.25rem);
    background: transparent;
    color: var(--color-danger, #ef4444);
    font-size: var(--text-sm, 0.875rem);
    cursor: pointer;
  }
  .inline-form {
    display: inline;
  }
</style>
