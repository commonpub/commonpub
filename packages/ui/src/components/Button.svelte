<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  class={['snaplify-btn', `snaplify-btn--${variant}`, `snaplify-btn--${size}`, className]
    .filter(Boolean)
    .join(' ')}
  disabled={isDisabled}
  aria-disabled={isDisabled}
  aria-busy={loading}
  {onclick}
>
  {#if loading}
    <span class="snaplify-btn__spinner" aria-hidden="true"></span>
  {/if}
  {@render children()}
</button>

<style>
  .snaplify-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, currentColor);
    border-radius: var(--radius-md, 0.375rem);
    font-family: var(--font-body, sans-serif);
    font-weight: var(--font-weight-medium, 500);
    cursor: pointer;
    transition: var(--transition-default, 150ms ease);
    line-height: 1;
  }

  .snaplify-btn:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .snaplify-btn--sm {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--text-sm);
  }

  .snaplify-btn--md {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    font-size: var(--text-base);
  }

  .snaplify-btn--lg {
    padding: var(--space-3, 0.75rem) var(--space-6, 1.5rem);
    font-size: var(--text-lg);
  }

  .snaplify-btn--primary {
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
    border-color: var(--color-primary, #3b82f6);
  }

  .snaplify-btn--secondary {
    background: var(--color-surface-alt);
    color: var(--color-text, #1a1a1a);
    border-color: var(--color-border, #e2e8f0);
  }

  .snaplify-btn--ghost {
    background: transparent;
    color: var(--color-text, #1a1a1a);
    border-color: transparent;
  }

  .snaplify-btn--danger {
    background: var(--color-error, #ef4444);
    color: var(--color-error-text, #fff);
    border-color: var(--color-error, #ef4444);
  }

  .snaplify-btn__spinner {
    display: inline-block;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: var(--radius-full, 9999px);
    animation: snaplify-spin 0.6s linear infinite;
  }

  @keyframes snaplify-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
