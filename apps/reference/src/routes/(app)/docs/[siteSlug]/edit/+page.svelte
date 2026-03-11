<script lang="ts">
  import { Input, Textarea, Button } from '@snaplify/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Edit {data.site.name} — Snaplify Docs</title>
</svelte:head>

<section class="edit-site-page">
  <h1 class="page-title">Site Settings: {data.site.name}</h1>

  {#if form?.error}
    <div class="error-message" role="alert">{form.error}</div>
  {/if}
  {#if form?.success}
    <div class="success-message" role="status">Settings updated.</div>
  {/if}

  <form method="POST" action="?/update" class="site-form">
    <Input id="name" name="name" label="Name" value={data.site.name} required />
    <Textarea id="description" name="description" label="Description" value={data.site.description ?? ''} rows={3} />
    <Button variant="primary" size="md" type="submit">Save Changes</Button>
  </form>

  <hr class="divider" />

  <h2 class="section-title">Pages</h2>

  <form method="POST" action="?/createPage" class="inline-form">
    <Input id="newPageTitle" name="title" label="New page title" placeholder="New page title..." required />
    <Button variant="primary" size="md" type="submit">Add Page</Button>
  </form>

  {#if data.pages.length > 0}
    <ul class="page-list">
      {#each data.pages as page (page.id)}
        <li class="page-list-item">
          <a href="/docs/{data.site.slug}/edit/{page.id}" class="page-list-link">{page.title}</a>
          <span class="page-list-slug">/{page.slug}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-state">No pages yet. Create your first page above.</p>
  {/if}

  <hr class="divider" />

  <h2 class="section-title danger-title">Danger Zone</h2>
  <form method="POST" action="?/delete">
    <Button
      variant="danger"
      size="md"
      type="submit"
      onclick={(e) => {
        if (!confirm('Delete this entire docs site? This cannot be undone.')) e.preventDefault();
      }}
    >
      Delete Site
    </Button>
  </form>
</section>

<style>
  .edit-site-page {
    max-width: var(--layout-narrow-width, 640px);
    margin: 0 auto;
    padding: var(--space-4, 1rem);
  }

  .page-title {
    font-size: var(--text-xl, 1.5rem);
    margin-bottom: var(--space-6, 2rem);
    color: var(--color-text, inherit);
  }

  .section-title {
    font-size: var(--text-lg, 1.125rem);
    margin-bottom: var(--space-2, 0.5rem);
    color: var(--color-text, inherit);
  }

  .danger-title {
    color: var(--color-danger, #ef4444);
  }

  .error-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border: 1px solid var(--color-danger, #ef4444);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--color-danger, #ef4444);
    font-size: var(--text-sm, 0.875rem);
  }

  .success-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border: 1px solid var(--color-success, #22c55e);
    border-radius: var(--radius-sm, 0.25rem);
    color: var(--color-success, #22c55e);
    font-size: var(--text-sm, 0.875rem);
  }

  .site-form,
  .inline-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
  }

  .inline-form {
    flex-direction: row;
    align-items: center;
  }


  .divider {
    margin: var(--space-6, 2rem) 0;
    border: none;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

  .page-list {
    list-style: none;
    padding: 0;
  }

  .page-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2, 0.5rem) 0;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .page-list-link {
    color: var(--color-primary, #3b82f6);
    text-decoration: none;
  }

  .page-list-slug {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted, #9ca3af);
    font-family: var(--font-mono, monospace);
  }

  .empty-state {
    color: var(--color-text-secondary, #6b7280);
    padding: var(--space-4, 1rem) 0;
  }
</style>
