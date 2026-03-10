<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    label: string;
    class?: string;
    trigger: Snippet;
    children: Snippet;
  }

  let {
    id = `menu-${Math.random().toString(36).slice(2, 9)}`,
    label,
    class: className = '',
    trigger,
    children,
  }: Props = $props();

  let open = $state(false);
  let triggerRef: HTMLButtonElement | undefined = $state(undefined);
  let menuRef: HTMLDivElement | undefined = $state(undefined);
  let activeIndex = $state(-1);

  function toggle(): void {
    if (open) {
      close();
    } else {
      open = true;
      activeIndex = 0;
    }
  }

  function close(): void {
    open = false;
    activeIndex = -1;
    triggerRef?.focus();
  }

  function getMenuItems(): HTMLElement[] {
    if (!menuRef) return [];
    return Array.from(menuRef.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open = true;
        activeIndex = 0;
        requestAnimationFrame(() => {
          getMenuItems()[0]?.focus();
        });
      }
      return;
    }

    const items = getMenuItems();

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        activeIndex = 0;
        items[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        activeIndex = items.length - 1;
        items[items.length - 1]?.focus();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        close();
        break;
      }
      default: {
        // Type-ahead
        if (e.key.length === 1) {
          const char = e.key.toLowerCase();
          const match = items.findIndex(
            (el) => el.textContent?.trim().toLowerCase().startsWith(char)
          );
          if (match !== -1) {
            activeIndex = match;
            items[match]?.focus();
          }
        }
        break;
      }
    }
  }

  function handleClickOutside(e: MouseEvent): void {
    if (
      open &&
      triggerRef &&
      menuRef &&
      !triggerRef.contains(e.target as Node) &&
      !menuRef.contains(e.target as Node)
    ) {
      close();
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside, true);
      requestAnimationFrame(() => {
        getMenuItems()[0]?.focus();
      });
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  });
</script>

<div
  class={['snaplify-menu', className].filter(Boolean).join(' ')}
  onkeydown={handleKeydown}
>
  <button
    bind:this={triggerRef}
    type="button"
    class="snaplify-menu-trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={id}
    onclick={toggle}
  >
    {@render trigger()}
  </button>

  {#if open}
    <div
      bind:this={menuRef}
      {id}
      class="snaplify-menu-content"
      role="menu"
      aria-label={label}
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .snaplify-menu {
    position: relative;
    display: inline-flex;
  }

  .snaplify-menu-trigger {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }

  .snaplify-menu-trigger:focus-visible {
    outline: var(--focus-ring, 2px solid currentColor);
    outline-offset: 2px;
  }

  .snaplify-menu-content {
    position: absolute;
    top: calc(100% + var(--space-1, 0.25rem));
    left: 0;
    min-width: 10rem;
    padding: var(--space-1, 0.25rem) 0;
    background: var(--color-surface, #fff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-md, 0.375rem);
    box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    z-index: var(--z-dropdown, 100);
  }
</style>
