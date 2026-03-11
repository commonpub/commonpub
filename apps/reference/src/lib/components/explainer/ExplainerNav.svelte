<script lang="ts">
  let {
    hasPrevious = false,
    hasNext = false,
    onprevious,
    onnext,
  }: {
    hasPrevious: boolean;
    hasNext: boolean;
    onprevious?: () => void;
    onnext?: () => void;
  } = $props();
</script>

<nav class="explainer-nav" aria-label="Section navigation">
  <button
    class="nav-btn"
    disabled={!hasPrevious}
    onclick={onprevious}
    aria-label="Previous section"
  >
    &larr; Previous
  </button>
  <button class="nav-btn" disabled={!hasNext} onclick={onnext} aria-label="Next section">
    Next &rarr;
  </button>
</nav>

<style>
  .explainer-nav {
    display: flex;
    justify-content: space-between;
    padding: var(--space-6, 2rem) 0;
    margin-top: var(--space-12, 3rem);
    border-top: 1px solid var(--color-border, #272725);
  }

  .nav-btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--color-surface-alt, #1c1c1a);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    color: var(--color-text, #d8d5cf);
    font-size: var(--text-md, 1rem);
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--color-primary-light, #eff6ff);
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nav-btn:focus-visible {
    outline: 2px solid var(--color-primary, #2563eb);
    outline-offset: 2px;
  }
</style>
