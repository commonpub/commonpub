<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open?: boolean;
    id?: string;
    'aria-label': string;
    class?: string;
    onclose?: () => void;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    id = `dialog-${Math.random().toString(36).slice(2, 9)}`,
    'aria-label': ariaLabel,
    class: className = '',
    onclose,
    children,
  }: Props = $props();

  let dialogRef: HTMLDivElement | undefined = $state(undefined);
  let previousFocus: HTMLElement | null = $state(null);

  function close(): void {
    open = false;
    onclose?.();
    previousFocus?.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }

    // Focus trap
    if (e.key === 'Tab' && dialogRef) {
      const focusable = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  $effect(() => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const focusable = dialogRef?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="snaplify-dialog-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div
      bind:this={dialogRef}
      {id}
      class={['snaplify-dialog', className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .snaplify-dialog-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-overlay, rgb(0 0 0 / 0.5));
    z-index: var(--z-modal, 1000);
  }

  .snaplify-dialog {
    background: var(--color-surface, #fff);
    border-radius: var(--radius-lg, 0.5rem);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1));
    padding: var(--space-6, 1.5rem);
    max-width: min(90vw, 32rem);
    max-height: 90vh;
    overflow-y: auto;
  }
</style>
