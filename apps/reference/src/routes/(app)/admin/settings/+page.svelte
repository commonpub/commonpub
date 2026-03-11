<script lang="ts">
  import { Input, Button } from '@snaplify/ui';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
  <title>Settings — Admin</title>
</svelte:head>

<div class="adm-page-header">
  <h1 class="adm-heading">Instance Settings</h1>
  <span class="adm-heading-sub">configuration</span>
</div>

<div class="config-list">
  <form method="post" action="?/update" class="config-row">
    <input type="hidden" name="key" value="instance.name" />
    <div class="config-info">
      <span class="config-key">instance.name</span>
      <span class="config-desc">The public name of this Snaplify instance</span>
    </div>
    <div class="config-field">
      <Input
        id="instance-name"
        label="Instance Name"
        name="value"
        value={data.settings['instance.name'] ?? ''}
        placeholder="My Snaplify Instance"
      />
    </div>
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>

  <form method="post" action="?/update" class="config-row">
    <input type="hidden" name="key" value="instance.description" />
    <div class="config-info">
      <span class="config-key">instance.description</span>
      <span class="config-desc">Shown in search results and federation metadata</span>
    </div>
    <div class="config-field">
      <Input
        id="instance-desc"
        label="Instance Description"
        name="value"
        value={data.settings['instance.description'] ?? ''}
        placeholder="A maker community"
      />
    </div>
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>

  <form method="post" action="?/update" class="config-row">
    <input type="hidden" name="key" value="theme.default" />
    <div class="config-info">
      <span class="config-key">theme.default</span>
      <span class="config-desc">Default theme applied to all users</span>
    </div>
    <div class="config-field">
      <select id="default-theme" name="value" class="config-select">
        <option value="generics" selected={data.settings['theme.default'] === 'generics'}>Generics</option>
        <option value="base" selected={data.settings['theme.default'] === 'base'}>Base</option>
        <option value="deepwood" selected={data.settings['theme.default'] === 'deepwood'}>Deepwood</option>
        <option value="hackbuild" selected={data.settings['theme.default'] === 'hackbuild'}>hack.build</option>
        <option value="deveco" selected={data.settings['theme.default'] === 'deveco'}>deveco.io</option>
      </select>
    </div>
    <Button type="submit" variant="primary" size="sm">Save</Button>
  </form>
</div>

<style>
  .adm-page-header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3, 0.75rem);
    margin-bottom: var(--space-6, 1.5rem);
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

  .config-list {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    overflow: hidden;
  }

  .config-row {
    display: flex;
    align-items: center;
    gap: var(--space-4, 1rem);
    padding: var(--space-4, 1rem);
    border-bottom: 1px solid var(--color-border, #272725);
    background: var(--color-surface-alt, #141413);
  }

  .config-row:last-child {
    border-bottom: none;
  }

  .config-info {
    flex: 1;
    min-width: 0;
  }

  .config-key {
    display: block;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--color-text, #d8d5cf);
    letter-spacing: 0.02em;
  }

  .config-desc {
    display: block;
    font-size: 11px;
    color: var(--color-text-muted, #444440);
    margin-top: 2px;
  }

  .config-field {
    width: 240px;
    flex-shrink: 0;
  }

  .config-select {
    width: 100%;
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs, 0.75rem);
    padding: 6px var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
  }

  .config-select:focus {
    outline: none;
    border-color: var(--color-accent, #5b9cf6);
  }

  @media (max-width: 768px) {
    .config-row {
      flex-direction: column;
      align-items: stretch;
    }

    .config-field {
      width: 100%;
    }
  }
</style>
