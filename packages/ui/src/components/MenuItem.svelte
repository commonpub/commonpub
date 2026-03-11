<script lang="ts">
  interface Props {
    disabled?: boolean;
    class?: string;
    onclick?: () => void;
    label: string;
  }

  let { disabled = false, class: className = '', onclick, label }: Props = $props();

  function handleClick(): void {
    if (!disabled) onclick?.();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      onclick?.();
    }
  }
</script>

<div
  class={['snaplify-menu-item', className].filter(Boolean).join(' ')}
  role="menuitem"
  tabindex={disabled ? -1 : 0}
  aria-disabled={disabled}
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  {label}
</div>

<style>
  .snaplify-menu-item {
    padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--text-base);
    color: var(--color-text, #1a1a1a);
    cursor: pointer;
    outline: none;
  }

  .snaplify-menu-item:focus-visible {
    background: var(--color-surface-raised);
  }

  .snaplify-menu-item:hover {
    background: var(--color-surface-raised);
  }

  .snaplify-menu-item[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
