<script lang="ts">
  interface Props {
    label: string;
    value: number | string;
    description?: string;
    class?: string;
  }

  let { label, value, description, class: className = '' }: Props = $props();
</script>

<div
  class={['admin-stat-card', className].filter(Boolean).join(' ')}
  role="group"
  aria-label={label}
>
  <span class="admin-stat-card__label">{label}</span>
  <span class="admin-stat-card__value">{value}</span>
  {#if description}
    <span class="admin-stat-card__description">{description}</span>
  {/if}
</div>

<style>
  .admin-stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 0.25rem);
    padding: var(--space-4, 1rem);
    background: var(--color-surface-raised, #fff);
    border: var(--border-width-thin, 1px) solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-lg, 0.5rem);
  }

  .admin-stat-card__label {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-sm, 0.75rem);
    color: var(--color-text-muted, #888);
    font-weight: var(--font-weight-medium, 500);
  }

  .admin-stat-card__value {
    font-family: var(--font-heading, sans-serif);
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
  }

  .admin-stat-card__description {
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-xs, 0.6875rem);
    color: var(--color-text-muted, #888);
  }
</style>
