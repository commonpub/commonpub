<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    id?: string;
    class?: string;
    children: Snippet;
  }

  let {
    text,
    id = `tooltip-${Math.random().toString(36).slice(2, 9)}`,
    class: className = '',
    children,
  }: Props = $props();

  let visible = $state(false);

  function show(): void {
    visible = true;
  }

  function hide(): void {
    visible = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && visible) {
      hide();
    }
  }
</script>

<span
  class={['snaplify-tooltip-wrapper', className].filter(Boolean).join(' ')}
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  onkeydown={handleKeydown}
  aria-describedby={visible ? id : undefined}
>
  {@render children()}
  {#if visible}
    <span class="snaplify-tooltip" {id} role="tooltip">
      {text}
    </span>
  {/if}
</span>

<style>
  .snaplify-tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .snaplify-tooltip {
    position: absolute;
    bottom: calc(100% + var(--space-2, 0.5rem));
    left: 50%;
    transform: translateX(-50%);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    font-family: var(--font-body, sans-serif);
    font-size: var(--font-size-sm, 0.875rem);
    background: var(--color-text, #1a1a1a);
    color: var(--color-surface, #fff);
    border-radius: var(--radius-sm, 0.25rem);
    white-space: nowrap;
    pointer-events: none;
    z-index: var(--z-tooltip, 1100);
  }
</style>
