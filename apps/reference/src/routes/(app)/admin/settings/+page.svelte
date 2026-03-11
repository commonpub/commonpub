<script lang="ts">
  import { Input, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Settings — Admin</title>
</svelte:head>

<h1 class="admin-heading">Instance Settings</h1>

<div class="admin-settings-grid">
  <form method="post" action="?/update" class="admin-setting-form">
    <input type="hidden" name="key" value="instance.name" />
    <Input
      id="instance-name"
      label="Instance Name"
      name="value"
      value={data.settings['instance.name'] ?? ''}
      placeholder="My Snaplify Instance"
    />
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>

  <form method="post" action="?/update" class="admin-setting-form">
    <input type="hidden" name="key" value="instance.description" />
    <Input
      id="instance-desc"
      label="Instance Description"
      name="value"
      value={data.settings['instance.description'] ?? ''}
      placeholder="A maker community"
    />
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>

  <form method="post" action="?/update" class="admin-setting-form">
    <label class="admin-label" for="default-theme">Default Theme</label>
    <input type="hidden" name="key" value="theme.default" />
    <select id="default-theme" name="value" class="admin-select">
      <option value="base" selected={data.settings['theme.default'] === 'base'}>Base</option>
      <option value="deepwood" selected={data.settings['theme.default'] === 'deepwood'}
        >Deepwood</option
      >
      <option value="hackbuild" selected={data.settings['theme.default'] === 'hackbuild'}
        >hack.build</option
      >
      <option value="deveco" selected={data.settings['theme.default'] === 'deveco'}
        >deveco.io</option
      >
    </select>
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>
</div>

<style>
  .admin-heading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-6, 1.5rem);
  }

  .admin-settings-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-4, 1rem);
  }

  .admin-setting-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-4, 1rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-surface-raised, #fff);
  }

  .admin-label {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
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
</style>
