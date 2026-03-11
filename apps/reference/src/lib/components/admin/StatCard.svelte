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
    background: var(--color-surface-alt, #141413);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
  }

  .admin-stat-card__label {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted, #444440);
  }

  .admin-stat-card__value {
    font-size: var(--text-2xl, 1.5rem);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #d8d5cf);
  }

  .admin-stat-card__description {
    font-family: var(--font-mono, monospace);
    font-size: 9px;
    color: var(--color-text-muted, #444440);
  }
</style>
