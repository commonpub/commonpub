<script lang="ts">
  import { Input, Button } from '@snaplify/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Manage Versions — {data.site.name} Docs</title>
</svelte:head>

<section class="versions-page">
  <h1 class="page-title">Version Management</h1>

  {#if form?.error}
    <div class="error-message" role="alert">{form.error}</div>
  {/if}
  {#if form?.success}
    <div class="success-message" role="status">Version updated.</div>
  {/if}

  <div class="version-list">
    {#each data.versions as version (version.id)}
      <div class="version-card">
        <div class="version-info">
          <span class="version-name">{version.version}</span>
          {#if version.isDefault}
            <span class="version-badge">Default</span>
          {/if}
          <span class="version-pages">{version.pageCount} pages</span>
        </div>
        <div class="version-actions">
          {#if !version.isDefault}
            <form method="POST" action="?/setDefault" class="inline-form">
              <input type="hidden" name="versionId" value={version.id} />
              <Button variant="secondary" size="sm" type="submit">Set Default</Button>
            </form>
            <form method="POST" action="?/delete" class="inline-form">
              <input type="hidden" name="versionId" value={version.id} />
              <Button
                variant="danger"
                size="sm"
                type="submit"
                onclick={(e) => {
                  if (!confirm('Delete this version and all its pages?')) e.preventDefault();
                }}>Delete</Button
              >
            </form>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <hr class="divider" />

  <h2 class="section-title">Create New Version</h2>
  <form method="POST" action="?/create" class="create-form">
    <Input id="version" name="version" label="Version Name" required placeholder="v2.0" />
    <div class="select-field">
      <label for="sourceVersionId" class="select-label">Copy pages from</label>
      <select id="sourceVersionId" name="sourceVersionId" class="select-input">
        <option value="">Start empty</option>
        {#each data.versions as version}
          <option value={version.id}>{version.version} ({version.pageCount} pages)</option>
        {/each}
      </select>
    </div>
    <label class="checkbox-field">
      <input type="checkbox" name="isDefault" value="true" />
      <span>Set as default version</span>
    </label>
    <Button variant="primary" size="md" type="submit">Create Version</Button>
  </form>
</section>

<style>
  .versions-page {
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

  .error-message,
  .success-message {
    padding: var(--space-2, 0.5rem);
    margin-bottom: var(--space-4, 1rem);
    border-radius: var(--radius-sm, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
  }
  .error-message {
    border: 1px solid var(--color-danger, #ef4444);
    color: var(--color-danger, #ef4444);
  }
  .success-message {
    border: 1px solid var(--color-success, #22c55e);
    color: var(--color-success, #22c55e);
  }

  .version-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }
  .version-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
  }
  .version-info {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
  }
  .version-name {
    font-weight: var(--font-weight-semibold, 600);
  }
  .version-badge {
    font-size: var(--text-xs, 0.75rem);
    padding: 0 var(--space-1, 0.25rem);
    background: var(--color-primary, #3b82f6);
    color: var(--color-on-primary, #fff);
    border-radius: var(--radius-xs, 0.125rem);
  }
  .version-pages {
    font-size: var(--text-xs, 0.75rem);
    color: var(--color-text-muted, #9ca3af);
  }
  .version-actions {
    display: flex;
    gap: var(--space-1, 0.25rem);
  }

  .inline-form {
    display: inline;
  }

  .divider {
    margin: var(--space-6, 2rem) 0;
    border: none;
    border-top: 1px solid var(--color-border, #e5e7eb);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }
  .select-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
  }
  .select-label {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text, inherit);
  }
  .select-input {
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, inherit);
    background: var(--color-bg-surface, #fff);
  }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
