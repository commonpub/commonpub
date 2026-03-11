<script lang="ts">
  import ThemePicker from '$lib/components/admin/ThemePicker.svelte';
  import TokenOverrideEditor from '$lib/components/admin/TokenOverrideEditor.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  let selectedTheme = $state(data.defaultTheme);
  let currentOverrides = $state<Record<string, string>>({ ...data.tokenOverrides });
</script>

<svelte:head>
  <title>Theme Settings — Admin</title>
</svelte:head>

<h1 class="admin-heading">Theme Settings</h1>

<section class="admin-section">
  <h2 class="admin-subheading">Default Theme</h2>
  <p class="admin-description">Select the default theme for new and anonymous users.</p>

  <form method="post" action="?/setTheme">
    <ThemePicker
      selected={selectedTheme}
      onSelect={(id) => {
        selectedTheme = id;
      }}
    />
    <input type="hidden" name="themeId" bind:value={selectedTheme} />
    <button type="submit" class="admin-btn admin-btn--mt">Apply Default Theme</button>
  </form>
</section>

<section class="admin-section">
  <h2 class="admin-subheading">Custom Token Overrides</h2>
  <p class="admin-description">Override individual CSS tokens for the entire instance.</p>

  <form method="post" action="?/setTokenOverrides">
    <TokenOverrideEditor
      overrides={currentOverrides}
      onChange={(overrides) => {
        currentOverrides = overrides;
      }}
    />
    <input type="hidden" name="overrides" value={JSON.stringify(currentOverrides)} />
    <button type="submit" class="admin-btn admin-btn--mt">Save Overrides</button>
  </form>
</section>

<style>
  .admin-heading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-6, 1.5rem);
  }

  .admin-subheading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .admin-description {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #555);
    margin: 0 0 var(--space-4, 1rem);
  }

  .admin-section {
    margin-bottom: var(--space-8, 2rem);
    padding: var(--space-4, 1rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-surface-raised, #fff);
  }

  .admin-btn {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    font-weight: var(--font-weight-medium, 500);
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
    border: none;
    border-radius: var(--radius-md, 0.25rem);
    cursor: pointer;
  }

  .admin-btn:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-btn--mt {
    margin-top: var(--space-4, 1rem);
  }
</style>
