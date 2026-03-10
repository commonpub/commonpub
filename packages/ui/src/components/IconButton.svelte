<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    'aria-label': string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    disabled?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    'aria-label': ariaLabel,
    size = 'md',
    variant = 'ghost',
    disabled = false,
    class: className = '',
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class={['snaplify-icon-btn', `snaplify-icon-btn--${variant}`, `snaplify-icon-btn--${size}`, className]
    .filter(Boolean)
    .join(' ')}
  aria-label={ariaLabel}
  {disabled}
  {onclick}
>
  {@render children()}
</button>

<style>
  .snaplify-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 0.375rem);
    cursor: pointer;
    transition: var(--transition-default, 150ms ease);
    padding: 0;
    background: transparent;
    color: var(--color-text, #1a1a1a);
  }

  .snaplify-icon-btn:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-icon-btn--sm {
    width: var(--space-8, 2rem);
    height: var(--space-8, 2rem);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .snaplify-icon-btn--md {
    width: var(--space-10, 2.5rem);
    height: var(--space-10, 2.5rem);
    font-size: var(--font-size-base, 1rem);
  }

  .snaplify-icon-btn--lg {
    width: var(--space-12, 3rem);
    height: var(--space-12, 3rem);
    font-size: var(--font-size-lg, 1.125rem);
  }

  .snaplify-icon-btn--primary {
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
    border-color: var(--color-primary, #3b82f6);
  }

  .snaplify-icon-btn--secondary {
    background: var(--color-surface-elevated, #f8f9fa);
    border-color: var(--color-border, #e2e8f0);
  }

  .snaplify-icon-btn--ghost {
    background: transparent;
  }

  .snaplify-icon-btn--danger {
    background: var(--color-error, #ef4444);
    color: var(--color-error-text, #fff);
    border-color: var(--color-error, #ef4444);
  }
</style>
