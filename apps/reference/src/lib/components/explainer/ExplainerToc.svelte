<script lang="ts">
  import type { TocItem } from '@snaplify/explainer';

  let { items, onselect }: { items: TocItem[]; onselect?: (anchor: string) => void } = $props();

  function handleClick(e: MouseEvent, anchor: string, locked: boolean) {
    if (locked) {
      e.preventDefault();
      return;
    }
    if (onselect) {
      e.preventDefault();
      onselect(anchor);
    }
  }
</script>

<nav class="toc" aria-label="Table of contents">
  <h2 class="toc__title">Contents</h2>
  <ol class="toc__list">
    {#each items as item}
      <li class="toc__item">
        <a
          href="#{item.anchor}"
          class="toc__link"
          class:toc__link--active={item.active}
          class:toc__link--locked={item.locked}
          class:toc__link--completed={item.completed}
          aria-current={item.active ? 'step' : undefined}
          aria-disabled={item.locked}
          onclick={(e) => handleClick(e, item.anchor, item.locked)}
        >
          {#if item.completed}
            <span class="toc__check" aria-hidden="true">&#10003;</span>
          {/if}
          {#if item.locked}
            <span class="toc__lock" aria-hidden="true">&#128274;</span>
          {/if}
          <span>{item.title}</span>
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .toc {
    padding: var(--space-6, 2rem);
  }

  .toc__title {
    font-size: var(--text-sm, 0.875rem);
    font-weight: var(--font-weight-semibold, 600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary, #888884);
    margin-bottom: var(--space-4, 1rem);
  }

  .toc__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .toc__item {
    margin-bottom: var(--space-1, 0.25rem);
  }

  .toc__link {
    display: flex;
    align-items: center;
    gap: var(--space-2, 0.5rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text, #d8d5cf);
    text-decoration: none;
    font-size: var(--text-sm, 0.875rem);
    transition: background 0.15s;
  }

  .toc__link:hover {
    background: var(--color-surface-alt, #1c1c1a);
  }

  .toc__link--active {
    background: var(--color-primary-light, #eff6ff);
    font-weight: var(--font-weight-semibold, 600);
  }

  .toc__link--locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toc__link--completed {
    color: var(--color-success, #22c55e);
  }

  .toc__check {
    color: var(--color-success, #22c55e);
    font-size: var(--text-sm, 0.875rem);
  }

  .toc__lock {
    font-size: var(--text-xs, 0.75rem);
  }
</style>
