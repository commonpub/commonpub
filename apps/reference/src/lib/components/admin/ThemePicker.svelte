<script lang="ts">
  import { BUILT_IN_THEMES, type ThemeDefinition } from '@snaplify/ui';

  interface Props {
    selected: string;
    class?: string;
    onSelect?: (themeId: string) => void;
  }

  let { selected, class: className = '', onSelect }: Props = $props();

  function handleKeydown(e: KeyboardEvent, themeId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(themeId);
    }
  }
</script>

<div
  class={['admin-theme-picker', className].filter(Boolean).join(' ')}
  role="radiogroup"
  aria-label="Theme selection"
>
  {#each BUILT_IN_THEMES as theme (theme.id)}
    <button
      type="button"
      class={[
        'admin-theme-picker__card',
        selected === theme.id ? 'admin-theme-picker__card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="radio"
      aria-checked={selected === theme.id}
      aria-label={`${theme.name}: ${theme.description}`}
      onclick={() => onSelect?.(theme.id)}
      onkeydown={(e) => handleKeydown(e, theme.id)}
    >
      <span class="admin-theme-picker__name">{theme.name}</span>
      <span class="admin-theme-picker__desc">{theme.description}</span>
      <span class="admin-theme-picker__meta">
        {theme.isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  {/each}
</div>

<style>
  .admin-theme-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3, 0.75rem);
  }

  .admin-theme-picker__card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-4, 1rem);
    border: var(--border-width-default, 2px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
    background: var(--color-surface-raised, #fff);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body, sans-serif);
    transition: border-color var(--transition-fast, 0.1s ease);
  }

  .admin-theme-picker__card:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .admin-theme-picker__card--selected {
    border-color: var(--color-primary, #3b82f6);
  }

  .admin-theme-picker__name {
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-base, 0.875rem);
  }

  .admin-theme-picker__desc {
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-secondary, #555);
  }

  .admin-theme-picker__meta {
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #888);
    margin-top: var(--space-1, 0.25rem);
  }
</style>
