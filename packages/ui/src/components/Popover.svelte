<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    class?: string;
    trigger: Snippet;
    children: Snippet;
  }

  let {
    id = `popover-${Math.random().toString(36).slice(2, 9)}`,
    class: className = '',
    trigger,
    children,
  }: Props = $props();

  let open = $state(false);
  let triggerRef: HTMLButtonElement | undefined = $state(undefined);
  let contentRef: HTMLDivElement | undefined = $state(undefined);

  function toggle(): void {
    open = !open;
  }

  function close(): void {
    open = false;
    triggerRef?.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }

    // Focus trap: Tab within popover
    if (e.key === 'Tab' && open && contentRef) {
      const focusable = contentRef.querySelectorAll<HTMLElement>(
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

  function handleClickOutside(e: MouseEvent): void {
    if (
      open &&
      triggerRef &&
      contentRef &&
      !triggerRef.contains(e.target as Node) &&
      !contentRef.contains(e.target as Node)
    ) {
      close();
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  });
</script>

<div
  class={['snaplify-popover', className].filter(Boolean).join(' ')}
  onkeydown={handleKeydown}
>
  <button
    bind:this={triggerRef}
    type="button"
    class="snaplify-popover-trigger"
    aria-expanded={open}
    aria-controls={id}
    onclick={toggle}
  >
    {@render trigger()}
  </button>

  {#if open}
    <div
      bind:this={contentRef}
      {id}
      class="snaplify-popover-content"
      role="dialog"
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .snaplify-popover {
    position: relative;
    display: inline-flex;
  }

  .snaplify-popover-trigger {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }

  .snaplify-popover-trigger:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-popover-content {
    position: absolute;
    top: calc(100% + var(--space-2, 0.5rem));
    left: 0;
    padding: var(--space-4, 1rem);
    background: var(--color-surface, #fff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
    z-index: var(--z-popover, 200);
    min-width: 12rem;
  }
</style>
