<script lang="ts">
  interface Props {
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md';
    class?: string;
    text: string;
  }

  let {
    variant = 'default',
    size = 'md',
    class: className = '',
    text,
  }: Props = $props();
</script>

<span class={['snaplify-badge', `snaplify-badge--${variant}`, `snaplify-badge--${size}`, className].filter(Boolean).join(' ')}>
  {text}
</span>

<style>
  .snaplify-badge {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-body, sans-serif);
    font-weight: var(--font-weight-medium, 500);
    border-radius: var(--radius-full, 9999px);
    line-height: 1;
  }

  .snaplify-badge--sm {
    padding: var(--space-0-5, 0.125rem) var(--space-1-5, 0.375rem);
    font-size: var(--font-size-xs, 0.75rem);
  }

  .snaplify-badge--md {
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .snaplify-badge--default {
    background: var(--color-surface-elevated, #f8f9fa);
    color: var(--color-text-secondary, #64748b);
  }

  .snaplify-badge--primary {
    background: var(--color-primary, #3b82f6);
    color: var(--color-primary-text, #fff);
  }

  .snaplify-badge--success {
    background: var(--color-success, #22c55e);
    color: var(--color-success-text, #fff);
  }

  .snaplify-badge--warning {
    background: var(--color-warning, #f59e0b);
    color: var(--color-warning-text, #000);
  }

  .snaplify-badge--danger {
    background: var(--color-error, #ef4444);
    color: var(--color-error-text, #fff);
  }
</style>
