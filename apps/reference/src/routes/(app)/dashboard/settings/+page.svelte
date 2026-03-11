<script lang="ts">
  import { Button } from '@snaplify/ui';
  import ThemePicker from '$lib/components/admin/ThemePicker.svelte';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  let selectedTheme = $state(data.currentTheme);

  function previewTheme(themeId: string) {
    selectedTheme = themeId;
    if (themeId === 'base') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', themeId);
    }
  }
</script>

<svelte:head>
  <title>Settings — Dashboard</title>
</svelte:head>

<h1 class="settings-heading">Settings</h1>

<section class="settings-section">
  <h2 class="settings-subheading">Theme</h2>
  <p class="settings-description">
    Choose your preferred theme. Click a card to preview, then apply to save.
  </p>

  <ThemePicker selected={selectedTheme} onSelect={previewTheme} />

  <form method="post" action="?/setTheme" class="settings-form">
    <input type="hidden" name="themeId" value={selectedTheme} />
    <Button variant="primary" size="md" type="submit">
      Apply Theme
    </Button>
  </form>
</section>

<style>
  .settings-heading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-6, 1.5rem);
  }

  .settings-subheading {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    margin: 0 0 var(--space-2, 0.5rem);
  }

  .settings-description {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-secondary, #555);
    margin: 0 0 var(--space-4, 1rem);
  }

  .settings-section {
    padding: var(--space-4, 1rem);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-surface-raised, #fff);
  }

  .settings-form {
    margin-top: var(--space-4, 1rem);
  }

</style>
